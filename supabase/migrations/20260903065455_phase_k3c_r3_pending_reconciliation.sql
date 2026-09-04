-- Phase K3-C Remediation R3: operational recovery (D1)
--   - list stuck pending / processing transactions
--   - resolve a pending transaction from an AUTHORITATIVE provider status
--     ("unknown" never becomes succeeded)
-- The provider-status lookup itself lives in the ad-billing-reconcile edge
-- function (provider interface); this is the idempotent DB apply path.

create or replace function public.ad_billing_list_stuck_transactions(_older_than_minutes int default 30)
returns table (
  id uuid, ad_account_id uuid, amount_cents bigint, currency text, status public.ad_billing_txn_status,
  provider public.ad_payment_provider, provider_ref text, idempotency_key text, created_at timestamptz, is_test boolean
)
language sql stable security definer set search_path = public
as $$
  select t.id, t.ad_account_id, t.amount_cents, t.currency, t.status, t.provider, t.provider_ref,
         t.idempotency_key, t.created_at, t.is_test
  from public.ad_billing_transactions t
  where t.txn_type = 'charge'
    and t.status in ('pending','processing')
    and t.created_at < now() - make_interval(mins => greatest(_older_than_minutes, 1))
  order by t.created_at;
$$;
revoke all on function public.ad_billing_list_stuck_transactions(int) from public, anon, authenticated;

-- Idempotent: resolve a pending/processing charge from a verified provider
-- status. Reuses the same terminal-state discipline as the webhook processor.
create or replace function public.ad_billing_resolve_pending_transaction(
  _txn_id uuid, _resolved_status text, _provider_ref text default null, _failure_reason text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare _t public.ad_billing_transactions; _synth_event text;
begin
  select * into _t from public.ad_billing_transactions where id = _txn_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if _t.status not in ('pending','processing','requires_action') then
    return jsonb_build_object('ok', true, 'note', 'already ' || _t.status);
  end if;

  if _resolved_status = 'succeeded' then
    _synth_event := 'payment_intent.succeeded';
  elsif _resolved_status = 'failed' then
    _synth_event := 'payment_intent.payment_failed';
  elsif _resolved_status = 'canceled' then
    _synth_event := 'payment_intent.canceled';
  elsif _resolved_status = 'requires_action' then
    _synth_event := 'payment_intent.requires_action';
  else
    -- 'processing' / 'unknown' -> do NOT resolve; record a reconciliation marker
    insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
    values (_t.ad_account_id, 'billing_adjustment', auth.uid(),
            'Reconciliation: transaction still ' || coalesce(_resolved_status,'unknown') || ' at provider',
            jsonb_build_object('transaction_id', _t.id, 'resolved_status', _resolved_status));
    return jsonb_build_object('ok', true, 'note', 'left pending (' || coalesce(_resolved_status,'unknown') || ')');
  end if;

  -- apply through the authoritative processor with a synthetic, signed-context event
  return public.ad_billing_apply_webhook(
    _t.provider,
    'reconcile:' || _t.id::text || ':' || _resolved_status,
    _synth_event,
    true,
    jsonb_build_object(
      'idempotency_key', _t.idempotency_key,
      'intent_ref', coalesce(_provider_ref, _t.provider_ref),
      'amount_cents', _t.amount_cents,
      'failure_reason', coalesce(_failure_reason, 'reconciled'),
      'ad_account_id', _t.ad_account_id
    )
  );
end;
$$;
revoke all on function public.ad_billing_resolve_pending_transaction(uuid,text,text,text) from public, anon, authenticated;
