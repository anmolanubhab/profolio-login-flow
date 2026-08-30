-- Network → Following & followers list RPCs.
--
-- No schema change: the existing public.followers table (follower_id /
-- following_id -> profiles.id, UNIQUE(follower_id,following_id), self-check,
-- indexes on both columns, owner-scoped INSERT/DELETE RLS) already supports
-- everything. These are read helpers that mirror search_connections: SQL,
-- STABLE SECURITY DEFINER, server-side search + keyset-friendly pagination,
-- and per-row relationship flags so a single query renders the right button
-- (Following / Follow back) with no N+1.

-- ---- people the current user follows --------------------------------------
create or replace function public.list_following(
  search text default '', lim int default 20, off int default 0
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
  followed_at timestamptz,
  is_connected boolean,
  they_follow_me boolean,
  mutual_count int
)
language sql
stable
security definer
set search_path to 'public'
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
    f.created_at as followed_at,
    exists (
      select 1 from public.connections c
      where c.status = 'accepted'
        and ((select pid from me) in (c.user_id, c.connection_id))
        and (p.id in (c.user_id, c.connection_id))
    ) as is_connected,
    exists (
      select 1 from public.followers f2
      where f2.follower_id = p.id and f2.following_id = (select pid from me)
    ) as they_follow_me,
    public.mutual_connections_count(p.id) as mutual_count
  from public.followers f
  join public.profiles p on p.id = f.following_id
  where f.follower_id = (select pid from me)
    and (
      coalesce(nullif(trim(search), ''), '') = ''
      or p.display_name ilike '%' || search || '%'
      or p.full_name   ilike '%' || search || '%'
      or p.headline    ilike '%' || search || '%'
      or p.profession  ilike '%' || search || '%'
      or p.location    ilike '%' || search || '%'
    )
  order by f.created_at desc, p.id
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
$$;

-- ---- people who follow the current user ----------------------------------
create or replace function public.list_followers(
  search text default '', lim int default 20, off int default 0
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
  followed_at timestamptz,
  is_connected boolean,
  i_follow_them boolean,
  mutual_count int
)
language sql
stable
security definer
set search_path to 'public'
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
    f.created_at as followed_at,
    exists (
      select 1 from public.connections c
      where c.status = 'accepted'
        and ((select pid from me) in (c.user_id, c.connection_id))
        and (p.id in (c.user_id, c.connection_id))
    ) as is_connected,
    exists (
      select 1 from public.followers f2
      where f2.follower_id = (select pid from me) and f2.following_id = p.id
    ) as i_follow_them,
    public.mutual_connections_count(p.id) as mutual_count
  from public.followers f
  join public.profiles p on p.id = f.follower_id
  where f.following_id = (select pid from me)
    and (
      coalesce(nullif(trim(search), ''), '') = ''
      or p.display_name ilike '%' || search || '%'
      or p.full_name   ilike '%' || search || '%'
      or p.headline    ilike '%' || search || '%'
      or p.profession  ilike '%' || search || '%'
      or p.location    ilike '%' || search || '%'
    )
  order by f.created_at desc, p.id
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
$$;

-- ---- counts for the rail / sub-header ------------------------------------
create or replace function public.follow_counts()
returns table (following_count int, followers_count int)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    (select count(*) from public.followers where follower_id  = public.current_profile_id())::int,
    (select count(*) from public.followers where following_id = public.current_profile_id())::int;
$$;

-- Per-user "my network" helpers -- no anon access, matching
-- network_counts / search_connections. Revoke from PUBLIC (anon inherits it).
revoke execute on function public.list_following(text, int, int) from public;
revoke execute on function public.list_followers(text, int, int) from public;
revoke execute on function public.follow_counts()               from public;
grant  execute on function public.list_following(text, int, int) to authenticated;
grant  execute on function public.list_followers(text, int, int) to authenticated;
grant  execute on function public.follow_counts()               to authenticated;
