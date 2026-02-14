-- Add columns if not exists
alter table public.profiles add column if not exists remember_devices boolean default true;
alter table public.profiles add column if not exists two_factor_enabled boolean default false;
alter table public.profiles add column if not exists two_factor_type text;
alter table public.profiles add column if not exists app_lock_enabled boolean default false;

-- Passkeys storage
create table if not exists public.user_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  credential_id text not null,
  device_name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_passkeys_user on public.user_passkeys(user_id);

-- User sessions log
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_id text not null,
  device_name text,
  user_agent text,
  last_active timestamptz not null default now(),
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_sessions_user on public.user_sessions(user_id);

-- Two-factor (TOTP)
create table if not exists public.user_twofactor (
  user_id uuid primary key,
  method text not null,
  totp_secret text,
  created_at timestamptz not null default now()
);

-- Recovery codes (hashed)
create table if not exists public.user_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code_hash text not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_recovery_user on public.user_recovery_codes(user_id);

comment on table public.user_passkeys is 'WebAuthn credential registry';
comment on table public.user_sessions is 'Client-maintained session list';
comment on table public.user_twofactor is '2FA configuration storage';
comment on table public.user_recovery_codes is 'Hashed recovery codes for 2FA';
