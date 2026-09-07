-- Phase 4: DB-level idempotency for new_job match notifications. Logical
-- key is candidate_user_id + job_id + type, per requirement -- a partial
-- unique index scoped to type='new_job' so it never affects any other
-- notification type's semantics (job_application_received, etc. can still
-- have multiple rows per user/job as today).
create unique index if not exists uniq_new_job_notification
  on public.notifications (user_id, ((payload->>'job_id')))
  where type = 'new_job';

-- Small, single-point configurable threshold per "configurable constant
-- where practical" -- change this one function instead of hunting through
-- matching logic later.
create or replace function public.strong_match_threshold()
returns numeric
language sql
immutable
set search_path to 'public'
as $$
  select 80::numeric;
$$;

revoke execute on function public.strong_match_threshold() from public;
grant execute on function public.strong_match_threshold() to authenticated;

comment on function public.strong_match_threshold() is 'Phase 4: single editable point for the "strong match" notification threshold (score >= this AND eligibility_status = eligible). Currently 80.';
