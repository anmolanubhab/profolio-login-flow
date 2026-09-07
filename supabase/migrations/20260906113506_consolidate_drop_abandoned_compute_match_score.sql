-- Verified immediately beforehand: no triggers, no other function
-- references, no frontend .rpc() callers, no pg_cron job. Also confirmed in
-- the deeper audit that it references public.user_skills, which does not
-- exist -- it would error if ever invoked. Superseded entirely by
-- calculate_job_match(), the canonical engine.
drop function if exists public.compute_match_score(uuid, uuid);
