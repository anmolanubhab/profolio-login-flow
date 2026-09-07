-- Job Matching Phase 1: additive candidate preference columns on profiles.
-- Reuses existing profiles.open_to_work / open_to_roles / preferred_locations /
-- job_type / expected_salary as-is (confirmed present via live schema audit).
-- Only adds the genuinely missing pieces.

alter table public.profiles
  add column if not exists preferred_work_modes text[] not null default '{}'::text[],
  add column if not exists preferred_industries text[] not null default '{}'::text[],
  add column if not exists actively_looking boolean not null default false,
  add column if not exists salary_min_expected numeric,
  add column if not exists salary_max_expected numeric,
  add column if not exists salary_currency text;

comment on column public.profiles.preferred_work_modes is 'Job matching: candidate-selected work modes, e.g. {remote,hybrid,onsite}. New in job-matching feature.';
comment on column public.profiles.preferred_industries is 'Job matching: candidate-selected preferred industries. New in job-matching feature.';
comment on column public.profiles.actively_looking is 'Job matching: distinct from open_to_work (visible to others) -- drives how aggressively new-job notifications/recommendations are surfaced to this candidate.';
comment on column public.profiles.salary_min_expected is 'Job matching: structured minimum expected salary. Does not replace or parse the existing free-text expected_salary column.';
comment on column public.profiles.salary_max_expected is 'Job matching: structured maximum expected salary.';
comment on column public.profiles.salary_currency is 'Job matching: ISO-ish currency code/label paired with salary_min_expected/salary_max_expected.';
