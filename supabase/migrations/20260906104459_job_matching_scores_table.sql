-- Job Matching Phase 1: job_match_scores -- server-calculated only.
-- No client INSERT/UPDATE/DELETE policy exists at all (mirrors how
-- hiring_applications blocks all direct writes) -- rows are written
-- exclusively by the calculate_job_match() SECURITY DEFINER function
-- added in a later migration.

create table public.job_match_scores (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  candidate_profile_id uuid not null references public.profiles(id) on delete cascade,
  overall_score smallint not null check (overall_score between 0 and 100),
  eligibility_status text not null check (eligibility_status in ('eligible','not_eligible')),
  skills_score smallint,
  experience_score smallint,
  title_score smallint,
  location_score smallint,
  work_mode_score smallint,
  employment_type_score smallint,
  industry_score smallint,
  salary_score smallint,
  explanation jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_user_id)
);

comment on table public.job_match_scores is 'Job matching engine output. Server-calculated only via calculate_job_match(); no client write policy exists. Powers both candidate->jobs and recruiter->candidates directions from the same rows.';

alter table public.job_match_scores enable row level security;

-- Candidate reads their own match rows; recruiter reads rows for jobs they
-- are authorized to recruit for (reusing is_job_recruiter(), the same
-- function already gating job_skill_requirements and hiring_applications).
create policy jms_select on public.job_match_scores
  for select
  using (candidate_user_id = auth.uid() or public.is_job_recruiter(job_id));

-- Deliberately no insert/update/delete policy: RLS defaults to deny, and we
-- do not add a permissive one. Writes happen only via the SECURITY DEFINER
-- calculate_job_match() function (added separately), which bypasses RLS as
-- its owner and enforces authorization in its own body per the requirement
-- that authorization must not rely on RLS alone.

create index idx_jms_job_id on public.job_match_scores(job_id);
create index idx_jms_candidate on public.job_match_scores(candidate_user_id);
create index idx_jms_overall_score on public.job_match_scores(overall_score desc);
