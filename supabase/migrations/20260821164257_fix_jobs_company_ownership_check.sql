-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260821164257 "fix_jobs_company_ownership_check" (no
-- matching file in supabase/migrations/). Recreates the current live
-- INSERT/UPDATE policies on public.jobs verbatim (pg_policies): posting or
-- editing a job now additionally requires that, when company_id is set,
-- the caller is an admin of that company (is_company_admin), closing a
-- gap where any authenticated user could attach an arbitrary company_id
-- to a job they posted.
DROP POLICY IF EXISTS jobs_user_create ON public.jobs;
CREATE POLICY jobs_user_create ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = jobs.posted_by AND p.user_id = auth.uid())
    AND (company_id IS NULL OR is_company_admin(auth.uid(), company_id))
  );

DROP POLICY IF EXISTS jobs_user_update ON public.jobs;
CREATE POLICY jobs_user_update ON public.jobs
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = jobs.posted_by AND p.user_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = jobs.posted_by AND p.user_id = auth.uid())
    AND (company_id IS NULL OR is_company_admin(auth.uid(), company_id))
  );
