-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720175136 "fix_legacy_views_security_invoker"
-- (no matching file in supabase/migrations/). Confirmed live via
-- pg_class.reloptions = {security_invoker=true} on both views below.
-- Without security_invoker, a view defined by a privileged role runs with
-- that role's (definer's) permissions/RLS bypass rather than the querying
-- user's, which can leak rows the caller shouldn't see. Setting
-- security_invoker=true makes the view honor the querying user's own RLS.
ALTER VIEW public.applications_legacy SET (security_invoker = true);
ALTER VIEW public.job_applications_legacy SET (security_invoker = true);
