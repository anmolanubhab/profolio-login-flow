-- User emails table for multi-email support
create table if not exists public.user_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  is_primary boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_emails_user on public.user_emails(user_id);

-- Additional profile flags
alter table public.profiles add column if not exists phone_verified boolean default false;
alter table public.profiles add column if not exists remember_browser boolean default true;

comment on table public.user_emails is 'Stores multiple emails for a user';
comment on column public.profiles.phone_verified is 'Whether phone number has been verified';
comment on column public.profiles.remember_browser is 'Allow this browser to remain signed in';
