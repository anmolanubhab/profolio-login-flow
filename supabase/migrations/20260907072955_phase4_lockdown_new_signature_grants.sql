-- The 3-arg _notify_strong_matches_for_job is a distinct function identity
-- from the old 2-arg one (now dropped), so it received Postgres's default
-- PUBLIC/anon/authenticated EXECUTE grants fresh -- same class of gap
-- caught earlier this phase. Lock it down to internal-only, matching every
-- other underscore-prefixed helper in this matching pipeline.
revoke all on function public._notify_strong_matches_for_job(uuid, int, int) from public, anon, authenticated;
