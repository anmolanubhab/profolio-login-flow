-- =====================================================================
-- Phase F hardening: lock the internal audience helpers.
--
-- Supabase's default privileges grant EXECUTE on every new public function
-- to `authenticated`, `anon` and `service_role`. For `_ad_audience_count`
-- that is a privacy hole: it is SECURITY DEFINER (bypasses RLS) and takes a
-- raw spec with NO authorization check, so a signed-in user could call
-- /rest/v1/rpc/_ad_audience_count directly and probe the whole member base,
-- bypassing the is_ad_account_admin() gate in ad_audience_preview_reach.
--
-- These three helpers must only ever be reachable as the function owner
-- (postgres) via the wrapper RPCs. Revoke EXECUTE from every client role.
-- =====================================================================

revoke execute on function public._ad_like_terms(jsonb) from authenticated, anon, service_role, public;
revoke execute on function public._ad_profile_years_experience(uuid) from authenticated, anon, service_role, public;
revoke execute on function public._ad_audience_count(jsonb) from authenticated, anon, service_role, public;
