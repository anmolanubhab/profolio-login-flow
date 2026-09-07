-- Adding p_offset created a new 3-arg overload rather than replacing the
-- old 2-arg signature (Postgres function identity includes parameter
-- list). The 2-arg version is now dead (no caller references it -- both
-- process_new_job_matches and process_pending_new_job_matches call the
-- 3-arg version explicitly) and had the old, non-resumable behavior.
-- Dropping it so only the correct, batching-aware version exists.
drop function if exists public._notify_strong_matches_for_job(uuid, int);
