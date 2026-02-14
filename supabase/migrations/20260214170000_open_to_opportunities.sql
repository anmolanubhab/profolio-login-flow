-- Profiles: Open to Opportunities feature
-- Adds new columns, index, and RLS policy for self-updates

-- Columns
alter table if exists public.profiles
  add column if not exists open_to_work boolean not null default false,
  add column if not exists open_to_roles text[] default '{}'::text[],
  add column if not exists preferred_locations text[] default '{}'::text[],
  add column if not exists job_type text[] default '{}'::text[],
  add column if not exists expected_salary text,
  add column if not exists notice_period text,
  add column if not exists open_to_work_visibility text not null default 'recruiters';

-- Visibility constraint
alter table if exists public.profiles
  add constraint profiles_open_to_work_visibility_chk
  check (open_to_work_visibility in ('public','recruiters','private'));

-- Index for recruiters
create index if not exists idx_profiles_open_to_work
  on public.profiles (open_to_work);

-- Enable RLS (no-op if already enabled)
alter table if exists public.profiles enable row level security;

-- Allow users to update only their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Allow users to update own profile'
  ) then
    create policy "Allow users to update own profile"
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

