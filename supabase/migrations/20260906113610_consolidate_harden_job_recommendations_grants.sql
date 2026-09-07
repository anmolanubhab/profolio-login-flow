-- job_recommendations still had default anon INSERT/UPDATE/DELETE/TRUNCATE/
-- REFERENCES/TRIGGER grants (only SELECT was revoked from anon in Phase 1).
-- RLS already blocks these functionally (no write policy exists), but
-- tightening the grants themselves for consistency with the same hardening
-- just applied to hiring_match_scores.
revoke all on public.job_recommendations from anon;
revoke insert, update, delete, truncate, trigger, references on public.job_recommendations from authenticated;
