-- =====================================================================
-- Phase K3-C Stripe Sandbox Preparation — task 4
--
-- Defence-in-depth: a transaction can never be refunded for more than it
-- charged. Until now this invariant lived only in ad_billing_apply_webhook
-- (the over_refund guard). Make it a hard table constraint so no future
-- code path — including a real provider adapter — can violate it.
--
-- Verified before applying: 0 of 5 existing rows would violate.
-- Still simulated / test mode. No Stripe, no config change.
-- =====================================================================

alter table public.ad_billing_transactions
  add constraint ad_billing_transactions_refund_not_over_chk
  check (coalesce(refunded_amount_cents, 0) <= amount_cents) not valid;

alter table public.ad_billing_transactions
  validate constraint ad_billing_transactions_refund_not_over_chk;

comment on constraint ad_billing_transactions_refund_not_over_chk on public.ad_billing_transactions is
  'refunded_amount_cents may never exceed amount_cents (over-refund guard at the DB level).';
