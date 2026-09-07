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
  v_coarse_limit int := 200;
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

  delete from public.job_recommendations where user_id = p_user_id;

  -- Canonical source is now hiring_match_scores (candidate_user_id column),
  -- not the retired job_match_scores.
  insert into public.job_recommendations (user_id, job_id, score, rank, expires_at)
  select p_user_id, hms.job_id, hms.score::smallint,
         row_number() over (order by hms.score desc, hms.computed_at desc),
         now() + interval '7 days'
  from public.hiring_match_scores hms
  where hms.candidate_user_id = p_user_id
    and hms.eligibility_status = 'eligible'
  order by hms.score desc
  limit p_limit;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.refresh_job_recommendations_for_candidate(uuid, int) from anon;

comment on function public.refresh_job_recommendations_for_candidate(uuid, int) is 'Batch-refreshes job_recommendations for one candidate, sourced from the canonical hiring_match_scores (not job_match_scores, retired). Coarse-filters open jobs before scoring.';
