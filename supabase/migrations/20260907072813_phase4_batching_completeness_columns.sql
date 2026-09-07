-- Fix for confirmed completeness gap: matches_processed_at was set after
-- ONE bounded 200-candidate batch and never cleared, so any candidate
-- beyond the first 200 (by last_active_at) was permanently unreachable --
-- the cron's `WHERE matches_processed_at IS NULL` predicate excluded the
-- job from every future run. Adding a cursor + an explicit completion flag
-- so the cron can resume a job across multiple bounded batches until its
-- whole coarse-filtered candidate pool is exhausted.
alter table public.jobs
  add column if not exists matches_processed_offset int not null default 0,
  add column if not exists matches_fully_processed boolean not null default false;

comment on column public.jobs.matches_processed_offset is 'Phase 4 batching: how many candidates (in the coarse-filtered pool''s deterministic order) have been evaluated so far for this job. Advanced by each cron batch until matches_fully_processed.';
comment on column public.jobs.matches_fully_processed is 'Phase 4 batching: true once a batch returned fewer candidates than the batch size (pool exhausted) -- only then does the job stop appearing in the pending-jobs cron query.';

drop index if exists idx_jobs_matches_pending;
create index if not exists idx_jobs_matches_pending on public.jobs (posted_at) where status = 'open' and matches_fully_processed = false;
