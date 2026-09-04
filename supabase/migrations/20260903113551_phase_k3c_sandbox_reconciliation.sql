-- =====================================================================
-- Phase K3-C Stripe Sandbox Preparation — task 7
-- Scheduled reconciliation + monitoring. Pure server-side SQL.
--
--   * pg_cron + pg_net enabled (approved).
--   * _ad_billing_ops_sweep(): one detection pass over every monitored
--     signal. Read-only against financial data — it NEVER settles,
--     resolves, or fabricates a transaction. Writes findings to
--     ad_billing_ops_log only. Overlap-guarded (advisory lock),
--     idempotent (re-running just re-reads and re-logs).
--   * _ad_billing_alert_dispatch(): OPTIONAL outbound alerting. Inert
--     unless a Vault secret `ad_ops_alert_webhook_url` exists. The URL is
--     read from Vault at call time — never stored in SQL text, cron
--     metadata, or logs. No inbound endpoint, no service-role bridge.
--   * Provider-status reconciliation (Stripe getPaymentStatus) is NOT
--     driven from SQL — it needs the Stripe secret and stays in the
--     admin-authed ad-billing-reconcile edge function (to be wired to a
--     Dashboard Scheduled Function at task 10). The sweep only DETECTS
--     and flags stuck rows for it.
--
-- No Stripe keys here. No ad_provider_config change. All money-moving
-- RPCs stay revoked from client roles. RLS unchanged.
-- =====================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- config (single row) ----------------------------------
create table if not exists public.ad_billing_ops_config (
  id                        int primary key default 1 check (id = 1),
  stuck_minutes             int not null default 30  check (stuck_minutes  > 0),
  webhook_fail_window_mins  int not null default 60  check (webhook_fail_window_mins > 0),
  lookback_hours            int not null default 24  check (lookback_hours > 0),
  -- retention for a FUTURE webhook-events prune (not implemented — see notes)
  webhook_retain_days       int not null default 90  check (webhook_retain_days >= 7),
  updated_at                timestamptz not null default now()
);
insert into public.ad_billing_ops_config (id) values (1) on conflict (id) do nothing;

alter table public.ad_billing_ops_config enable row level security;
drop policy if exists ad_billing_ops_config_admin_select on public.ad_billing_ops_config;
create policy ad_billing_ops_config_admin_select on public.ad_billing_ops_config
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ---------- ops log --------------------------------------------
create table if not exists public.ad_billing_ops_log (
  id                   uuid primary key default gen_random_uuid(),
  sweep_id             uuid not null,
  ran_at               timestamptz not null default now(),
  kind                 text not null,
  severity             text not null check (severity in ('info','warning','critical')),
  summary              text not null,
  details              jsonb not null default '{}'::jsonb,
  alert_dispatched_at  timestamptz
);
create index if not exists ad_billing_ops_log_ran_at_idx on public.ad_billing_ops_log (ran_at desc);
create index if not exists ad_billing_ops_log_sev_idx on public.ad_billing_ops_log (severity, ran_at desc);

alter table public.ad_billing_ops_log enable row level security;
drop policy if exists ad_billing_ops_log_admin_select on public.ad_billing_ops_log;
create policy ad_billing_ops_log_admin_select on public.ad_billing_ops_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ---------- the sweep -----------------------------------------
create or replace function public._ad_billing_ops_sweep()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _sid uuid := gen_random_uuid();
  _cfg public.ad_billing_ops_config;
  _stuck_pending int; _stuck_processing int;
  _wh_fail int; _holds int; _failed_pay int; _failed_refund int;
  _disputes int; _provider_errs int;
  _drift jsonb; _drift_bad int;
  _sev text := 'info'; _worst text := 'info';
  _details jsonb;
begin
  -- prevent overlapping runs (transaction-scoped advisory lock)
  if not pg_try_advisory_xact_lock(hashtext('ad_billing_ops_sweep')) then
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'sweep', 'info', 'skipped: another sweep is running', '{}'::jsonb);
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;

  select * into _cfg from public.ad_billing_ops_config where id = 1;
  if not found then _cfg.stuck_minutes := 30; _cfg.webhook_fail_window_mins := 60; _cfg.lookback_hours := 24; end if;

  -- 1/3. stuck pending / processing charge transactions
  select count(*) into _stuck_pending
  from public.ad_billing_transactions
  where txn_type = 'charge' and status = 'pending'
    and created_at < now() - make_interval(mins => _cfg.stuck_minutes);
  select count(*) into _stuck_processing
  from public.ad_billing_transactions
  where txn_type = 'charge' and status = 'processing'
    and created_at < now() - make_interval(mins => _cfg.stuck_minutes);

  -- 6. failed webhook signature verification (recent)
  select count(*) into _wh_fail
  from public.ad_billing_webhook_events
  where signature_valid = false
    and received_at > now() - make_interval(mins => _cfg.webhook_fail_window_mins);

  -- 8. accounts on billing hold
  select count(*) into _holds from public.ad_account_billing_state where hold = true;

  -- 7 (disputes) + 9 (failed payments) + 10 (failed refunds) + 11 (provider errors), within lookback
  select count(*) into _disputes
  from public.ad_billing_events
  where event_type = 'account_hold' and (metadata ? 'dispute_ref')
    and created_at > now() - make_interval(hours => _cfg.lookback_hours);
  select count(*) into _failed_pay
  from public.ad_billing_transactions
  where txn_type = 'charge' and status = 'failed'
    and updated_at > now() - make_interval(hours => _cfg.lookback_hours);
  select count(*) into _failed_refund
  from public.ad_billing_transactions
  where txn_type = 'refund' and status in ('failed','canceled')
    and updated_at > now() - make_interval(hours => _cfg.lookback_hours);
  select count(*) into _provider_errs
  from public.ad_billing_events
  where event_type = 'billing_adjustment'
    and (summary ilike '%reconciliation%' or summary ilike '%deferred%' or (metadata ? 'sqlstate'))
    and created_at > now() - make_interval(hours => _cfg.lookback_hours);

  -- 5. reconciliation drift (invariant check, per account)
  with per_acct as (
    select a.id,
      coalesce((select sum(se.cost_micros) from public.ad_spend_events se where se.ad_account_id = a.id and se.cost_micros > 0), 0) as spend_micros,
      coalesce((select sum(l.amount_micros) from public.ad_billing_ledger l where l.ad_account_id = a.id and l.entry_type = 'spend_accrued'), 0) as ledger_spend_micros,
      coalesce((select sum(l.amount_micros) from public.ad_billing_ledger l where l.ad_account_id = a.id and l.is_test), 0) as test_ledger_sum,
      coalesce(s.test_outstanding_micros, 0) as state_test_out,
      coalesce((select sum(l.amount_micros) from public.ad_billing_ledger l where l.ad_account_id = a.id and not l.is_test), 0) as live_ledger_sum,
      coalesce(s.outstanding_micros, 0) as state_live_out,
      coalesce((select count(*) from public.ad_invoices i where i.ad_account_id = a.id and i.transaction_id is null), 0) as invoices_without_txn,
      coalesce((select count(*) from public.ad_billing_transactions t where t.ad_account_id = a.id and t.txn_type <> 'refund' and coalesce(t.refunded_amount_cents,0) > t.amount_cents), 0) as over_refunded,
      (select bool_and(ok) from (
        select l.balance_after_micros
             = coalesce(lag(l.balance_after_micros) over (partition by l.is_test order by l.created_at, l.id), 0) + l.amount_micros as ok
        from public.ad_billing_ledger l where l.ad_account_id = a.id
      ) c) as chain_ok
    from public.ad_accounts a
    left join public.ad_account_billing_state s on s.ad_account_id = a.id
    where exists (select 1 from public.ad_billing_ledger l where l.ad_account_id = a.id) or s.ad_account_id is not null
  )
  select
    coalesce(jsonb_agg(to_jsonb(p) order by p.id) filter (where
      p.spend_micros <> p.ledger_spend_micros
      or p.test_ledger_sum <> p.state_test_out
      or p.live_ledger_sum <> p.state_live_out
      or p.invoices_without_txn > 0
      or p.over_refunded > 0
      or coalesce(p.chain_ok, true) = false
    ), '[]'::jsonb),
    count(*) filter (where
      p.spend_micros <> p.ledger_spend_micros
      or p.test_ledger_sum <> p.state_test_out
      or p.live_ledger_sum <> p.state_live_out
      or p.invoices_without_txn > 0
      or p.over_refunded > 0
      or coalesce(p.chain_ok, true) = false
    )
  into _drift, _drift_bad
  from per_acct p;

  -- per-finding log rows (only when non-zero)
  if _stuck_pending > 0 then
    _sev := 'warning';
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'stuck_pending', _sev,
      _stuck_pending || ' charge transaction(s) stuck in pending > ' || _cfg.stuck_minutes || ' min — provider-status check required',
      jsonb_build_object('count', _stuck_pending, 'threshold_minutes', _cfg.stuck_minutes));
  end if;
  if _stuck_processing > 0 then
    _sev := 'warning';
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'stuck_processing', _sev,
      _stuck_processing || ' charge transaction(s) stuck in processing > ' || _cfg.stuck_minutes || ' min — provider-status check required',
      jsonb_build_object('count', _stuck_processing, 'threshold_minutes', _cfg.stuck_minutes));
  end if;
  if _wh_fail > 0 then
    _sev := 'warning';
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'webhook_verification_failures', _sev,
      _wh_fail || ' webhook(s) failed signature verification in the last ' || _cfg.webhook_fail_window_mins || ' min',
      jsonb_build_object('count', _wh_fail, 'window_minutes', _cfg.webhook_fail_window_mins));
  end if;
  if _disputes > 0 then
    _sev := 'critical';
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'disputes', _sev,
      _disputes || ' dispute/chargeback event(s) in the last ' || _cfg.lookback_hours || 'h',
      jsonb_build_object('count', _disputes, 'window_hours', _cfg.lookback_hours));
  end if;
  if _holds > 0 then
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'account_holds', 'warning',
      _holds || ' ad account(s) currently on billing hold',
      jsonb_build_object('count', _holds));
    if _sev = 'info' then _sev := 'warning'; end if;
  end if;
  if _failed_pay > 0 then
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'failed_payments', 'warning',
      _failed_pay || ' failed payment(s) in the last ' || _cfg.lookback_hours || 'h',
      jsonb_build_object('count', _failed_pay, 'window_hours', _cfg.lookback_hours));
    if _sev = 'info' then _sev := 'warning'; end if;
  end if;
  if _failed_refund > 0 then
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'failed_refunds', 'warning',
      _failed_refund || ' failed/canceled refund(s) in the last ' || _cfg.lookback_hours || 'h',
      jsonb_build_object('count', _failed_refund, 'window_hours', _cfg.lookback_hours));
    if _sev = 'info' then _sev := 'warning'; end if;
  end if;
  if _provider_errs > 0 then
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'provider_errors', 'warning',
      _provider_errs || ' deferred/reconciliation marker event(s) in the last ' || _cfg.lookback_hours || 'h',
      jsonb_build_object('count', _provider_errs, 'window_hours', _cfg.lookback_hours));
    if _sev = 'info' then _sev := 'warning'; end if;
  end if;
  if _drift_bad > 0 then
    _sev := 'critical';
    insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
    values (_sid, 'reconciliation_drift', 'critical',
      _drift_bad || ' account(s) failed a financial invariant (spend<->ledger, ledger<->state, chain, invoice link, refund cap)',
      jsonb_build_object('accounts', _drift));
  end if;

  -- worst severity for the rollup
  _worst := case when _drift_bad > 0 or _disputes > 0 then 'critical'
                 when _stuck_pending > 0 or _stuck_processing > 0 or _wh_fail > 0 or _holds > 0
                      or _failed_pay > 0 or _failed_refund > 0 or _provider_errs > 0 then 'warning'
                 else 'info' end;

  _details := jsonb_build_object(
    'stuck_pending', _stuck_pending, 'stuck_processing', _stuck_processing,
    'webhook_verification_failures', _wh_fail, 'account_holds', _holds,
    'failed_payments', _failed_pay, 'failed_refunds', _failed_refund,
    'disputes', _disputes, 'provider_error_markers', _provider_errs,
    'reconciliation_drift_accounts', _drift_bad
  );
  insert into public.ad_billing_ops_log (sweep_id, kind, severity, summary, details)
  values (_sid, 'sweep', _worst,
    case when _worst = 'info' then 'ops sweep clean' else 'ops sweep found ' || _worst || '-level issue(s)' end,
    _details);

  return jsonb_build_object('ok', true, 'sweep_id', _sid, 'severity', _worst, 'details', _details);
end;
$$;
revoke all on function public._ad_billing_ops_sweep() from public, anon, authenticated;

-- ---------- optional outbound alerting (inert until configured) ----
create or replace function public._ad_billing_alert_dispatch()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare _url text; _row public.ad_billing_ops_log; _n int := 0;
begin
  begin
    select decrypted_secret into _url from vault.decrypted_secrets where name = 'ad_ops_alert_webhook_url' limit 1;
  exception when others then
    return jsonb_build_object('dispatched', 0, 'note', 'vault not available; alerting inert');
  end;
  if _url is null or btrim(_url) = '' then
    return jsonb_build_object('dispatched', 0, 'note', 'no ad_ops_alert_webhook_url vault secret; alerting inert');
  end if;

  for _row in
    select * from public.ad_billing_ops_log
    where severity in ('warning','critical')
      and alert_dispatched_at is null
      and ran_at > now() - interval '1 day'
    order by ran_at
  loop
    perform net.http_post(
      url := _url,
      body := jsonb_build_object(
        'text', '[ad-billing] ' || _row.severity || ': ' || _row.summary,
        'severity', _row.severity, 'kind', _row.kind, 'sweep_id', _row.sweep_id,
        'ran_at', _row.ran_at, 'details', _row.details
      ),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
    update public.ad_billing_ops_log set alert_dispatched_at = now() where id = _row.id;
    _n := _n + 1;
  end loop;

  return jsonb_build_object('dispatched', _n);
end;
$$;
revoke all on function public._ad_billing_alert_dispatch() from public, anon, authenticated;

-- ---------- reconciliation health RPC for the dashboard (admin) ----
create or replace function public.ad_billing_ops_recent(_limit int default 50)
returns setof public.ad_billing_ops_log
language sql
stable
security definer
set search_path to 'public'
as $$
  select * from public.ad_billing_ops_log
  where public.has_role(auth.uid(), 'admin')
  order by ran_at desc
  limit greatest(1, least(coalesce(_limit, 50), 500));
$$;
revoke all on function public.ad_billing_ops_recent(int) from public, anon;
grant execute on function public.ad_billing_ops_recent(int) to authenticated;

-- ---------- schedule (cron command carries NO secrets) ------------
select cron.schedule('ad-billing-ops-sweep',  '*/10 * * * *', $$ select public._ad_billing_ops_sweep(); $$);
select cron.schedule('ad-billing-ops-alert',  '*/5 * * * *',  $$ select public._ad_billing_alert_dispatch(); $$);

-- =====================================================================
-- WEBHOOK RETENTION — ASSESSMENT (no pruning implemented)
--
-- ad_billing_webhook_events is protected by trigger
-- _ad_billing_webhook_events_guard, which RAISES on every DELETE.
-- Implementing a prune now would require weakening that immutability
-- guarantee — a security regression and an explicit STOP condition for
-- this task. It is also not required for sandbox: the table is tiny and
-- the ad-billing-webhook rate limiter (task 3) blunts the growth vector.
--
-- Recommended FUTURE design (separate, gated change):
--   * a GUC-guarded delete path (like ad.billing_bypass), service-role
--     only, invoked by a dedicated prune function;
--   * delete ONLY rows where processed = true AND signature_valid = true
--     AND received_at < now() - (ad_billing_ops_config.webhook_retain_days);
--   * NEVER delete unprocessed, errored, or invalid-signature rows;
--   * retention is already configurable via
--     ad_billing_ops_config.webhook_retain_days (default 90).
-- =====================================================================
