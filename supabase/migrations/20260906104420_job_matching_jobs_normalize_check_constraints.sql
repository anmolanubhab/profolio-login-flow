-- Job Matching Phase 1: constrain jobs.remote_option / jobs.employment_type
-- to the values the app's own UI (PostJobDialog.tsx) already produces.
-- Audited live data first: existing rows are 'full-time','internship'
-- (employment_type) and 'on-site' (remote_option) -- all already within
-- this set. No rewrite of any existing row is performed.
-- NOT VALID first (no table scan / no risk to writes), then VALIDATE
-- separately so a failure is visible and isolated from the ADD step.

alter table public.jobs
  add constraint jobs_employment_type_check
  check (employment_type is null or employment_type in ('full-time','part-time','contract','internship'))
  not valid;

alter table public.jobs
  add constraint jobs_remote_option_check
  check (remote_option is null or remote_option in ('on-site','remote','hybrid'))
  not valid;

alter table public.jobs validate constraint jobs_employment_type_check;
alter table public.jobs validate constraint jobs_remote_option_check;
