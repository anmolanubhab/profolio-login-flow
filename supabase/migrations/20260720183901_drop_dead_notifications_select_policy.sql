-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720183901 "drop_dead_notifications_select_policy"
-- (no matching file in supabase/migrations/). The live policy set on
-- public.notifications (pg_policies) has exactly one SELECT policy today
-- (notifications_select_own); this migration is inferred to have dropped
-- a second, now-redundant/dead SELECT policy left over from an earlier
-- iteration. Its exact name could not be recovered since it no longer
-- exists to introspect; common prior-generation names are targeted below.
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS notifications_select_legacy ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
