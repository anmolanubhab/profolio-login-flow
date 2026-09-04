-- Phase K3-C R2 fix: lock the transaction row before processing a webhook
-- (serializes concurrent different-event webhooks for one txn), and create
-- the invoice with a check-first (the partial unique index isn't ON CONFLICT
-- inferrable without its predicate).
--
-- NOTE: superseded by 20260903070251 (R4) which adds payment_intent.processing
-- and charge.dispute.created handling on top of this body.

create or replace function public.ad_billing_apply_webhook(_provider public.ad_payment_provider, _provider_event_id text, _event_type text, _signature_valid boolean, _payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  _txn public.ad_billing_transactions; _acct uuid; _amount_cents bigint; _payload_amount bigint;
  _inv public.ad_invoices; _inv_no bigint; _prof public.ad_billing_profiles;
  _inserted integer; _refund_cents bigint; _max_refund bigint; _payload_acct uuid;
  _should_hold boolean;
begin
  insert into public.ad_billing_webhook_events (provider, provider_event_id, event_type, signature_valid, payload, processed)
  values (_provider, _provider_event_id, _event_type, _signature_valid, _payload, false)
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics _inserted = row_count;
  if _inserted = 0 then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  if not _signature_valid then
    update public.ad_billing_webhook_events set error = 'invalid signature', processed = false, processed_at = now()
     where provider = _provider and provider_event_id = _provider_event_id;
    return jsonb_build_object('ok', false, 'reason', 'invalid_signature');
  end if;

  _payload_acct := nullif(_payload->>'ad_account_id','')::uuid;

  select * into _txn from public.ad_billing_transactions
   where provider = _provider and provider_ref is not null and provider_ref = (_payload->>'intent_ref')
   limit 1;
  if _txn.id is null then
    select * into _txn from public.ad_billing_transactions
     where provider = _provider and idempotency_key = (_payload->>'idempotency_key')
       and (_payload_acct is null or ad_account_id = _payload_acct)
     order by created_at desc limit 1;
  end if;

  if _event_type in ('payment_intent.succeeded','payment_intent.payment_failed','payment_intent.requires_action','payment_intent.canceled','charge.refunded')
     and _txn.id is null then
    update public.ad_billing_webhook_events set error = 'no matching transaction', processed = true, processed_at = now()
     where provider = _provider and provider_event_id = _provider_event_id;
    return jsonb_build_object('ok', true, 'note', 'no matching transaction');
  end if;

  -- serialize concurrent webhook processing for this transaction
  if _txn.id is not null then
    select * into _txn from public.ad_billing_transactions where id = _txn.id for update;
  end if;

  if _payload_acct is not null and _txn.id is not null and _txn.ad_account_id <> _payload_acct then
    update public.ad_billing_webhook_events set error = 'account mismatch', processed = false, processed_at = now()
     where provider = _provider and provider_event_id = _provider_event_id;
    return jsonb_build_object('ok', false, 'reason', 'account_mismatch');
  end if;

  _acct := _txn.ad_account_id;
  _amount_cents := _txn.amount_cents;
  _payload_amount := nullif(_payload->>'amount_cents','')::bigint;

  if _txn.id is not null and _txn.status in ('succeeded','refunded','partially_refunded','canceled')
     and _event_type in ('payment_intent.succeeded','payment_intent.payment_failed','payment_intent.requires_action','payment_intent.canceled') then
    update public.ad_billing_webhook_events set processed = true, processed_at = now(), error = 'transaction already finalised (' || _txn.status || ')'
     where provider = _provider and provider_event_id = _provider_event_id;
    return jsonb_build_object('ok', true, 'note', 'already finalised');
  end if;

  if _event_type = 'payment_intent.succeeded' then
    if _payload_amount is not null and _payload_amount <> _amount_cents then
      update public.ad_billing_webhook_events
         set error = 'amount mismatch: payload=' || _payload_amount || ' txn=' || _amount_cents, processed = false, processed_at = now()
       where provider = _provider and provider_event_id = _provider_event_id;
      insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
      values (_acct, 'payment_failed', null, 'Reconciliation: payment amount mismatch',
              jsonb_build_object('transaction_id', _txn.id, 'payload_amount_cents', _payload_amount, 'txn_amount_cents', _amount_cents));
      return jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
    end if;

    update public.ad_billing_transactions
       set status = 'succeeded', settled_at = now(), provider_ref = coalesce(_payload->>'intent_ref', provider_ref),
           provider_event_id = _provider_event_id, updated_at = now()
     where id = _txn.id;

    select * into _inv from public.ad_invoices where transaction_id = _txn.id;
    if _inv.id is null then
      select nextval('public.ad_invoice_number_seq') into _inv_no;
      select * into _prof from public.ad_billing_profiles where ad_account_id = _acct;
      insert into public.ad_invoices
        (ad_account_id, transaction_id, invoice_number, status, currency, subtotal_cents, tax_cents, total_cents,
         issued_at, paid_at, provider, provider_ref, provider_customer_ref, billing_profile_snapshot, attempt_count, is_test)
      values
        (_acct, _txn.id, 'INV-' || to_char(now(),'YYYYMM') || '-' || lpad(_inv_no::text, 6, '0'), 'paid', _txn.currency, _amount_cents, 0, _amount_cents,
         now(), now(), _provider, _payload->>'intent_ref', _txn.provider_customer_ref,
         jsonb_build_object('legal_name', _prof.legal_name, 'billing_email', _prof.billing_email, 'billing_country', _prof.billing_country,
                            'address_line1', _prof.address_line1, 'city', _prof.city, 'state_region', _prof.state_region,
                            'postal_code', _prof.postal_code, 'tax_id_type', _prof.tax_id_type, 'tax_id_value', _prof.tax_id_value),
         1, (select test_mode from public.ad_provider_config where id = 1))
      returning * into _inv;
    end if;
    update public.ad_billing_transactions set invoice_id = _inv.id where id = _txn.id and invoice_id is null;

    perform public._ad_billing_post_ledger(_acct, 'payment_succeeded', -(_amount_cents::bigint * 10000), _txn.currency, 'txn-paid:' || _txn.id::text, _inv.id, _txn.id, null, 'payment settled');
    update public.ad_account_billing_state set last_charge_at = now(), last_charge_status = 'succeeded' where ad_account_id = _acct;
    perform public._ad_billing_set_hold(_acct, false, null);
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_succeeded', null, 'Payment succeeded (' || (_amount_cents/100.0)::numeric(14,2) || ' ' || _txn.currency || ')', jsonb_build_object('transaction_id', _txn.id, 'invoice_id', _inv.id));
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'invoice_paid', null, 'Invoice ' || _inv.invoice_number || ' paid', jsonb_build_object('invoice_id', _inv.id));

  elsif _event_type = 'payment_intent.payment_failed' then
    update public.ad_billing_transactions set status = 'failed', failure_reason = coalesce(_payload->>'failure_reason', 'declined'), provider_event_id = _provider_event_id, updated_at = now() where id = _txn.id;
    perform public._ad_billing_post_ledger(_acct, 'payment_failed', 0, _txn.currency, 'txn-fail:' || _txn.id::text, null, _txn.id, null, 'payment failed');
    update public.ad_account_billing_state set last_charge_at = now(), last_charge_status = 'failed' where ad_account_id = _acct;
    _should_hold := not exists (
      select 1 from public.ad_billing_transactions t2
      where t2.ad_account_id = _acct and t2.txn_type = 'charge' and t2.id <> _txn.id and t2.created_at > _txn.created_at
    ) and (
      coalesce((select case when (select test_mode from public.ad_provider_config where id=1)
                            then test_outstanding_micros else outstanding_micros end
                from public.ad_account_billing_state where ad_account_id = _acct), 0) > 0
    );
    if _should_hold then
      perform public._ad_billing_set_hold(_acct, true, coalesce(_payload->>'failure_reason', 'payment declined'));
    end if;
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_failed', null, 'Payment failed: ' || coalesce(_payload->>'failure_reason','declined'),
            jsonb_build_object('transaction_id', _txn.id, 'held', _should_hold));

  elsif _event_type = 'payment_intent.requires_action' then
    update public.ad_billing_transactions set status = 'requires_action', provider_event_id = _provider_event_id, updated_at = now() where id = _txn.id;
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_requires_action', null, 'Payment needs additional confirmation', jsonb_build_object('transaction_id', _txn.id));

  elsif _event_type = 'payment_intent.canceled' then
    update public.ad_billing_transactions set status = 'canceled', provider_event_id = _provider_event_id, updated_at = now() where id = _txn.id;
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_canceled', null, 'Payment canceled', jsonb_build_object('transaction_id', _txn.id));

  elsif _event_type = 'charge.refunded' then
    _payload_amount := nullif(_payload->>'refund_cents','')::bigint;
    _max_refund := _txn.amount_cents - coalesce(_txn.refunded_amount_cents, 0);
    _refund_cents := coalesce(_payload_amount, _max_refund);
    if _refund_cents <= 0 or _refund_cents > _max_refund then
      update public.ad_billing_webhook_events set error = 'over-refund rejected (req=' || _refund_cents || ' max=' || _max_refund || ')', processed = false, processed_at = now()
       where provider = _provider and provider_event_id = _provider_event_id;
      return jsonb_build_object('ok', false, 'reason', 'over_refund');
    end if;
    if exists (
      select 1 from public.ad_billing_transactions r
      where r.txn_type = 'refund' and r.parent_transaction_id = _txn.id
        and r.provider_ref is not null and r.provider_ref = (_payload->>'refund_ref')
    ) then
      update public.ad_billing_webhook_events set error = 'duplicate refund reference', processed = true, processed_at = now()
       where provider = _provider and provider_event_id = _provider_event_id;
      return jsonb_build_object('ok', true, 'note', 'duplicate refund');
    end if;
    insert into public.ad_billing_transactions
      (ad_account_id, parent_transaction_id, payment_method_id, invoice_id, txn_type, status, amount_cents, currency, provider, provider_customer_ref, provider_ref, provider_event_id, settled_at, is_test)
    values
      (_acct, _txn.id, _txn.payment_method_id, _txn.invoice_id, 'refund', 'succeeded', _refund_cents, _txn.currency, _provider,
       _txn.provider_customer_ref, _payload->>'refund_ref', _provider_event_id, now(), _txn.is_test);
    update public.ad_billing_transactions
       set refunded_amount_cents = refunded_amount_cents + _refund_cents,
           status = (case when refunded_amount_cents + _refund_cents >= amount_cents then 'refunded' else 'partially_refunded' end)::public.ad_billing_txn_status,
           updated_at = now()
     where id = _txn.id;
    perform public._ad_billing_post_ledger(_acct, 'refund', (_refund_cents::bigint * 10000), _txn.currency, 'refund:' || _provider_event_id, _txn.invoice_id, _txn.id, null, 'refund');
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_acct, 'payment_refunded', null, 'Refund processed (' || (_refund_cents/100.0)::numeric(14,2) || ' ' || _txn.currency || ')', jsonb_build_object('transaction_id', _txn.id, 'refund_cents', _refund_cents));

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
revoke all on function public.ad_billing_apply_webhook(public.ad_payment_provider,text,text,boolean,jsonb) from public, anon, authenticated;
