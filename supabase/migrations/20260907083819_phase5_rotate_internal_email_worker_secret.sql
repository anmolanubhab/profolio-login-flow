-- Rotates the internal_email_worker_secret because its value was previously
-- disclosed in an implementation report (never treat that old value as
-- production-safe). Rotated in place by id/name so
-- process_pending_email_outbox() (which looks it up by name) needs no
-- change. The new value is never returned by this migration/report -- the
-- caller must fetch it separately and set it directly in the Edge Function
-- secret, without it ever appearing in chat/logs again.
select vault.update_secret(
  '69be0a1b-9982-41dc-96a8-b0bedc03c2d0'::uuid,
  encode(gen_random_bytes(32), 'hex'),
  'internal_email_worker_secret',
  'Shared secret for pg_net -> send-job-alert-email Edge Function auth (rotated after prior disclosure in a chat report)'
);