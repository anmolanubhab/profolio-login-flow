-- Phase K3-C Remediation R5: test vs live financial data segregation.
-- Every financial row created while ad_provider_config.test_mode = true is
-- flagged is_test. Account balances are split: outstanding_micros /
-- lifetime_paid_micros are the LIVE totals; test_* mirror the simulated
-- activity. The current (all-simulated) balances are moved into test_* and
-- the live totals start at zero so K3-B test money can never become real
-- production purchasing power. Nothing is deleted.

alter table public.ad_billing_ledger       add column is_test boolean not null default true;
alter table public.ad_billing_transactions add column is_test boolean not null default true;
alter table public.ad_invoices             add column is_test boolean not null default true;

alter table public.ad_account_billing_state
  add column test_outstanding_micros   bigint not null default 0,
  add column test_lifetime_paid_micros bigint not null default 0 check (test_lifetime_paid_micros >= 0);

-- one-time migration: all existing ledger history is simulated/test, so move
-- the balances into the test_* columns and zero the live totals.
update public.ad_account_billing_state
   set test_outstanding_micros   = outstanding_micros,
       test_lifetime_paid_micros = lifetime_paid_micros,
       outstanding_micros = 0,
       lifetime_paid_micros = 0,
       updated_at = now();

-- ledger poster routes by test_mode; balance chain is per-class (E1: the
-- idempotency guards are re-checked inside the account lock so a concurrent
-- duplicate is a clean no-op, not a unique_violation).
create or replace function public._ad_billing_post_ledger(
  _ad_account_id uuid, _entry_type text, _amount_micros bigint, _currency text,
  _idempotency_key text default null, _invoice_id uuid default null, _transaction_id uuid default null,
  _spend_event_id uuid default null, _note text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare _prev bigint; _new bigint; _is_test boolean;
begin
  select test_mode into _is_test from public.ad_provider_config where id = 1;
  _is_test := coalesce(_is_test, true);

  -- serialize per account, THEN re-check idempotency
  perform 1 from public.ad_accounts where id = _ad_account_id for update;
  if _idempotency_key is not null and exists (
    select 1 from public.ad_billing_ledger where ad_account_id = _ad_account_id and idempotency_key = _idempotency_key
  ) then return; end if;
  if _spend_event_id is not null and exists (
    select 1 from public.ad_billing_ledger where spend_event_id = _spend_event_id
  ) then return; end if;

  insert into public.ad_account_billing_state (ad_account_id, currency) values (_ad_account_id, _currency) on conflict (ad_account_id) do nothing;

  if _is_test then
    select test_outstanding_micros into _prev from public.ad_account_billing_state where ad_account_id = _ad_account_id;
  else
    select outstanding_micros into _prev from public.ad_account_billing_state where ad_account_id = _ad_account_id;
  end if;
  _new := coalesce(_prev, 0) + _amount_micros;

  insert into public.ad_billing_ledger
    (ad_account_id, entry_type, amount_micros, balance_after_micros, currency, invoice_id, transaction_id, spend_event_id, idempotency_key, note, is_test)
  values
    (_ad_account_id, _entry_type, _amount_micros, _new, _currency, _invoice_id, _transaction_id, _spend_event_id, _idempotency_key, _note, _is_test);

  if _is_test then
    update public.ad_account_billing_state
       set test_outstanding_micros = _new,
           test_lifetime_paid_micros = test_lifetime_paid_micros + case when _entry_type = 'payment_succeeded' then -_amount_micros else 0 end,
           updated_at = now()
     where ad_account_id = _ad_account_id;
  else
    update public.ad_account_billing_state
       set outstanding_micros = _new,
           lifetime_paid_micros = lifetime_paid_micros + case when _entry_type = 'payment_succeeded' then -_amount_micros else 0 end,
           updated_at = now()
     where ad_account_id = _ad_account_id;
  end if;
end;
$$;
revoke all on function public._ad_billing_post_ledger(uuid,text,bigint,text,text,uuid,uuid,uuid,text) from public, anon, authenticated;

-- summary exposes both classes + defines credit balance (E16)
create or replace function public.ad_account_billing_summary(_ad_account_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare _st public.ad_account_billing_state; _prof public.ad_billing_profiles; _cfg public.ad_provider_config; _cur text; _has_pm boolean;
begin
  if not (public.is_ad_account_billing_manager(_ad_account_id) or public.has_role(auth.uid(), 'admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into _st from public.ad_account_billing_state where ad_account_id = _ad_account_id;
  select * into _prof from public.ad_billing_profiles where ad_account_id = _ad_account_id;
  select * into _cfg from public.ad_provider_config where id = 1;
  select currency into _cur from public.ad_accounts where id = _ad_account_id;
  _has_pm := exists (select 1 from public.ad_payment_methods where ad_account_id = _ad_account_id and status = 'active');
  return jsonb_build_object(
    'currency', coalesce(_st.currency, _cur, 'USD'),
    'outstanding_micros', coalesce(_st.outstanding_micros, 0),
    'lifetime_paid_micros', coalesce(_st.lifetime_paid_micros, 0),
    'credit_micros', greatest(-coalesce(_st.outstanding_micros, 0), 0),
    'test_outstanding_micros', coalesce(_st.test_outstanding_micros, 0),
    'test_lifetime_paid_micros', coalesce(_st.test_lifetime_paid_micros, 0),
    'test_credit_micros', greatest(-coalesce(_st.test_outstanding_micros, 0), 0),
    'payment_threshold_cents', coalesce(_st.payment_threshold_cents, 10000),
    'hold', coalesce(_st.hold, false),
    'hold_reason', _st.hold_reason,
    'last_charge_at', _st.last_charge_at,
    'last_charge_status', _st.last_charge_status,
    'billing_status', coalesce(_prof.status::text, 'setup_required'),
    'has_payment_method', _has_pm,
    'provider', _cfg.active_provider,
    'test_mode', _cfg.test_mode
  );
end;
$$;
revoke all on function public.ad_account_billing_summary(uuid) from public, anon;
grant execute on function public.ad_account_billing_summary(uuid) to authenticated;
