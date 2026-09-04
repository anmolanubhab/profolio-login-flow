-- =====================================================================
-- Phase K3-A — Real Payment / Billing model (SIMULATED provider, test mode)
--
-- Extends the K1 billing tables + K2 spend ledger with the plumbing a real
-- payment provider needs: provider customer/payment-method references, a
-- webhook idempotency store, an append-only billing ledger, a per-account
-- billing state (postpaid balance-threshold model), and server-authoritative
-- RPCs for the whole payment lifecycle.
--
-- Billing model (PROFOLIO IMPLEMENTATION DECISION, informed by LinkedIn's
-- DOCUMENTED behavior — not a live-audited clone): POSTPAID. Ad spend from
-- K2 accrues as an obligation on ad_account_billing_state.outstanding_micros.
-- A charge is attempted when a checkout is opened (K3-B: manual "pay
-- outstanding" button; K4 will automate the threshold trigger). A failed
-- charge puts the account on hold (billing status -> restricted -> K2's
-- _ad_campaign_deliverable already stops delivery).
--
-- Money precision: cents for transactions/invoices (whole-cent charges),
-- micros for the ledger/state (1 cent = 10,000 micros; matches K2 spend).
--
-- NO real money. NO real provider account. NO production credentials.
-- The active provider is 'simulated' / test_mode = true and CANNOT be
-- changed to a production provider without a future migration (K3-C).
-- =====================================================================

-- ---------- provider mode (server-authoritative) --------------------
create table public.ad_provider_config (
  id               smallint primary key default 1 check (id = 1),
  active_provider  public.ad_payment_provider not null default 'simulated',
  test_mode        boolean not null default true,
  notes            text,
  updated_at       timestamptz not null default now()
);
insert into public.ad_provider_config (id, notes)
values (1, 'K3-B: simulated provider, test mode. Production charging (a real provider with test_mode=false) is NOT enabled and requires a future migration + explicit approval (K3-C).');

-- hard safety rail: this row can never point at a non-simulated provider or
-- leave test mode without a migration that first drops this trigger.
create or replace function public._ad_provider_config_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.active_provider <> 'simulated' or new.test_mode is not true then
    raise exception 'K3-C production charging is not enabled: active_provider must be simulated and test_mode must be true'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_ad_provider_config_guard
  before insert or update on public.ad_provider_config
  for each row execute function public._ad_provider_config_guard();

alter table public.ad_provider_config enable row level security;
create policy ad_provider_config_read on public.ad_provider_config
  for select to authenticated using (true);
revoke all on public.ad_provider_config from anon;

-- ---------- provider webhook secret (service-role only) -------------
create table public.ad_provider_secrets (
  id              smallint primary key default 1 check (id = 1),
  webhook_secret  text not null default encode(gen_random_bytes(32), 'hex'),
  rotated_at      timestamptz not null default now()
);
insert into public.ad_provider_secrets (id) values (1);
alter table public.ad_provider_secrets enable row level security;
-- NO policies: only the edge functions (service role) can read this.
revoke all on public.ad_provider_secrets from anon, authenticated;

-- ---------- new columns on K1 tables ------------------------------
alter table public.ad_billing_profiles
  add column provider_customer_ref text,
  add column hold_reason text;

alter table public.ad_payment_methods
  add column provider_customer_ref text,
  add column provider_setup_ref text,
  add column status text not null default 'active'
    check (status in ('active', 'verifying', 'failed', 'removed'));

alter table public.ad_billing_transactions
  add column provider_customer_ref text,
  add column provider_event_id text,
  add column parent_transaction_id uuid references public.ad_billing_transactions(id) on delete set null,
  add column refunded_amount_cents bigint not null default 0 check (refunded_amount_cents >= 0),
  add column settled_at timestamptz,
  add column client_secret_ref text;   -- transient, provider client ref; not a card credential

create unique index ad_billing_transactions_provider_event_idx
  on public.ad_billing_transactions (provider, provider_event_id)
  where provider_event_id is not null;
-- (ad_billing_transactions_idem_idx already exists from K1)
create index if not exists ad_billing_transactions_account_time_idx
  on public.ad_billing_transactions (ad_account_id, occurred_at desc);

alter table public.ad_invoices
  add column provider_customer_ref text,
  add column billing_profile_snapshot jsonb,
  add column attempt_count int not null default 0 check (attempt_count >= 0);

-- ---------- webhook event store (idempotency + audit) ------------
create table public.ad_billing_webhook_events (
  id                uuid primary key default gen_random_uuid(),
  provider          public.ad_payment_provider not null,
  provider_event_id text not null,
  event_type        text not null,
  signature_valid   boolean not null,
  processed         boolean not null default false,
  payload           jsonb not null,
  error             text,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  unique (provider, provider_event_id)
);
alter table public.ad_billing_webhook_events enable row level security;
create policy ad_billing_webhook_events_admin_select on public.ad_billing_webhook_events
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
revoke all on public.ad_billing_webhook_events from anon;

-- ---------- append-only billing ledger (authoritative) ----------
create table public.ad_billing_ledger (
  id                 uuid primary key default gen_random_uuid(),
  ad_account_id      uuid not null references public.ad_accounts(id) on delete cascade,
  entry_type         text not null check (entry_type in (
                       'spend_accrued', 'invoice_issued', 'payment_succeeded',
                       'payment_failed', 'refund', 'adjustment', 'credit')),
  -- signed: positive = increases what the advertiser owes; negative = reduces it
  amount_micros      bigint not null,
  balance_after_micros bigint not null,
  currency           text not null,
  invoice_id         uuid references public.ad_invoices(id) on delete set null,
  transaction_id     uuid references public.ad_billing_transactions(id) on delete set null,
  spend_event_id     uuid references public.ad_spend_events(id) on delete set null,
  idempotency_key    text,
  note               text,
  created_at         timestamptz not null default now()
);
create unique index ad_billing_ledger_idem_idx
  on public.ad_billing_ledger (ad_account_id, idempotency_key)
  where idempotency_key is not null;
create unique index ad_billing_ledger_spend_event_idx
  on public.ad_billing_ledger (spend_event_id)
  where spend_event_id is not null;
create index ad_billing_ledger_account_idx
  on public.ad_billing_ledger (ad_account_id, created_at desc);
alter table public.ad_billing_ledger enable row level security;
create policy ad_billing_ledger_mgr_select on public.ad_billing_ledger
  for select to authenticated using (public.is_ad_account_billing_manager(ad_account_id));
create policy ad_billing_ledger_admin_select on public.ad_billing_ledger
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
revoke all on public.ad_billing_ledger from anon;

-- ledger rows are immutable
create or replace function public._ad_billing_ledger_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'ad_billing_ledger is append-only' using errcode = 'P0001';
end;
$$;
create trigger trg_ad_billing_ledger_no_update
  before update or delete on public.ad_billing_ledger
  for each row execute function public._ad_billing_ledger_immutable();

-- ---------- per-account billing state (derived snapshot) --------
create table public.ad_account_billing_state (
  ad_account_id           uuid primary key references public.ad_accounts(id) on delete cascade,
  currency                text not null,
  payment_threshold_cents bigint not null default 10000 check (payment_threshold_cents >= 0),
  outstanding_micros      bigint not null default 0,
  lifetime_paid_micros    bigint not null default 0 check (lifetime_paid_micros >= 0),
  hold                    boolean not null default false,
  hold_reason             text,
  last_charge_at          timestamptz,
  last_charge_status      text,
  updated_at              timestamptz not null default now()
);
alter table public.ad_account_billing_state enable row level security;
create policy ad_account_billing_state_mgr_select on public.ad_account_billing_state
  for select to authenticated using (public.is_ad_account_billing_manager(ad_account_id));
create policy ad_account_billing_state_admin_select on public.ad_account_billing_state
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
revoke all on public.ad_account_billing_state from anon;

create trigger trg_ad_account_billing_state_updated_at
  before update on public.ad_account_billing_state
  for each row execute function public.update_updated_at_column();

-- ---------- helpers -------------------------------------------
-- Post one immutable ledger entry and refresh the account billing state.
create or replace function public._ad_billing_post_ledger(
  _ad_account_id uuid,
  _entry_type text,
  _amount_micros bigint,     -- signed
  _currency text,
  _idempotency_key text default null,
  _invoice_id uuid default null,
  _transaction_id uuid default null,
  _spend_event_id uuid default null,
  _note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _prev bigint;
  _new bigint;
begin
  -- idempotency guards (silently no-op on repeat)
  if _idempotency_key is not null and exists (
    select 1 from public.ad_billing_ledger
    where ad_account_id = _ad_account_id and idempotency_key = _idempotency_key
  ) then
    return;
  end if;
  if _spend_event_id is not null and exists (
    select 1 from public.ad_billing_ledger where spend_event_id = _spend_event_id
  ) then
    return;
  end if;

  -- serialize per account
  perform 1 from public.ad_accounts where id = _ad_account_id for update;

  insert into public.ad_account_billing_state (ad_account_id, currency)
  values (_ad_account_id, _currency)
  on conflict (ad_account_id) do nothing;

  select outstanding_micros into _prev from public.ad_account_billing_state where ad_account_id = _ad_account_id;
  _new := coalesce(_prev, 0) + _amount_micros;

  insert into public.ad_billing_ledger
    (ad_account_id, entry_type, amount_micros, balance_after_micros, currency,
     invoice_id, transaction_id, spend_event_id, idempotency_key, note)
  values
    (_ad_account_id, _entry_type, _amount_micros, _new, _currency,
     _invoice_id, _transaction_id, _spend_event_id, _idempotency_key, _note);

  update public.ad_account_billing_state
     set outstanding_micros = _new,
         lifetime_paid_micros = lifetime_paid_micros
           + case when _entry_type = 'payment_succeeded' then -_amount_micros else 0 end,
         updated_at = now()
   where ad_account_id = _ad_account_id;
end;
$$;

-- Put an account on / off billing hold (drives K2 delivery eligibility).
create or replace function public._ad_billing_set_hold(_ad_account_id uuid, _hold boolean, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ad_account_billing_state
     set hold = _hold, hold_reason = case when _hold then _reason else null end, updated_at = now()
   where ad_account_id = _ad_account_id;

  -- reflect on the billing profile status that K2 delivery checks. When
  -- clearing, set a non-restricted value so the BEFORE trigger recomputes
  -- the real status (setup_required / payment_method_required / ready).
  update public.ad_billing_profiles
     set status = (case when _hold then 'restricted' else 'setup_required' end)::public.ad_billing_profile_status,
         hold_reason = case when _hold then _reason else null end
   where ad_account_id = _ad_account_id;

  insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
  values (_ad_account_id, (case when _hold then 'account_hold' else 'account_hold_cleared' end)::public.ad_billing_event_type,
          auth.uid(), case when _hold then 'Ad account put on billing hold: ' || coalesce(_reason, 'payment issue')
                           else 'Billing hold cleared' end,
          jsonb_build_object('reason', _reason));
end;
$$;

-- ---------- K2 -> K3: spend accrues as an obligation -------------
create or replace function public._ad_billing_accrue_spend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cost_micros > 0 then
    perform public._ad_billing_post_ledger(
      new.ad_account_id, 'spend_accrued', new.cost_micros, new.currency,
      null, null, null, new.id, 'ad spend'
    );
  end if;
  return null;
end;
$$;
create trigger trg_ad_spend_events_accrue
  after insert on public.ad_spend_events
  for each row execute function public._ad_billing_accrue_spend();

create sequence if not exists public.ad_invoice_number_seq start 1000;

-- ---------- server-authoritative payment RPCs -----------------
-- These are invoked by the ad-billing-* edge functions (service role) which
-- verify the caller's JWT + billing-manager authorization first. They also
-- self-check billing-manager where a user context is present.

-- record the provider customer id on the billing profile
create or replace function public.ad_billing_set_provider_customer(
  _ad_account_id uuid, _provider public.ad_payment_provider, _customer_ref text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_ad_account_billing_manager(_ad_account_id)
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.ad_billing_profiles
     set provider = _provider, provider_customer_ref = _customer_ref
   where ad_account_id = _ad_account_id;
  insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
  values (_ad_account_id, 'provider_connected', auth.uid(),
          'Payment provider connected (' || _provider || ')',
          jsonb_build_object('provider', _provider));
end;
$$;

-- record a provider-tokenised payment method (never card number / CVV)
create or replace function public.ad_billing_record_payment_method(
  _ad_account_id uuid,
  _provider public.ad_payment_provider,
  _customer_ref text,
  _pm_ref text,
  _setup_ref text,
  _brand text,
  _last4 text,
  _exp_month int,
  _exp_year int,
  _billing_name text,
  _make_default boolean default true
)
returns public.ad_payment_methods
language plpgsql
security definer
set search_path = public
as $$
declare _row public.ad_payment_methods;
begin
  if auth.uid() is not null and not public.is_ad_account_billing_manager(_ad_account_id)
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if _pm_ref ~ '^[0-9 -]{12,25}$' then
    raise exception 'payment reference looks like a card number' using errcode = '22023';
  end if;
  insert into public.ad_payment_methods
    (ad_account_id, provider, provider_customer_ref, provider_ref, provider_setup_ref,
     method_type, display_brand, display_last4, exp_month, exp_year, billing_name, is_default, status, created_by)
  values
    (_ad_account_id, _provider, _customer_ref, _pm_ref, _setup_ref,
     'card', _brand, _last4, _exp_month, _exp_year, _billing_name, coalesce(_make_default, true), 'active', auth.uid())
  returning * into _row;
  return _row;
end;
$$;

-- open a charge attempt for the account's outstanding balance (idempotent)
create or replace function public.ad_billing_open_charge(
  _ad_account_id uuid,
  _amount_cents bigint,
  _idempotency_key text,
  _payment_method_id uuid default null
)
returns public.ad_billing_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.ad_billing_transactions;
  _cur text;
  _prof public.ad_billing_profiles;
begin
  if auth.uid() is not null and not public.is_ad_account_billing_manager(_ad_account_id)
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if _amount_cents <= 0 then
    raise exception 'charge amount must be positive' using errcode = '22023';
  end if;

  -- idempotency: return the existing attempt for this key
  select * into _row from public.ad_billing_transactions
   where ad_account_id = _ad_account_id and idempotency_key = _idempotency_key;
  if found then
    return _row;
  end if;

  select currency into _cur from public.ad_accounts where id = _ad_account_id;
  select * into _prof from public.ad_billing_profiles where ad_account_id = _ad_account_id;
  if coalesce(_payment_method_id, (select id from public.ad_payment_methods
        where ad_account_id = _ad_account_id and is_default limit 1)) is null then
    raise exception 'no payment method on file' using errcode = 'P0001';
  end if;

  insert into public.ad_billing_transactions
    (ad_account_id, payment_method_id, txn_type, status, amount_cents, currency,
     provider, provider_customer_ref, idempotency_key)
  values
    (_ad_account_id,
     coalesce(_payment_method_id, (select id from public.ad_payment_methods where ad_account_id = _ad_account_id and is_default limit 1)),
     'charge', 'pending', _amount_cents, coalesce(_cur, 'USD'),
     (select active_provider from public.ad_provider_config where id = 1),
     _prof.provider_customer_ref, _idempotency_key)
  returning * into _row;

  insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
  values (_ad_account_id, 'payment_started', auth.uid(),
          'Payment started (' || (_amount_cents / 100.0)::numeric(12,2) || ' ' || coalesce(_cur,'USD') || ')',
          jsonb_build_object('transaction_id', _row.id, 'amount_cents', _amount_cents));

  update public.ad_account_billing_state set last_charge_at = now(), last_charge_status = 'pending'
   where ad_account_id = _ad_account_id;

  return _row;
end;
$$;

-- THE authoritative webhook processor. Idempotent on (provider, provider_event_id).
-- Called only by the ad-billing-webhook edge function AFTER it verifies the
-- HMAC signature. _signature_valid is passed through for defence in depth.
create or replace function public.ad_billing_apply_webhook(
  _provider public.ad_payment_provider,
  _provider_event_id text,
  _event_type text,
  _signature_valid boolean,
  _payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _txn public.ad_billing_transactions;
  _acct uuid;
  _amount_cents bigint;
  _inv public.ad_invoices;
  _inv_no bigint;
  _prof public.ad_billing_profiles;
  _inserted integer;
  _refund_cents bigint;
begin
  -- record + dedup the webhook event
  insert into public.ad_billing_webhook_events
    (provider, provider_event_id, event_type, signature_valid, payload, processed)
  values (_provider, _provider_event_id, _event_type, _signature_valid, _payload, false)
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics _inserted = row_count;
  if _inserted = 0 then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if not _signature_valid then
    update public.ad_billing_webhook_events
       set error = 'invalid signature', processed = false, processed_at = now()
     where provider = _provider and provider_event_id = _provider_event_id;
    return jsonb_build_object('ok', false, 'reason', 'invalid_signature');
  end if;

  -- locate the referenced transaction
  select * into _txn from public.ad_billing_transactions
   where provider = _provider
     and (idempotency_key = (_payload->>'idempotency_key') or provider_ref = (_payload->>'intent_ref'))
   order by created_at desc limit 1;

  if _event_type in ('payment_intent.succeeded','payment_intent.payment_failed',
                     'payment_intent.requires_action','payment_intent.canceled',
                     'charge.refunded') and _txn.id is null then
    update public.ad_billing_webhook_events set error = 'no matching transaction', processed = true, processed_at = now()
     where provider = _provider and provider_event_id = _provider_event_id;
    return jsonb_build_object('ok', true, 'note', 'no matching transaction');
  end if;

  _acct := _txn.ad_account_id;
  _amount_cents := coalesce((_payload->>'amount_cents')::bigint, _txn.amount_cents);

  -- terminal-state guard: never re-settle / re-fail an already-finalised txn
  if _txn.id is not null and _txn.status in ('succeeded','refunded','partially_refunded','canceled')
     and _event_type in ('payment_intent.succeeded','payment_intent.payment_failed',
                         'payment_intent.requires_action','payment_intent.canceled') then
    update public.ad_billing_webhook_events set processed = true, processed_at = now(),
           error = 'transaction already finalised (' || _txn.status || ')'
     where provider = _provider and provider_event_id = _provider_event_id;
    return jsonb_build_object('ok', true, 'note', 'already finalised');
  end if;

  if _event_type = 'payment_intent.succeeded' then
    update public.ad_billing_transactions
       set status = 'succeeded', settled_at = now(),
           provider_ref = coalesce(_payload->>'intent_ref', provider_ref),
           provider_event_id = _provider_event_id, updated_at = now()
     where id = _txn.id;

    -- issue / settle an invoice for this payment
    select nextval('public.ad_invoice_number_seq') into _inv_no;
    select * into _prof from public.ad_billing_profiles where ad_account_id = _acct;
    insert into public.ad_invoices
      (ad_account_id, invoice_number, status, currency, subtotal_cents, tax_cents, total_cents,
       issued_at, paid_at, provider, provider_ref, provider_customer_ref,
       billing_profile_snapshot, attempt_count)
    values
      (_acct, 'INV-' || to_char(now(),'YYYYMM') || '-' || lpad(_inv_no::text, 6, '0'),
       'paid', _txn.currency, _amount_cents, 0, _amount_cents,
       now(), now(), _provider, _payload->>'intent_ref', _txn.provider_customer_ref,
       to_jsonb(_prof), 1)
    returning * into _inv;

    update public.ad_billing_transactions set invoice_id = _inv.id where id = _txn.id;

    perform public._ad_billing_post_ledger(
      _acct, 'payment_succeeded', -(_amount_cents::bigint * 10000), _txn.currency,
      'txn-paid:' || _txn.id::text, _inv.id, _txn.id, null, 'payment settled');

    update public.ad_account_billing_state
       set last_charge_at = now(), last_charge_status = 'succeeded'
     where ad_account_id = _acct;

    -- clear hold if the balance is no longer positive
    if coalesce((select outstanding_micros from public.ad_account_billing_state where ad_account_id = _acct), 0) <= 0 then
      perform public._ad_billing_set_hold(_acct, false, null);
    end if;

    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_succeeded', null,
            'Payment succeeded (' || (_amount_cents/100.0)::numeric(12,2) || ' ' || _txn.currency || ')',
            jsonb_build_object('transaction_id', _txn.id, 'invoice_id', _inv.id));
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'invoice_paid', null, 'Invoice ' || _inv.invoice_number || ' paid',
            jsonb_build_object('invoice_id', _inv.id));

  elsif _event_type = 'payment_intent.payment_failed' then
    update public.ad_billing_transactions
       set status = 'failed', failure_reason = coalesce(_payload->>'failure_reason', 'declined'),
           provider_event_id = _provider_event_id, updated_at = now()
     where id = _txn.id;
    perform public._ad_billing_post_ledger(
      _acct, 'payment_failed', 0, _txn.currency, 'txn-fail:' || _txn.id::text, null, _txn.id, null, 'payment failed');
    update public.ad_account_billing_state set last_charge_at = now(), last_charge_status = 'failed'
     where ad_account_id = _acct;
    perform public._ad_billing_set_hold(_acct, true, coalesce(_payload->>'failure_reason', 'payment declined'));
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_failed', null,
            'Payment failed: ' || coalesce(_payload->>'failure_reason','declined'),
            jsonb_build_object('transaction_id', _txn.id));

  elsif _event_type = 'payment_intent.requires_action' then
    update public.ad_billing_transactions
       set status = 'requires_action', provider_event_id = _provider_event_id, updated_at = now()
     where id = _txn.id;
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_requires_action', null, 'Payment needs additional confirmation',
            jsonb_build_object('transaction_id', _txn.id));

  elsif _event_type = 'payment_intent.canceled' then
    update public.ad_billing_transactions
       set status = 'canceled', provider_event_id = _provider_event_id, updated_at = now()
     where id = _txn.id;
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_canceled', null, 'Payment canceled', jsonb_build_object('transaction_id', _txn.id));

  elsif _event_type = 'charge.refunded' then
    _refund_cents := coalesce((_payload->>'refund_cents')::bigint, _txn.amount_cents);
    insert into public.ad_billing_transactions
      (ad_account_id, parent_transaction_id, payment_method_id, invoice_id, txn_type, status,
       amount_cents, currency, provider, provider_customer_ref, provider_ref, provider_event_id, settled_at)
    values
      (_acct, _txn.id, _txn.payment_method_id, _txn.invoice_id, 'refund', 'succeeded',
       _refund_cents, _txn.currency, _provider, _txn.provider_customer_ref,
       _payload->>'refund_ref', _provider_event_id, now());
    update public.ad_billing_transactions
       set refunded_amount_cents = refunded_amount_cents + _refund_cents,
           status = (case when refunded_amount_cents + _refund_cents >= amount_cents then 'refunded' else 'partially_refunded' end)::public.ad_billing_txn_status,
           updated_at = now()
     where id = _txn.id;
    perform public._ad_billing_post_ledger(
      _acct, 'refund', (_refund_cents::bigint * 10000), _txn.currency,
      'refund:' || _provider_event_id, _txn.invoice_id, _txn.id, null, 'refund');
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_refunded', null,
            'Refund processed (' || (_refund_cents/100.0)::numeric(12,2) || ' ' || _txn.currency || ')',
            jsonb_build_object('transaction_id', _txn.id, 'refund_cents', _refund_cents));

  else
    update public.ad_billing_webhook_events set error = 'unhandled event type', processed = true, processed_at = now()
     where provider = _provider and provider_event_id = _provider_event_id;
    return jsonb_build_object('ok', true, 'note', 'unhandled event type');
  end if;

  update public.ad_billing_webhook_events set processed = true, processed_at = now()
   where provider = _provider and provider_event_id = _provider_event_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- admin-only manual adjustment / credit (idempotent, auditable)
create or replace function public.ad_billing_apply_adjustment(
  _ad_account_id uuid, _amount_cents bigint, _direction text, _reason text, _idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _cur text; _micros bigint;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if _direction not in ('debit','credit') or _amount_cents <= 0 then
    raise exception 'bad adjustment' using errcode = '22023';
  end if;
  select currency into _cur from public.ad_accounts where id = _ad_account_id;
  _micros := _amount_cents::bigint * 10000 * (case when _direction = 'debit' then 1 else -1 end);
  perform public._ad_billing_post_ledger(
    _ad_account_id, case when _direction = 'debit' then 'adjustment' else 'credit' end,
    _micros, coalesce(_cur,'USD'), _idempotency_key, null, null, null, _reason);
  insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
  values (_ad_account_id, 'billing_adjustment', auth.uid(),
          'Billing ' || _direction || ' ' || (_amount_cents/100.0)::numeric(12,2) || ' ' || coalesce(_cur,'USD') || ': ' || _reason,
          jsonb_build_object('direction', _direction, 'amount_cents', _amount_cents));
end;
$$;

-- advertiser-facing billing summary
create or replace function public.ad_account_billing_summary(_ad_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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

-- ---------- grants ------------------------------------------
revoke all on function public._ad_provider_config_guard()                         from public, anon, authenticated;
revoke all on function public._ad_billing_ledger_immutable()                      from public, anon, authenticated;
revoke all on function public._ad_billing_post_ledger(uuid,text,bigint,text,text,uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public._ad_billing_set_hold(uuid,boolean,text)             from public, anon, authenticated;
revoke all on function public._ad_billing_accrue_spend()                          from public, anon, authenticated;
revoke all on function public.ad_billing_set_provider_customer(uuid,public.ad_payment_provider,text) from public, anon, authenticated;
revoke all on function public.ad_billing_record_payment_method(uuid,public.ad_payment_provider,text,text,text,text,text,int,int,text,boolean) from public, anon, authenticated;
revoke all on function public.ad_billing_open_charge(uuid,bigint,text,uuid)       from public, anon, authenticated;
revoke all on function public.ad_billing_apply_webhook(public.ad_payment_provider,text,text,boolean,jsonb) from public, anon, authenticated;

revoke all on function public.ad_billing_apply_adjustment(uuid,bigint,text,text,text) from public, anon;
grant execute on function public.ad_billing_apply_adjustment(uuid,bigint,text,text,text) to authenticated;
revoke all on function public.ad_account_billing_summary(uuid)                    from public, anon;
grant execute on function public.ad_account_billing_summary(uuid)                 to authenticated;
