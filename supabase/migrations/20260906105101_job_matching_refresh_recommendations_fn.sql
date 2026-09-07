-- Job Matching Phase 1: batch recommendation refresh for one candidate.
-- Coarse-filters to a bounded candidate set of open jobs BEFORE running the
-- (relatively expensive) calculate_job_match() on each -- never scores
-- every job in the table. Only eligible jobs are ranked/stored; ineligible
-- ones are scored (for the job_match_scores debug trail) but excluded from
-- the recommendation ranking itself, per "only eligible candidates receive
-- normal ranking."
create or replace function public.refresh_job_recommendations_for_candidate(p_user_id uuid, p_limit int default 20)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_profile record;
  v_job_id uuid;
  v_count int := 0;
  v_coarse_limit int := 200; -- bound on jobs actually scored per refresh
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;
  if v_caller <> p_user_id then
    raise exception 'Not authorized to refresh recommendations for another user';
  end if;

  select * into v_profile from public.profiles where user_id = p_user_id;
  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  -- Coarse filter: open jobs, loosely matching stated title/location/work-mode
  -- preference where any preference is set, otherwise just recent open jobs.
  -- This keeps the number of calculate_job_match() calls bounded regardless
  -- of total job-table size.
  for v_job_id in
    select j.id
    from public.jobs j
    where j.status = 'open'
      and (
        v_profile.open_to_roles is null or array_length(v_profile.open_to_roles, 1) is null
        or exists (select 1 from unnest(v_profile.open_to_roles) r where j.title ilike '%' || r || '%')
        or v_profile.preferred_locations is null or array_length(v_profile.preferred_locations, 1) is null
        or exists (select 1 from unnest(v_profile.preferred_locations) l where j.location ilike '%' || l || '%')
        or (j.remote_option = 'remote' and exists (select 1 from unnest(coalesce(v_profile.preferred_work_modes, '{}')) m where lower(m) = 'remote'))
      )
    order by j.posted_at desc
    limit v_coarse_limit
  loop
    perform public.calculate_job_match(v_job_id, p_user_id);
  end loop;

  -- Replace this candidate's recommendation ranking from the freshly
  -- computed (or freshly re-validated) eligible scores only.
  delete from public.job_recommendations where user_id = p_user_id;

  insert into public.job_recommendations (user_id, job_id, score, rank, expires_at)
  select p_user_id, jms.job_id, jms.overall_score,
         row_number() over (order by jms.overall_score desc, jms.calculated_at desc),
         now() + interval '7 days'
  from public.job_match_scores jms
  where jms.candidate_user_id = p_user_id
    and jms.eligibility_status = 'eligible'
  order by jms.overall_score desc
  limit p_limit;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.refresh_job_recommendations_for_candidate(uuid, int) is 'Batch-refreshes job_recommendations for one candidate. Coarse-filters open jobs before scoring (bounded to 200 per call) -- never scores the entire jobs table. Only eligible matches are ranked into job_recommendations.';
