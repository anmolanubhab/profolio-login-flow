-- Strict tightening: ops monitoring tables must never be discoverable
-- without an admin session. RLS already blocks rows; also remove the
-- base grants so they drop out of the anon/authenticated GraphQL schema.
revoke all on public.ad_billing_ops_log    from anon, authenticated;
revoke all on public.ad_billing_ops_config from anon, authenticated;
-- admins read the log through ad_billing_ops_recent() (SECURITY DEFINER,
-- internal has_role gate); config is service-role / migration managed.
