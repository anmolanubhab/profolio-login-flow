-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720175337 "add_job_applications_rls_policies"
-- (no matching file in supabase/migrations/). Recreates the current live
-- RLS policies on public.job_applications verbatim (pg_policies).
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_applications_select_own ON public.job_applications;
CREATE POLICY job_applications_select_own ON public.job_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS job_applications_insert_own ON public.job_applications;
CREATE POLICY job_applications_insert_own ON public.job_applications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS job_applications_update_own ON public.job_applications;
CREATE POLICY job_applications_update_own ON public.job_applications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS job_applications_delete_own ON public.job_applications;
CREATE POLICY job_applications_delete_own ON public.job_applications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
