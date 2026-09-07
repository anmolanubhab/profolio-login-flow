-- Phase 4: bookkeeping for the deferred/background matching pipeline.
-- NULL = not yet processed for candidate notifications; a scheduled poller
-- (pg_cron, see later migration) picks up unprocessed open jobs in bounded
-- batches. This replaces the old synchronous on_job_posted trigger, which
-- is being dropped for spamming every profile with zero matching logic.
alter table public.jobs
  add column if not exists matches_processed_at timestamptz;

comment on column public.jobs.matches_processed_at is 'Phase 4: set once process_new_job_matches (manual, post-publish) or the pg_cron poller (process_pending_new_job_matches) has evaluated this job for strong-match candidate notifications. NULL = pending.';

create index if not exists idx_jobs_matches_pending on public.jobs (posted_at) where status = 'open' and matches_processed_at is null;
