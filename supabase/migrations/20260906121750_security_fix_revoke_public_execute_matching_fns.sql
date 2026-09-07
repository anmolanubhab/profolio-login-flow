-- Correction to earlier hardening: `REVOKE EXECUTE ... FROM anon` alone was
-- insufficient. Postgres grants EXECUTE to PUBLIC by default on CREATE
-- FUNCTION, and every role (including anon) is implicitly a member of
-- PUBLIC -- so the PUBLIC grant alone still permitted anon to call these
-- SECURITY DEFINER functions regardless of the earlier per-role revoke.
-- Each function already rejects a null auth.uid() internally, so this was
-- not an actual data-exposure incident, but the grant itself was not doing
-- what its own comments claimed. Closing it properly now.
revoke execute on function public.calculate_job_match(uuid, uuid) from public;
revoke execute on function public.refresh_job_recommendations_for_candidate(uuid, int) from public;
revoke execute on function public.refresh_job_candidate_matches(uuid, int) from public;
revoke execute on function public.get_job_candidate_matches(uuid, int, int) from public;
revoke execute on function public.normalize_skill_name(text) from public;

grant execute on function public.calculate_job_match(uuid, uuid) to authenticated;
grant execute on function public.refresh_job_recommendations_for_candidate(uuid, int) to authenticated;
grant execute on function public.refresh_job_candidate_matches(uuid, int) to authenticated;
grant execute on function public.get_job_candidate_matches(uuid, int, int) to authenticated;
grant execute on function public.normalize_skill_name(text) to authenticated;
