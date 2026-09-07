-- Job Matching Phase 1: additive structured requirement columns on jobs.
-- jobs.remote_option and jobs.employment_type already exist (free text) and
-- are handled separately (audited + constrained in their own migration).
-- No structured experience/industry columns exist today -- everything about
-- them currently lives only in the free-text `requirements` column.

alter table public.jobs
  add column if not exists industry text,
  add column if not exists min_experience_years numeric,
  add column if not exists max_experience_years numeric,
  add column if not exists experience_level text;

comment on column public.jobs.industry is 'Job matching: structured industry for a job posting. Free-text requirements column is untouched.';
comment on column public.jobs.min_experience_years is 'Job matching: minimum years of experience required (mandatory eligibility check).';
comment on column public.jobs.max_experience_years is 'Job matching: maximum years of experience the role targets (used for scoring, not eligibility).';
comment on column public.jobs.experience_level is 'Job matching: normalized experience bucket, e.g. entry/mid/senior. Paired with min/max_experience_years for fast filtering.';
