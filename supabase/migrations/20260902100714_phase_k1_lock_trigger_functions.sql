-- =====================================================================
-- Phase K1 follow-up — lock billing trigger functions
--
-- The K1 billing trigger functions are SECURITY DEFINER (they must be, to
-- write ad_billing_events / maintain derived status past RLS). They run as
-- trigger bodies regardless of grants, so there is no reason for anon or
-- authenticated to be able to invoke them as PostgREST RPCs. Revoke it.
-- =====================================================================

revoke all on function public._ad_billing_profile_status_biu()      from public, anon, authenticated;
revoke all on function public._ad_billing_touch_profile_status()    from public, anon, authenticated;
revoke all on function public._ad_payment_method_default_biu()      from public, anon, authenticated;
revoke all on function public._ad_payment_method_default_ad()       from public, anon, authenticated;
revoke all on function public._ad_billing_audit()                   from public, anon, authenticated;
