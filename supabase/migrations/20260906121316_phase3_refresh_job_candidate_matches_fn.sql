-- Phase 3: Job -> Candidates batch matching. Reuses the SAME canonical
-- engine (calculate_job_match) and the SAME canonical table
-- (hiring_match_scores) -- no new scoring engine, no new score table.
--
-- Two candidate pools, scored with different consent bases:
--   A) Applicants to this job -- consent is implicit via the act of
--      applying, scored regardless of open_to_work/actively_looking.
--   B) Non-applicants who are open_to_work OR actively_looking, gated by
--      the SAME recruiter-discovery consent search_candidates() already
--      requires (allow_recruiter_search + public visibility +
--      profile_discovery, not blocked) -- reusing that existing consent
--      model rather than inventing a new one, since these candidates did
--      not proactively apply to this specific job.
create or replace function public.refresh_job_candidate_matches(p_job_id uuid, p_limit int default 200)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_candidate_user_id uuid;
  v_count int := 0;
  v_job record;
begin
  if not public.is_job_recruiter(p_job_id) then
    raise exception 'Not authorized to refresh candidate matches for this job';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  -- Pool A: applicants.
  for v_candidate_user_id in
    select distinct ha.candidate_user_id
    from public.hiring_applications ha
    where ha.job_id = p_job_id
  loop
    perform public.calculate_job_match(p_job_id, v_candidate_user_id);
    v_count := v_count + 1;
  end loop;

  -- Pool B: open-to-work / actively-looking non-applicants, consent-gated,
  -- coarse-filtered, bounded before the expensive scoring call.
  for v_candidate_user_id in
    select p.user_id
    from public.profiles p
    where (p.open_to_work = true or p.actively_looking = true)
      and p.allow_recruiter_search = true
      and p.profile_visibility = 'public'
      and p.profile_discovery is not false
      and not public.is_blocked_by(p.id)
      and not exists (
        select 1 from public.hiring_applications ha
        where ha.job_id = p_job_id and ha.candidate_user_id = p.user_id
      )
      and (
        p.open_to_roles is null or array_length(p.open_to_roles, 1) is null
        or exists (select 1 from unnest(p.open_to_roles) r where v_job.title ilike '%' || r || '%')
        or p.preferred_locations is null or array_length(p.preferred_locations, 1) is null
        or exists (select 1 from unnest(p.preferred_locations) l where v_job.location ilike '%' || l || '%')
        or (v_job.remote_option = 'remote' and exists (select 1 from unnest(coalesce(p.preferred_work_modes, '{}')) m where lower(m) = 'remote'))
      )
    order by p.last_active_at desc nulls last
    limit p_limit
  loop
    perform public.calculate_job_match(p_job_id, v_candidate_user_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.refresh_job_candidate_matches(uuid, int) from anon;

comment on function public.refresh_job_candidate_matches(uuid, int) is 'Job->Candidates batch scorer. Recruiter-triggered (manual refresh, Phase 3 scope). Scores applicants (implicit consent) + open-to-work/actively-looking non-applicants (gated by the same allow_recruiter_search consent search_candidates() requires). Writes only to hiring_match_scores via calculate_job_match().';
