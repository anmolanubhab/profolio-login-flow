-- =====================================================================
-- Phase K3-A — enum additions (must be a standalone migration: a new enum
-- value cannot be used in the same transaction that adds it).
--
-- K3 = real payment/billing ARCHITECTURE. K3-B runs a SIMULATED provider
-- (test mode, HMAC-signed webhooks, zero real money). K3-C (Stripe,
-- production) is NOT enabled and needs separate explicit approval.
-- =====================================================================

-- provider: 'simulated' is the K3-B provider; 'stripe' (K1) is the future
-- production adapter, not wired yet.
alter type public.ad_payment_provider add value if not exists 'simulated';

-- transaction lifecycle states for a real provider flow
alter type public.ad_billing_txn_status add value if not exists 'processing';
alter type public.ad_billing_txn_status add value if not exists 'requires_action';
alter type public.ad_billing_txn_status add value if not exists 'refunded';
alter type public.ad_billing_txn_status add value if not exists 'partially_refunded';

-- billing audit event types for payments / invoices / holds
alter type public.ad_billing_event_type add value if not exists 'provider_connected';
alter type public.ad_billing_event_type add value if not exists 'payment_started';
alter type public.ad_billing_event_type add value if not exists 'payment_succeeded';
alter type public.ad_billing_event_type add value if not exists 'payment_failed';
alter type public.ad_billing_event_type add value if not exists 'payment_requires_action';
alter type public.ad_billing_event_type add value if not exists 'payment_canceled';
alter type public.ad_billing_event_type add value if not exists 'payment_refunded';
alter type public.ad_billing_event_type add value if not exists 'billing_adjustment';
alter type public.ad_billing_event_type add value if not exists 'invoice_issued';
alter type public.ad_billing_event_type add value if not exists 'invoice_paid';
alter type public.ad_billing_event_type add value if not exists 'account_hold';
alter type public.ad_billing_event_type add value if not exists 'account_hold_cleared';
