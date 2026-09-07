-- Phase 3: paginated, ranked read of hiring_match_scores for a job, safe
-- for a recruiter's UI. SECURITY DEFINER so it can join profiles (bypassing
-- the owner-restricted parts of profile visibility) but ONLY exposes the
-- same safe fields search_candidates() already exposes to recruiters
-- (display_name, headline/profession, location, avatar_url) -- never
-- email/phone/connections. Authorization + not-blocked re-checked in-body
-- (SECURITY DEFINER functions are not subject to RLS as the table owner).
create or replace function public.get_job_candidate_matches(p_job_id uuid, p_limit int default 20, p_offset int default 0)
returns table(
  candidate_profile_id uuid,
  candidate_user_id uuid,
  display_name text,
  headline text,
  location text,
  avatar_url text,
  score numeric,
  eligibility_status text,
  matched_skills jsonb,
  missing_skills jsonb,
  skills_score smallint,
  experience_score smallint,
  title_score smallint,
  location_score smallint,
  work_mode_score smallint,
  employment_type_score smallint,
  industry_score smallint,
  salary_score smallint,
  has_applied boolean
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_job_recruiter(p_job_id) then
    raise exception 'Not authorized to view candidate matches for this job';
  end if;

  return query
  select
    hms.candidate_profile_id,
    hms.candidate_user_id,
    p.display_name,
    p.profession as headline,
    p.location,
    p.avatar_url,
    hms.score,
    hms.eligibility_status,
    hms.matched_skills,
    hms.missing_skills,
    hms.skills_score,
    hms.experience_score,
    hms.title_score,
    hms.location_score,
    hms.work_mode_score,
    hms.employment_type_score,
    hms.industry_score,
    hms.salary_score,
    exists(
      select 1 from public.hiring_applications ha
      where ha.job_id = p_job_id and ha.candidate_user_id = hms.candidate_user_id
    ) as has_applied
  from public.hiring_match_scores hms
  join public.profiles p on p.id = hms.candidate_profile_id
  where hms.job_id = p_job_id
    and hms.eligibility_status = 'eligible'
    and not public.is_blocked_by(hms.candidate_profile_id)
  order by hms.score desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
end;
$$;

revoke execute on function public.get_job_candidate_matches(uuid, int, int) from anon;

comment on function public.get_job_candidate_matches(uuid, int, int) is 'Paginated, ranked read of hiring_match_scores for a job (recruiter side). Only eligible candidates, not-blocked re-checked in-body. Exposes only the same safe profile fields search_candidates() already exposes -- no email/phone/connections.';
