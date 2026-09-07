-- Job Matching Phase 1: security hardening per advisor findings.
-- 1) normalize_skill_name was missing a pinned search_path (mutable
--    search_path is a real risk for SECURITY DEFINER callers, even though
--    this particular function is not itself SECURITY DEFINER -- pin it for
--    defense in depth and consistency with the other new functions).
create or replace function public.normalize_skill_name(p_name text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select regexp_replace(
    regexp_replace(lower(trim(p_name)), '\s+', '', 'g'),
    '\.?js$', '', 'i'
  );
$$;

-- 2) job_match_scores / job_recommendations: RLS already blocks anon in
--    practice (auth.uid() is null for anon, so every policy row-check
--    evaluates false), but the anon role still holds a table-level SELECT
--    grant by default. Revoke it explicitly -- this data should never be
--    reachable pre-login, defense in depth alongside RLS.
revoke select on public.job_match_scores from anon;
revoke select on public.job_recommendations from anon;

-- 3) calculate_job_match / refresh_job_recommendations_for_candidate:
--    both already raise 'Not authenticated' for a null auth.uid(), but
--    anon holds EXECUTE by default on any newly created function. Revoke it
--    so an anonymous request cannot even attempt the call.
revoke execute on function public.calculate_job_match(uuid, uuid) from anon;
revoke execute on function public.refresh_job_recommendations_for_candidate(uuid, int) from anon;
