-- Server-side, paginated, searchable connections list for the Network > Connections tab.
create or replace function public.search_connections(
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
revoke all on function public.search_connections(text, int, int) from public;
grant execute on function public.search_connections(text, int, int) to authenticated;
