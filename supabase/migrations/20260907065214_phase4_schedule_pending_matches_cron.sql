-- Phase 4: reliable, deferred invocation -- runs every 2 minutes regardless
-- of whether the recruiter's immediate post-publish call succeeded, so a
-- new job's strong-match notifications are guaranteed within ~2 minutes
-- even if that call was skipped/failed/the browser closed. Matches the
-- existing pg_cron pattern already used in this project (ad-billing-ops-*).
select cron.schedule(
  'process-new-job-matches',
  '*/2 * * * *',
  $$select public.process_pending_new_job_matches(20, 200)$$
);
