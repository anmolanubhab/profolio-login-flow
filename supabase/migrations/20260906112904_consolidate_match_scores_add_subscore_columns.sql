-- Job Matching consolidation: hiring_match_scores becomes the SINGLE
-- canonical match-score table (already live-wired into MyApplications.tsx,
-- HiringPipeline.tsx, ApplicationDetailsSheet.tsx via `score`,
-- `matched_skills`, `missing_skills`, `explanation`, `computed_at` -- all
-- preserved unchanged below). Adding only the missing sub-scores.

alter table public.hiring_match_scores
  add column if not exists eligibility_status text not null default 'not_eligible' check (eligibility_status in ('eligible','not_eligible')),
  add column if not exists skills_score smallint,
  add column if not exists experience_score smallint,
  add column if not exists title_score smallint,
  add column if not exists location_score smallint,
  add column if not exists work_mode_score smallint,
  add column if not exists employment_type_score smallint,
  add column if not exists industry_score smallint,
  add column if not exists salary_score smallint;

comment on table public.hiring_match_scores is 'Canonical job-matching table (both directions: candidate->jobs and recruiter->candidates). Populated exclusively by calculate_job_match(). score/matched_skills/missing_skills/explanation/computed_at predate this consolidation and power MyApplications.tsx, HiringPipeline.tsx, ApplicationDetailsSheet.tsx unchanged; the *_score columns are new detail added alongside them.';
