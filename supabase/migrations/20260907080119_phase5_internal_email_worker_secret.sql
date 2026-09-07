-- Phase 5: shared secret so process_pending_email_outbox() (SQL, via
-- pg_net) can authenticate its call to the send-job-alert-email Edge
-- Function, without using the full service_role key (narrower blast
-- radius: this secret can only trigger email sends, not arbitrary DB
-- access). The SAME value must also be set as an Edge Function secret
-- (INTERNAL_EMAIL_WORKER_SECRET) -- documented in the final report, not
-- done automatically since Edge Function secrets are configured outside
-- SQL migrations.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'internal_email_worker_secret') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'internal_email_worker_secret',
      'Phase 5: shared bearer secret between process_pending_email_outbox() and the send-job-alert-email Edge Function. Must match the Edge Function secret INTERNAL_EMAIL_WORKER_SECRET exactly.'
    );
  end if;
end $$;
