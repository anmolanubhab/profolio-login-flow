-- Job Matching Phase 1: point-in-time match score snapshot on the single
-- authoritative application row (unique (job_id, candidate_user_id) already
-- enforced -- one row per application, so a column is correct here, not a
-- separate snapshot table). Set only inside apply_to_job(); never client-writable
-- (hiring_applications already blocks all direct client INSERT/UPDATE/DELETE).

alter table public.hiring_applications
  add column if not exists match_score_at_apply smallint check (match_score_at_apply is null or match_score_at_apply between 0 and 100);

comment on column public.hiring_applications.match_score_at_apply is 'Snapshot of job_match_scores.overall_score at the moment of application, set exclusively inside apply_to_job(). Never accepts a client-provided value.';
