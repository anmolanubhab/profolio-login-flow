-- Job Matching Phase 1: job_recommendations -- thin ranking/cache layer only.
-- Deliberately does NOT duplicate job_match_scores.explanation; UI reads
-- rank/score here for the fast "Recommended for You" list, then joins to
-- job_match_scores (job_id, candidate_user_id) for full "Why this matches"
-- detail on demand. No client writes -- same server-only pattern as
-- job_match_scores.

create table public.job_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  rank integer not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, job_id)
);

comment on table public.job_recommendations is 'Thin candidate-facing ranking cache. Detailed match explanation lives in job_match_scores, joined by (job_id, candidate_user_id=user_id) -- not duplicated here.';

alter table public.job_recommendations enable row level security;

create policy jr_select_own on public.job_recommendations
  for select
  using (user_id = auth.uid());

-- No insert/update/delete policy -- populated only by a server-side
-- SECURITY DEFINER batch function (added in a later phase), same as
-- job_match_scores.

create index idx_job_recommendations_user_rank on public.job_recommendations(user_id, rank);
create index idx_job_recommendations_job on public.job_recommendations(job_id);
