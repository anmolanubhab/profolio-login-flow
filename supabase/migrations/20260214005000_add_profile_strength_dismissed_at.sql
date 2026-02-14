alter table public.profiles
  add column if not exists profile_strength_dismissed_at timestamptz;

comment on column public.profiles.profile_strength_dismissed_at is 'When profile strength card was last dismissed';
