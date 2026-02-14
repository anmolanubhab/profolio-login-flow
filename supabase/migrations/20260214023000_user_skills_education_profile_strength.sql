create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  skill_name text not null,
  level text check (level in ('beginner','intermediate','expert')) null,
  years integer null,
  created_at timestamptz not null default now()
);

create unique index if not exists user_skills_user_skill_unique
on public.user_skills (user_id, lower(skill_name));

create table if not exists public.user_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  institution text not null,
  degree text null,
  field text null,
  start_year integer null,
  end_year integer null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

alter table if exists public.profiles
  add column if not exists profile_strength integer;

alter table if exists public.user_skills enable row level security;
alter table if exists public.user_education enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_skills' and policyname = 'Allow own read'
  ) then
    create policy "Allow own read" on public.user_skills
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_skills' and policyname = 'Allow own insert'
  ) then
    create policy "Allow own insert" on public.user_skills
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_skills' and policyname = 'Allow own update'
  ) then
    create policy "Allow own update" on public.user_skills
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_skills' and policyname = 'Allow own delete'
  ) then
    create policy "Allow own delete" on public.user_skills
      for delete using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_education' and policyname = 'Allow own read'
  ) then
    create policy "Allow own read" on public.user_education
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_education' and policyname = 'Allow own insert'
  ) then
    create policy "Allow own insert" on public.user_education
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_education' and policyname = 'Allow own update'
  ) then
    create policy "Allow own update" on public.user_education
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_education' and policyname = 'Allow own delete'
  ) then
    create policy "Allow own delete" on public.user_education
      for delete using (auth.uid() = user_id);
  end if;
end $$;
