-- Job Matching Phase 1: indexes for the new/reused columns actually used by
-- calculate_job_match() and the coarse recommendation filter. jobs.status
-- and job_skill_requirements.job_id already had indexes (idx_jobs_status_posted,
-- idx_job_skill_job) confirmed via pg_indexes -- not duplicated here.

create index if not exists idx_jobs_remote_option on public.jobs(remote_option);
create index if not exists idx_jobs_employment_type on public.jobs(employment_type);
create index if not exists idx_jobs_experience_level on public.jobs(experience_level);

-- Expression indexes matching exactly what calculate_job_match()'s
-- normalize_skill_name() comparisons do, so those exists() lookups can use
-- an index instead of a per-row function call scan.
create index if not exists idx_skills_normalized_name on public.skills(user_id, public.normalize_skill_name(skill_name));
create index if not exists idx_jsr_normalized_name on public.job_skill_requirements(job_id, public.normalize_skill_name(skill_name));
