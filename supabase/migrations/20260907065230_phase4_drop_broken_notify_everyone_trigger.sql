-- Approved by user: retire the old synchronous, unbounded "notify every
-- profile in the database" trigger. It ran inside the jobs INSERT
-- transaction with zero matching/eligibility/consent logic (see audit).
-- The 32 existing notification rows it already created remain untouched
-- (explicit instruction: do not delete/modify existing production data).
-- Replaced by process_new_job_matches() (immediate, recruiter-invoked) +
-- process_pending_new_job_matches() (pg_cron, every 2 min, reliable
-- fallback) -- both scoped to real eligible strong matches only.
drop trigger if exists on_job_posted on public.jobs;
drop function if exists public.notify_new_job();
