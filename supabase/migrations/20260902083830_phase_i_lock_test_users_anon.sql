-- Phase I hardening: keep the test-user allowlist out of the logged-out
-- GraphQL/PostgREST schema. RLS already denies anon every row (the policy
-- needs has_role(auth.uid(),'admin')); this also removes discoverability.
revoke all on public.ad_delivery_test_users from anon;
