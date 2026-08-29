-- Network Phase 1: schema support for a LinkedIn-style networking center

-- 1. pg_trgm for fuzzy people search
create extension if not exists pg_trgm;

-- 2. connections.updated_at + maintenance trigger (reuses existing helper)
alter table public.connections add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_connections_updated_at on public.connections;
create trigger set_connections_updated_at
  before update on public.connections
  for each row execute function public.update_updated_at_column();

-- 3. Direction-agnostic uniqueness (prevents A->B and B->A both existing)
create unique index if not exists connections_unique_undirected
  on public.connections (least(user_id, connection_id), greatest(user_id, connection_id));

-- 4. Dismissed "People you may know" suggestions
create table if not exists public.dismissed_suggestions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dismissed_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dismissed_suggestions_not_self check (profile_id <> dismissed_profile_id),
  constraint dismissed_suggestions_unique unique (profile_id, dismissed_profile_id)
);
alter table public.dismissed_suggestions enable row level security;

drop policy if exists dismissed_suggestions_manage_own on public.dismissed_suggestions;
create policy dismissed_suggestions_manage_own on public.dismissed_suggestions
  for all
  using (public.current_profile_id() = profile_id)
  with check (public.current_profile_id() = profile_id);

create index if not exists idx_dismissed_suggestions_profile on public.dismissed_suggestions(profile_id);

-- 5. People-search trigram indexes
create index if not exists idx_profiles_display_name_trgm on public.profiles using gin (display_name gin_trgm_ops);
create index if not exists idx_profiles_full_name_trgm   on public.profiles using gin (full_name gin_trgm_ops);
create index if not exists idx_profiles_headline_trgm    on public.profiles using gin (headline gin_trgm_ops);
create index if not exists idx_profiles_profession_trgm  on public.profiles using gin (profession gin_trgm_ops);
create index if not exists idx_profiles_location_trgm    on public.profiles using gin (location gin_trgm_ops);

-- 6. Remove a connection from either side
--    (the connections ALL policy only lets the user_id side delete its row)
create or replace function public.remove_connection(other_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_profile_id();
  deleted int;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  delete from public.connections
   where (user_id = me and connection_id = other_profile_id)
      or (user_id = other_profile_id and connection_id = me);
  get diagnostics deleted = row_count;

  -- clear any lingering friend_requests between the two so they can reconnect later
  delete from public.friend_requests
   where (sender_id = me and receiver_id = other_profile_id)
      or (sender_id = other_profile_id and receiver_id = me);

  return deleted > 0;
end;
$$;
revoke all on function public.remove_connection(uuid) from public;
grant execute on function public.remove_connection(uuid) to authenticated;

-- 7. Mutual-connections count between the caller and another profile (aggregate only)
create or replace function public.mutual_connections_count(other_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.current_profile_id() as pid),
  me_conns as (
    select case when c.user_id = (select pid from me) then c.connection_id else c.user_id end as pid
    from public.connections c
    where c.status = 'accepted'
      and ((select pid from me) in (c.user_id, c.connection_id))
  ),
  other_conns as (
    select case when c.user_id = other_profile_id then c.connection_id else c.user_id end as pid
    from public.connections c
    where c.status = 'accepted'
      and (other_profile_id in (c.user_id, c.connection_id))
  )
  select count(*)::int
  from me_conns m
  join other_conns o on o.pid = m.pid
  where m.pid <> (select pid from me) and m.pid <> other_profile_id;
$$;
revoke all on function public.mutual_connections_count(uuid) from public;
grant execute on function public.mutual_connections_count(uuid) to authenticated;

-- 8. One-shot counts for the Network left rail
create or replace function public.network_counts()
returns table (connections_count int, pending_received int, pending_sent int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.connections c
       where c.status = 'accepted'
         and ((select public.current_profile_id()) in (c.user_id, c.connection_id)))::int,
    (select count(*) from public.friend_requests fr
       where fr.receiver_id = (select public.current_profile_id()) and fr.status = 'pending')::int,
    (select count(*) from public.friend_requests fr
       where fr.sender_id = (select public.current_profile_id()) and fr.status = 'pending')::int;
$$;
revoke all on function public.network_counts() from public;
grant execute on function public.network_counts() to authenticated;
