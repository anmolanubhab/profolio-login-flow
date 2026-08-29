-- Expose last_name_visibility from the Network search RPCs so the client can
-- apply the same last-name masking used elsewhere (src/lib/nameVisibility.ts).
-- Return type changes => drop first.
drop function if exists public.search_people(text, int, int);
drop function if exists public.search_connections(text, int, int);

create function public.search_people(
  search text default '',
  lim int default 20,
  off int default 0
)
returns table (
  profile_id uuid,
  display_name text,
  full_name text,
  headline text,
  profession text,
  location text,
  avatar_url text,
  last_name_visibility text,
  mutual_count int,
  relationship text,
  request_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.current_profile_id() as pid)
  select
    p.id,
    p.display_name,
    p.full_name,
    p.headline,
    p.profession,
    p.location,
    p.avatar_url,
    p.last_name_visibility,
    public.mutual_connections_count(p.id) as mutual_count,
    case
      when p.id = (select pid from me) then 'self'
      when exists (
        select 1 from public.connections c
        where c.status = 'accepted'
          and ((c.user_id = (select pid from me) and c.connection_id = p.id)
            or (c.user_id = p.id and c.connection_id = (select pid from me)))
      ) then 'connected'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending' and fr.sender_id = (select pid from me) and fr.receiver_id = p.id
      ) then 'pending_outgoing'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending' and fr.sender_id = p.id and fr.receiver_id = (select pid from me)
      ) then 'pending_incoming'
      else 'none'
    end as relationship,
    (
      select fr.id from public.friend_requests fr
      where fr.status = 'pending'
        and ((fr.sender_id = (select pid from me) and fr.receiver_id = p.id)
          or (fr.sender_id = p.id and fr.receiver_id = (select pid from me)))
      limit 1
    ) as request_id
  from public.profiles p
  where p.id <> (select pid from me)
    and coalesce(p.profile_discovery, true) = true
    and (
      coalesce(nullif(trim(search), ''), '') = ''
      or p.display_name ilike '%' || search || '%'
      or p.full_name   ilike '%' || search || '%'
      or p.headline    ilike '%' || search || '%'
      or p.profession  ilike '%' || search || '%'
      or p.location    ilike '%' || search || '%'
    )
  order by
    public.mutual_connections_count(p.id) desc,
    p.created_at desc
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
$$;
revoke all on function public.search_people(text, int, int) from anon, public;
grant execute on function public.search_people(text, int, int) to authenticated;

create function public.search_connections(
  search text default '',
  lim int default 20,
  off int default 0
)
returns table (
  profile_id uuid,
  display_name text,
  full_name text,
  headline text,
  profession text,
  location text,
  avatar_url text,
  last_name_visibility text,
  connected_at timestamptz,
  mutual_count int
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.current_profile_id() as pid),
  my_conns as (
    select
      case when c.user_id = (select pid from me) then c.connection_id else c.user_id end as other_id,
      c.created_at as connected_at
    from public.connections c
    where c.status = 'accepted'
      and ((select pid from me) in (c.user_id, c.connection_id))
  )
  select
    p.id,
    p.display_name,
    p.full_name,
    p.headline,
    p.profession,
    p.location,
    p.avatar_url,
    p.last_name_visibility,
    mc.connected_at,
    public.mutual_connections_count(p.id) as mutual_count
  from my_conns mc
  join public.profiles p on p.id = mc.other_id
  where coalesce(nullif(trim(search), ''), '') = ''
     or p.display_name ilike '%' || search || '%'
     or p.full_name   ilike '%' || search || '%'
     or p.headline    ilike '%' || search || '%'
     or p.profession  ilike '%' || search || '%'
     or p.location    ilike '%' || search || '%'
  order by coalesce(p.display_name, p.full_name) asc nulls last, p.id
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
$$;
revoke all on function public.search_connections(text, int, int) from anon, public;
grant execute on function public.search_connections(text, int, int) to authenticated;
