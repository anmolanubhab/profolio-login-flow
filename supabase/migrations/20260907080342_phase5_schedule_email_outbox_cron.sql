-- Separate cron entry (same 2-minute cadence as the Phase 4 matching
-- poller, but a distinct concern -- matches the existing ad-billing-ops-*
-- pattern of separate jobs per concern rather than merging unrelated work).
select cron.schedule(
  'process-email-outbox',
  '*/2 * * * *',
  $$select public.process_pending_email_outbox(50)$$
);
