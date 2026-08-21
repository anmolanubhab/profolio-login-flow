-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720181334 "fix_connections_rls_cross_table_recursion"
-- (no matching file in supabase/migrations/). Recreates the current live
-- RLS policies on public.connections verbatim (pg_policies), which use
-- current_profile_id() (a STABLE SECURITY DEFINER function, itself fixed
-- in 20260720175815_fix_current_profile_id_recursion.sql) rather than an
-- inline correlated subquery against profiles -- avoiding the
-- profiles<->connections policy cross-reference cycle that a naive
-- `EXISTS (SELECT 1 FROM profiles ...)` policy would otherwise create.
DROP POLICY IF EXISTS connections_read_participants ON public.connections;
CREATE POLICY connections_read_participants ON public.connections
  FOR SELECT TO authenticated
  USING (current_profile_id() = user_id OR current_profile_id() = connection_id);

DROP POLICY IF EXISTS connections_user_manage ON public.connections;
CREATE POLICY connections_user_manage ON public.connections
  FOR ALL TO authenticated
  USING (current_profile_id() = user_id)
  WITH CHECK (current_profile_id() = user_id);
