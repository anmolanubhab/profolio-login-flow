-- The single canonical matching engine, now writing ONLY to
-- hiring_match_scores (upsert keyed on its real unique constraint
-- (job_id, candidate_profile_id)). Populates the pre-existing UI-contract
-- columns (score, matched_skills, missing_skills, explanation, computed_at)
-- alongside the new sub-score columns. search_path pinned; authorization
-- enforced in-body, not RLS-only.
drop function if exists public.calculate_job_match(uuid, uuid);

create or replace function public.calculate_job_match(p_job_id uuid, p_candidate_user_id uuid)
returns public.hiring_match_scores
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_job record;
  v_candidate_profile_id uuid;
  v_required_total int := 0;
  v_required_matched int := 0;
  v_preferred_total int := 0;
  v_preferred_matched int := 0;
  v_matched_skills text[] := '{}';
  v_missing_required text[] := '{}';
  v_missing_preferred text[] := '{}';
  v_candidate_years numeric := 0;
  v_eligible boolean := true;
  v_eligibility_reasons text[] := '{}';
  v_skills_score int; v_experience_score int; v_title_score int;
  v_location_score int; v_work_mode_score int; v_employment_type_score int;
  v_industry_score int; v_salary_score int; v_salary_status text;
  v_overall int;
  v_title_overlap numeric;
  v_explanation jsonb;
  v_row public.hiring_match_scores;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;
  if v_caller <> p_candidate_user_id and not public.is_job_recruiter(p_job_id) then
    raise exception 'Not authorized to calculate this match';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  select id into v_candidate_profile_id from public.profiles where user_id = p_candidate_user_id;
  if v_candidate_profile_id is null then
    raise exception 'Candidate profile not found';
  end if;

  select coalesce(sum(
    (coalesce(e.end_date, current_date) - e.start_date) / 365.25
  ), 0)
  into v_candidate_years
  from public.experience e
  where e.user_id = v_candidate_profile_id and e.start_date is not null;

  select
    count(*) filter (where jsr.is_required),
    count(*) filter (where jsr.is_required and exists (
      select 1 from public.skills s where s.user_id = v_candidate_profile_id
        and public.normalize_skill_name(s.skill_name) = public.normalize_skill_name(jsr.skill_name)
    )),
    count(*) filter (where not jsr.is_required),
    count(*) filter (where not jsr.is_required and exists (
      select 1 from public.skills s where s.user_id = v_candidate_profile_id
        and public.normalize_skill_name(s.skill_name) = public.normalize_skill_name(jsr.skill_name)
    )),
    coalesce(array_agg(jsr.skill_name) filter (where exists (
      select 1 from public.skills s where s.user_id = v_candidate_profile_id
        and public.normalize_skill_name(s.skill_name) = public.normalize_skill_name(jsr.skill_name)
    )), '{}'),
    coalesce(array_agg(jsr.skill_name) filter (where jsr.is_required and not exists (
      select 1 from public.skills s where s.user_id = v_candidate_profile_id
        and public.normalize_skill_name(s.skill_name) = public.normalize_skill_name(jsr.skill_name)
    )), '{}'),
    coalesce(array_agg(jsr.skill_name) filter (where not jsr.is_required and not exists (
      select 1 from public.skills s where s.user_id = v_candidate_profile_id
        and public.normalize_skill_name(s.skill_name) = public.normalize_skill_name(jsr.skill_name)
    )), '{}')
  into v_required_total, v_required_matched, v_preferred_total, v_preferred_matched,
       v_matched_skills, v_missing_required, v_missing_preferred
  from public.job_skill_requirements jsr
  where jsr.job_id = p_job_id;

  -- HARD ELIGIBILITY -- overrides ranking regardless of overall score.
  if v_required_total > 0 and v_required_matched < v_required_total then
    v_eligible := false;
    v_eligibility_reasons := array_append(v_eligibility_reasons, 'missing_required_skill');
  end if;
  if v_job.min_experience_years is not null and v_candidate_years < v_job.min_experience_years then
    v_eligible := false;
    v_eligibility_reasons := array_append(v_eligibility_reasons, 'insufficient_experience');
  end if;

  v_skills_score := round(
    least(
      30.0 * (case when v_required_total = 0 then 1 else v_required_matched::numeric / v_required_total end)
      + 5.0 * (case when v_preferred_total = 0 then 0 else v_preferred_matched::numeric / v_preferred_total end),
      35
    )
  );

  if v_job.min_experience_years is null and v_job.max_experience_years is null then
    v_experience_score := 20;
  elsif v_job.max_experience_years is not null and v_candidate_years >= coalesce(v_job.min_experience_years, 0) and v_candidate_years <= v_job.max_experience_years then
    v_experience_score := 20;
  elsif v_job.max_experience_years is not null and v_candidate_years > v_job.max_experience_years then
    v_experience_score := 16;
  elsif v_job.min_experience_years is not null then
    v_experience_score := round(20.0 * least(v_candidate_years / greatest(v_job.min_experience_years, 0.1), 1));
  else
    v_experience_score := 20;
  end if;

  select coalesce(max(
    (select count(*) from unnest(string_to_array(lower(v_job.title), ' ')) t
       where t = any(string_to_array(lower(role), ' ')))::numeric
    / greatest(array_length(string_to_array(lower(v_job.title), ' '), 1), 1)
  ), 0)
  into v_title_overlap
  from unnest(coalesce((select open_to_roles from public.profiles where id = v_candidate_profile_id), '{}')) as role;
  v_title_score := round(15 * least(v_title_overlap, 1));

  declare v_pref_locations text[]; v_pref_modes text[]; v_job_type text[]; v_pref_industries text[];
  begin
    select preferred_locations, preferred_work_modes, job_type, preferred_industries
    into v_pref_locations, v_pref_modes, v_job_type, v_pref_industries
    from public.profiles where id = v_candidate_profile_id;

    if v_pref_locations is null or array_length(v_pref_locations, 1) is null then
      v_location_score := 5;
    elsif v_job.remote_option = 'remote' and exists (select 1 from unnest(v_pref_modes) m where lower(m) = 'remote') then
      v_location_score := 10;
    elsif v_job.location is not null and exists (
      select 1 from unnest(v_pref_locations) l where v_job.location ilike '%' || l || '%' or l ilike '%' || v_job.location || '%'
    ) then
      v_location_score := 10;
    else
      v_location_score := 0;
    end if;

    if v_pref_modes is null or array_length(v_pref_modes, 1) is null or v_job.remote_option is null then
      v_work_mode_score := 3;
    elsif exists (select 1 from unnest(v_pref_modes) m where lower(m) = lower(v_job.remote_option)) then
      v_work_mode_score := 5;
    else
      v_work_mode_score := 0;
    end if;

    if v_job_type is null or array_length(v_job_type, 1) is null or v_job.employment_type is null then
      v_employment_type_score := 3;
    elsif exists (select 1 from unnest(v_job_type) t where lower(t) = lower(v_job.employment_type)) then
      v_employment_type_score := 5;
    else
      v_employment_type_score := 0;
    end if;

    if v_pref_industries is null or array_length(v_pref_industries, 1) is null or v_job.industry is null then
      v_industry_score := 3;
    elsif exists (select 1 from unnest(v_pref_industries) i where lower(i) = lower(v_job.industry)) then
      v_industry_score := 5;
    else
      v_industry_score := 0;
    end if;
  end;

  declare v_cand_min numeric; v_cand_max numeric;
  begin
    select salary_min_expected, salary_max_expected into v_cand_min, v_cand_max
    from public.profiles where id = v_candidate_profile_id;

    if v_cand_min is null and v_cand_max is null then
      v_salary_score := 3; v_salary_status := 'unknown';
    elsif v_job.salary_min is null and v_job.salary_max is null then
      v_salary_score := 3; v_salary_status := 'unknown';
    elsif coalesce(v_cand_min, 0) <= coalesce(v_job.salary_max, v_job.salary_min, 1e18)
          and coalesce(v_cand_max, 1e18) >= coalesce(v_job.salary_min, 0) then
      v_salary_score := 5; v_salary_status := 'match';
    else
      v_salary_score := 0; v_salary_status := 'mismatch';
    end if;
  end;

  v_overall := v_skills_score + v_experience_score + v_title_score + v_location_score
             + v_work_mode_score + v_employment_type_score + v_industry_score + v_salary_score;

  v_explanation := jsonb_build_object(
    'skills', jsonb_build_object('required_total', v_required_total, 'required_matched', v_required_matched,
                                  'preferred_total', v_preferred_total, 'preferred_matched', v_preferred_matched,
                                  'missing_required', v_missing_required, 'missing_preferred', v_missing_preferred),
    'experience', jsonb_build_object('candidate_years', round(v_candidate_years, 1),
                                      'min_required', v_job.min_experience_years, 'max_target', v_job.max_experience_years),
    'title', jsonb_build_object('overlap_ratio', round(v_title_overlap, 2)),
    'location', jsonb_build_object('score', v_location_score),
    'work_mode', jsonb_build_object('job_mode', v_job.remote_option, 'score', v_work_mode_score),
    'employment_type', jsonb_build_object('job_type', v_job.employment_type, 'score', v_employment_type_score),
    'industry', jsonb_build_object('job_industry', v_job.industry, 'score', v_industry_score),
    'salary', jsonb_build_object('status', v_salary_status, 'score', v_salary_score),
    'eligibility_reasons', v_eligibility_reasons,
    'method', 'calculate_job_match_v2'
  );

  insert into public.hiring_match_scores(
    job_id, candidate_profile_id, candidate_user_id, score, matched_skills, missing_skills, explanation,
    computed_at, eligibility_status, skills_score, experience_score, title_score, location_score,
    work_mode_score, employment_type_score, industry_score, salary_score
  ) values (
    p_job_id, v_candidate_profile_id, p_candidate_user_id, v_overall,
    to_jsonb(v_matched_skills), to_jsonb(v_missing_required || v_missing_preferred), v_explanation,
    now(), case when v_eligible then 'eligible' else 'not_eligible' end,
    v_skills_score, v_experience_score, v_title_score, v_location_score,
    v_work_mode_score, v_employment_type_score, v_industry_score, v_salary_score
  )
  on conflict (job_id, candidate_profile_id) do update set
    candidate_user_id = excluded.candidate_user_id,
    score = excluded.score,
    matched_skills = excluded.matched_skills,
    missing_skills = excluded.missing_skills,
    explanation = excluded.explanation,
    computed_at = now(),
    eligibility_status = excluded.eligibility_status,
    skills_score = excluded.skills_score,
    experience_score = excluded.experience_score,
    title_score = excluded.title_score,
    location_score = excluded.location_score,
    work_mode_score = excluded.work_mode_score,
    employment_type_score = excluded.employment_type_score,
    industry_score = excluded.industry_score,
    salary_score = excluded.salary_score
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.calculate_job_match(uuid, uuid) from anon;

comment on function public.calculate_job_match(uuid, uuid) is 'THE single canonical matching engine (candidate->jobs and recruiter->candidates both call this). Writes exclusively to hiring_match_scores. Hard eligibility evaluated and stored separately from score. Authorization enforced in-body.';
