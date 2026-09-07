-- Phase 5: cron-invoked, bounded batch claim + async dispatch to the
-- send-job-alert-email Edge Function (which does the actual Resend call
-- and status update, using its own service-role client). Retry-safe: any
-- row stuck in 'processing' for more than 5 minutes (Edge Function never
-- responded/crashed mid-batch) is reclaimed back to 'pending' with an
-- incremented attempt_count and exponential-ish backoff, BEFORE claiming a
-- new batch -- so a hung invocation cannot strand emails forever. System-
-- only: not reachable by any client role, matching process_pending_new_job_matches.
create or replace function public.process_pending_email_outbox(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_url text;
  v_secret text;
  v_claimed_ids uuid[];
  v_reclaimed int;
  v_max_attempts constant int := 5;
begin
  -- Reclaim stale 'processing' rows (Edge Function invocation never
  -- completed) back to 'pending', with backoff, before claiming fresh work.
  with reclaimed as (
    update public.email_outbox
    set status = case when attempt_count + 1 >= v_max_attempts then 'failed' else 'pending' end,
        attempt_count = attempt_count + 1,
        next_attempt_at = now() + (power(2, least(attempt_count + 1, 6)) || ' minutes')::interval,
        failed_at = case when attempt_count + 1 >= v_max_attempts then now() else failed_at end,
        last_error = case when attempt_count + 1 >= v_max_attempts then 'Exceeded max attempts after stale processing reclaim' else last_error end
    where status = 'processing' and created_at < now() - interval '5 minutes'
    returning 1
  )
  select count(*) into v_reclaimed from reclaimed;

  -- Atomically claim a bounded batch. FOR UPDATE SKIP LOCKED means an
  -- overlapping run (shouldn't happen with a 2-min cron + fast function,
  -- but defensively) can never double-claim the same rows.
  with claimed as (
    update public.email_outbox
    set status = 'processing'
    where id in (
      select id from public.email_outbox
      where status = 'pending' and next_attempt_at <= now()
      order by created_at
      limit greatest(1, least(p_limit, 200))
      for update skip locked
    )
    returning id
  )
  select array_agg(id) into v_claimed_ids from claimed;

  if v_claimed_ids is null or array_length(v_claimed_ids, 1) is null then
    return jsonb_build_object('claimed', 0, 'reclaimed', v_reclaimed, 'dispatched', false);
  end if;

  begin
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'internal_email_worker_secret' limit 1;
  exception when others then
    v_secret := null;
  end;

  if v_secret is null then
    -- Vault secret missing/misconfigured -- put the claimed rows back so
    -- nothing is silently stranded, and report it clearly rather than
    -- attempting a call we know will be unauthenticated.
    update public.email_outbox set status = 'pending' where id = any(v_claimed_ids);
    return jsonb_build_object('claimed', array_length(v_claimed_ids, 1), 'reclaimed', v_reclaimed, 'dispatched', false, 'error', 'internal_email_worker_secret not found in vault');
  end if;

  v_url := 'https://ajbhpqbfcpmztjtxqxxk.supabase.co/functions/v1/send-job-alert-email';

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('outbox_ids', to_jsonb(v_claimed_ids)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret)
  );

  return jsonb_build_object('claimed', array_length(v_claimed_ids, 1), 'reclaimed', v_reclaimed, 'dispatched', true);
end;
$$;

revoke all on function public.process_pending_email_outbox(int) from public, anon, authenticated;
comment on function public.process_pending_email_outbox(int) is 'Phase 5: cron-invoked (every 2 min, see schedule migration). Reclaims stale processing rows, atomically claims a bounded pending batch, dispatches to send-job-alert-email Edge Function via pg_net (async, fire-and-forget). The Edge Function itself does the actual Resend call and status update.';
