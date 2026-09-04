-- =====================================================================
-- Phase K3-C Remediation — R1: security correctness
--
-- Fixes from the Production Payment Readiness Audit:
--   C1  billing hold is client-bypassable (advertiser can UPDATE
--       ad_billing_profiles.status='ready' and resume delivery)
--   D3  ad_payment_methods is client-writable -> untrusted charging source
--   E4  ad_billing_apply_adjustment allows a null idempotency key
--   E6  an account can accrue unbounded obligation with no payment method
--   E8  ad_billing_open_charge does not validate pm ownership / account
--       state / amount ceiling
--   E11 ad_billing_events / ad_billing_webhook_events are not immutable
--
-- No provider connection. No production credentials. No real money.
-- ad_provider_config stays simulated / test_mode = true.
-- =====================================================================

-- ---------- C1: lock ad_billing_profiles.status against client writes -----
-- Server-authoritative hold/status transitions run with the
-- `ad.billing_bypass = on` GUC (set only inside _ad_billing_set_hold and the
-- payment RPCs). Any other UPDATE (i.e. a client via the mgr_all RLS policy)
-- may not change status / hold_reason; the BEFORE trigger reverts them to
-- their prior value and then recomputes the derived status.
create or replace function public._ad_billing_profile_status_biu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(current_setting('ad.billing_bypass', true), '') <> 'on' then
    -- client-originated write: status and hold_reason are not client-controlled
    new.status := old.status;
    new.hold_reason := old.hold_reason;
  end if;
  new.status := public._ad_billing_apply_status(new);
  return new;
end;
$$;
revoke all on function public._ad_billing_profile_status_biu() from public, anon, authenticated;

-- _ad_billing_set_hold must set the bypass GUC around its status write
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

  perform set_config('ad.billing_bypass', 'on', true);
  update public.ad_billing_profiles
     set status = (case when _hold then 'restricted' else 'setup_required' end)::public.ad_billing_profile_status,
         hold_reason = case when _hold then _reason else null end
   where ad_account_id = _ad_account_id;
  perform set_config('ad.billing_bypass', 'off', true);

  insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
  values (_ad_account_id,
          (case when _hold then 'account_hold' else 'account_hold_cleared' end)::public.ad_billing_event_type,
          auth.uid(),
          case when _hold then 'Ad account put on billing hold: ' || coalesce(_reason, 'payment issue') else 'Billing hold cleared' end,
          jsonb_build_object('reason', _reason));
end;
$$;
revoke all on function public._ad_billing_set_hold(uuid,boolean,text) from public, anon, authenticated;

-- ---------- E6 + C1: delivery gate requires billing readiness ----------
create or replace function public._ad_campaign_deliverable(_campaign_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _c public.campaigns;
  _acct_status public.ad_account_status;
  _bs public.ad_billing_profile_status;
  _hold boolean;
  _today date := (now() at time zone 'UTC')::date;
  _today_spend bigint;
  _total_spend bigint;
begin
  select * into _c from public.campaigns where id = _campaign_id;
  if not found then return false; end if;

  -- ad account must be active
  select status into _acct_status from public.ad_accounts where id = _c.ad_account_id;
  if _acct_status is distinct from 'active' then return false; end if;

  -- billing must be ready (implies: not restricted, profile complete, has a
  -- payment method) and not on hold
  select status into _bs from public.ad_billing_profiles where ad_account_id = _c.ad_account_id;
  if _bs is distinct from 'ready' then return false; end if;
  select hold into _hold from public.ad_account_billing_state where ad_account_id = _c.ad_account_id;
  if coalesce(_hold, false) then return false; end if;

  -- budget headroom (K2)
  if _c.daily_budget_cents is not null then
    select coalesce(spend_micros, 0) into _today_spend
    from public.ad_campaign_spend_daily where campaign_id = _campaign_id and day = _today;
    if coalesce(_today_spend, 0) >= _c.daily_budget_cents::bigint * 10000 then return false; end if;
  end if;
  if coalesce(_c.total_budget_cents, 0) > 0 then
    select coalesce(sum(spend_micros), 0) into _total_spend
    from public.ad_campaign_spend_daily where campaign_id = _campaign_id;
    if coalesce(_total_spend, 0) >= _c.total_budget_cents::bigint * 10000 then return false; end if;
  end if;

  return true;
end;
$$;
revoke all on function public._ad_campaign_deliverable(uuid) from public, anon, authenticated;

-- ---------- D3: ad_payment_methods is no longer client-writable ---------
drop policy if exists ad_payment_methods_mgr_all on public.ad_payment_methods;
create policy ad_payment_methods_mgr_select on public.ad_payment_methods
  for select to authenticated using (public.is_ad_account_billing_manager(ad_account_id));
create policy ad_payment_methods_mgr_delete on public.ad_payment_methods
  for delete to authenticated using (public.is_ad_account_billing_manager(ad_account_id));
-- INSERT/UPDATE only through the SECURITY DEFINER provider RPCs below.

-- record-payment-method: also PAN-guard the customer ref and holder name
create or replace function public.ad_billing_record_payment_method(
  _ad_account_id uuid, _provider public.ad_payment_provider, _customer_ref text, _pm_ref text, _setup_ref text,
  _brand text, _last4 text, _exp_month int, _exp_year int, _billing_name text, _make_default boolean default true
)
returns public.ad_payment_methods
language plpgsql security definer set search_path = public
as $$
declare _row public.ad_payment_methods;
begin
  if auth.uid() is not null and not public.is_ad_account_billing_manager(_ad_account_id) and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(_pm_ref,'') ~ '[0-9 -]{12,25}' or coalesce(_customer_ref,'') ~ '[0-9]{12,19}' or coalesce(_billing_name,'') ~ '[0-9]{12,19}' then
    raise exception 'a supplied value looks like a card number' using errcode = '22023';
  end if;
  insert into public.ad_payment_methods
    (ad_account_id, provider, provider_customer_ref, provider_ref, provider_setup_ref, method_type, display_brand, display_last4, exp_month, exp_year, billing_name, is_default, status, created_by)
  values
    (_ad_account_id, _provider, _customer_ref, _pm_ref, _setup_ref, 'card', _brand, _last4, _exp_month, _exp_year, _billing_name, coalesce(_make_default, true), 'active', auth.uid())
  returning * into _row;
  return _row;
end;
$$;
revoke all on function public.ad_billing_record_payment_method(uuid,public.ad_payment_provider,text,text,text,text,text,int,int,text,boolean) from public, anon, authenticated;

-- set-default: the only client-reachable mutation, still checked + validated
create or replace function public.ad_billing_set_default_payment_method(_payment_method_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare _acct uuid;
begin
  select ad_account_id into _acct from public.ad_payment_methods where id = _payment_method_id;
  if _acct is null then raise exception 'payment method not found' using errcode = 'P0002'; end if;
  if not (public.is_ad_account_billing_manager(_acct) or public.has_role(auth.uid(), 'admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.ad_payment_methods set is_default = true, updated_at = now()
   where id = _payment_method_id and status = 'active';
end;
$$;
revoke all on function public.ad_billing_set_default_payment_method(uuid) from public, anon;
grant execute on function public.ad_billing_set_default_payment_method(uuid) to authenticated;

-- ---------- E8: validate open_charge inputs ---------------------------
create or replace function public.ad_billing_open_charge(_ad_account_id uuid, _amount_cents bigint, _idempotency_key text, _payment_method_id uuid default null)
returns public.ad_billing_transactions
language plpgsql security definer set search_path = public
as $$
declare
  _row public.ad_billing_transactions; _cur text; _prof public.ad_billing_profiles;
  _acct_status public.ad_account_status; _pm public.ad_payment_methods; _pm_id uuid;
  _max_charge_cents constant bigint := 10000000;   -- 100,000 major units, single-charge ceiling
begin
  if auth.uid() is not null and not public.is_ad_account_billing_manager(_ad_account_id) and not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if _idempotency_key is null or btrim(_idempotency_key) = '' then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  if _amount_cents <= 0 then raise exception 'charge amount must be positive' using errcode = '22023'; end if;
  if _amount_cents > _max_charge_cents then raise exception 'charge amount exceeds the single-charge ceiling' using errcode = '22023'; end if;

  select status into _acct_status from public.ad_accounts where id = _ad_account_id;
  if _acct_status is distinct from 'active' then raise exception 'ad account is not active' using errcode = 'P0001'; end if;

  -- idempotency: return the existing attempt
  select * into _row from public.ad_billing_transactions where ad_account_id = _ad_account_id and idempotency_key = _idempotency_key;
  if found then return _row; end if;

  select currency into _cur from public.ad_accounts where id = _ad_account_id;
  select * into _prof from public.ad_billing_profiles where ad_account_id = _ad_account_id;

  _pm_id := coalesce(_payment_method_id, (select id from public.ad_payment_methods where ad_account_id = _ad_account_id and is_default and status = 'active' limit 1));
  if _pm_id is null then raise exception 'no active payment method on file' using errcode = 'P0001'; end if;
  select * into _pm from public.ad_payment_methods where id = _pm_id;
  if _pm.ad_account_id is distinct from _ad_account_id then
    raise exception 'payment method does not belong to this ad account' using errcode = '42501';
  end if;
  if _pm.status is distinct from 'active' then raise exception 'payment method is not active' using errcode = 'P0001'; end if;

  insert into public.ad_billing_transactions
    (ad_account_id, payment_method_id, txn_type, status, amount_cents, currency, provider, provider_customer_ref, idempotency_key)
  values
    (_ad_account_id, _pm_id, 'charge', 'pending', _amount_cents, coalesce(_cur, 'USD'),
     (select active_provider from public.ad_provider_config where id = 1), _prof.provider_customer_ref, _idempotency_key)
  returning * into _row;

  insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
  values (_ad_account_id, 'payment_started', auth.uid(),
          'Payment started (' || (_amount_cents / 100.0)::numeric(14,2) || ' ' || coalesce(_cur,'USD') || ')',
          jsonb_build_object('transaction_id', _row.id, 'amount_cents', _amount_cents));
  update public.ad_account_billing_state set last_charge_at = now(), last_charge_status = 'pending' where ad_account_id = _ad_account_id;
  return _row;
end;
$$;
revoke all on function public.ad_billing_open_charge(uuid,bigint,text,uuid) from public, anon, authenticated;

-- claim a pending charge before firing a provider intent (E10 — one winner)
create or replace function public.ad_billing_claim_charge_for_intent(_txn_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare _claimed boolean;
begin
  update public.ad_billing_transactions
     set status = 'processing', updated_at = now()
   where id = _txn_id and status = 'pending'
  returning true into _claimed;
  return coalesce(_claimed, false);
end;
$$;
revoke all on function public.ad_billing_claim_charge_for_intent(uuid) from public, anon, authenticated;

-- ---------- E4: adjustments require a non-null idempotency key ---------
create or replace function public.ad_billing_apply_adjustment(_ad_account_id uuid, _amount_cents bigint, _direction text, _reason text, _idempotency_key text)
returns void
language plpgsql security definer set search_path = public
as $$
declare _cur text; _micros bigint;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'admin only' using errcode = '42501'; end if;
  if _idempotency_key is null or btrim(_idempotency_key) = '' then raise exception 'idempotency key required' using errcode = '22023'; end if;
  if _direction not in ('debit','credit') or _amount_cents <= 0 then raise exception 'bad adjustment' using errcode = '22023'; end if;
  if exists (select 1 from public.ad_billing_ledger where ad_account_id = _ad_account_id and idempotency_key = _idempotency_key) then
    return;   -- already applied
  end if;
  select currency into _cur from public.ad_accounts where id = _ad_account_id;
  _micros := _amount_cents::bigint * 10000 * (case when _direction = 'debit' then 1 else -1 end);
  perform public._ad_billing_post_ledger(_ad_account_id, case when _direction = 'debit' then 'adjustment' else 'credit' end, _micros, coalesce(_cur,'USD'), _idempotency_key, null, null, null, _reason);
  insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
  values (_ad_account_id, 'billing_adjustment', auth.uid(),
          'Billing ' || _direction || ' ' || (_amount_cents/100.0)::numeric(14,2) || ' ' || coalesce(_cur,'USD') || ': ' || _reason,
          jsonb_build_object('direction', _direction, 'amount_cents', _amount_cents));
end;
$$;
revoke all on function public.ad_billing_apply_adjustment(uuid,bigint,text,text,text) from public, anon;
grant execute on function public.ad_billing_apply_adjustment(uuid,bigint,text,text,text) to authenticated;

-- ---------- E11: financial audit trails are append-only --------------
create or replace function public._ad_billing_events_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'ad_billing_events is append-only' using errcode = 'P0001'; end;
$$;
create trigger trg_ad_billing_events_no_change
  before update or delete on public.ad_billing_events
  for each row execute function public._ad_billing_events_immutable();
revoke all on function public._ad_billing_events_immutable() from public, anon, authenticated;

-- webhook events: DELETE blocked; UPDATE limited to the processing columns
create or replace function public._ad_billing_webhook_events_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ad_billing_webhook_events cannot be deleted' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - 'processed' - 'processed_at' - 'error')
     is distinct from (to_jsonb(old) - 'processed' - 'processed_at' - 'error') then
    raise exception 'only processing state may be updated on ad_billing_webhook_events' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_ad_billing_webhook_events_guard
  before update or delete on public.ad_billing_webhook_events
  for each row execute function public._ad_billing_webhook_events_guard();
revoke all on function public._ad_billing_webhook_events_guard() from public, anon, authenticated;
