-- hiring_match_scores had default broad grants (anon+authenticated: INSERT/
-- SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER). RLS (already enabled,
-- confirmed via pg_class.relrowsecurity) blocks INSERT/UPDATE via
-- with_check/qual false and blocks DELETE by having no permissive policy at
-- all, so this was not exploitable via PostgREST -- but tightening the
-- grants themselves is strictly a hardening, matching the same defense-in-
-- depth already applied to job_match_scores/job_recommendations in Phase 1.
revoke all on public.hiring_match_scores from anon;
revoke insert, update, delete, truncate, trigger, references on public.hiring_match_scores from authenticated;
-- authenticated keeps SELECT only, gated by the existing hms_select policy.
