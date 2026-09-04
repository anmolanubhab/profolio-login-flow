-- Step 5 of the Advertising Data work: honour the caller's
-- `preferences.data_use.connections` choice in Network → Grow people ranking.
--
-- Only change vs the previous definition (20260831090000_network_unify_and_harden):
--   * the `me` CTE also resolves the CALLER'S OWN data_use.connections flag
--     (absent => true, matching DATA_USE_DEFAULTS.connections in the frontend);
--   * the ORDER BY's mutual-connection key is gated by that flag.
--
--   flag true / absent  -> ranking identical to before
--                          (`mutual_connections_count desc, created_at desc`)
--   flag false          -> mutual-connection signal not used for ranking;
--                          falls back to `created_at desc`
--
-- The flag is read from the caller's own row only (no other user's preferences
-- are touched) and is never returned to the client — it only affects ordering.
-- `mutual_count` is still SELECTed (the "N mutual connections" hint is the
-- caller's own information about their own graph, not a ranking behaviour).
-- Signature and column list are unchanged, so no frontend change is needed.

create or replace function public.search_people(
  search text default ''::text,
  lim integer default 20,
  off integer default 0
)
returns table(
  profile_id uuid,
  display_name text,
  full_name text,
  headline text,
  profession text,
  location text,
  avatar_url text,
  last_name_visibility text,
  mutual_count integer,
  relationship text,
  request_id uuid
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with me as (
    select
      public.current_profile_id() as pid,
      coalesce(
        (select (pr.preferences #>> '{data_use,connections}')::boolean
           from public.profiles pr
          where pr.user_id = auth.uid()),
        true
      ) as use_connections
  )
  select
    p.id, p.display_name, p.full_name, p.headline, p.profession, p.location, p.avatar_url, p.last_name_visibility,
    public.mutual_connections_count(p.id) as mutual_count,
    case
      when p.id = (select pid from me) then 'self'
      when exists (select 1 from public.connections c where c.status='accepted'
        and ((c.user_id=(select pid from me) and c.connection_id=p.id) or (c.user_id=p.id and c.connection_id=(select pid from me)))) then 'connected'
      when exists (select 1 from public.friend_requests fr where fr.status='pending' and fr.sender_id=(select pid from me) and fr.receiver_id=p.id) then 'pending_outgoing'
      when exists (select 1 from public.friend_requests fr where fr.status='pending' and fr.sender_id=p.id and fr.receiver_id=(select pid from me)) then 'pending_incoming'
      else 'none'
    end as relationship,
    (select fr.id from public.friend_requests fr where fr.status='pending'
       and ((fr.sender_id=(select pid from me) and fr.receiver_id=p.id) or (fr.sender_id=p.id and fr.receiver_id=(select pid from me))) limit 1) as request_id
  from public.profiles p
  where p.id <> (select pid from me)
    and coalesce(p.profile_discovery, true) = true
    and not exists (select 1 from public.blocked_users b
      where (b.user_id=(select pid from me) and b.blocked_user_id=p.id) or (b.user_id=p.id and b.blocked_user_id=(select pid from me)))
    and (coalesce(nullif(trim(search), ''), '') = ''
      or p.display_name ilike '%'||search||'%' or p.full_name ilike '%'||search||'%'
      or p.headline ilike '%'||search||'%' or p.profession ilike '%'||search||'%' or p.location ilike '%'||search||'%')
  order by
    case when (select use_connections from me)
         then public.mutual_connections_count(p.id)
         else 0
    end desc,
    p.created_at desc
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
$function$;

revoke all on function public.search_people(text, integer, integer) from anon, public;
grant execute on function public.search_people(text, integer, integer) to authenticated;
