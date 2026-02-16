create extension if not exists "pgcrypto";

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamp with time zone default now(),
  unique (group_id, user_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Enable Realtime for these tables if publication exists
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.groups';
    execute 'alter publication supabase_realtime add table public.group_members';
  end if;
exception when others then
  -- ignore if cannot alter publication
  null;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'groups' and policyname = 'groups_select_all') then
    create policy groups_select_all on public.groups for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'groups' and policyname = 'groups_insert_auth') then
    create policy groups_insert_auth on public.groups for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'groups' and policyname = 'groups_update_owner') then
    create policy groups_update_owner on public.groups for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'group_members' and policyname = 'gm_select_all') then
    create policy gm_select_all on public.group_members for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'group_members' and policyname = 'gm_insert_self') then
    create policy gm_insert_self on public.group_members for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'group_members' and policyname = 'gm_delete_self_or_owner') then
    create policy gm_delete_self_or_owner on public.group_members for delete using (auth.uid() = user_id or auth.uid() in (select owner_user_id from public.groups g where g.id = group_id));
  end if;
end $$;
