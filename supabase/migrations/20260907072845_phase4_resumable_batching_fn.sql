-- Adds p_offset support and a stable secondary sort key (p.user_id) so
-- OFFSET/LIMIT pagination is deterministic across repeated calls (ties on
-- last_active_at, including NULLs, would otherwise not have a guaranteed
-- stable order). At the end, advances matches_processed_offset and sets
-- matches_fully_processed = true only when this batch returned FEWER
-- candidates than p_limit (i.e. the coarse-filtered pool is exhausted) --
-- otherwise the job stays eligible for the NEXT cron tick's batch.
-- Everything else (consent filters, scoring via _calculate_job_match_core,
-- threshold, job_recommendations upsert, idempotent notification) is
-- unchanged from the previous version.
create or replace function public._notify_strong_matches_for_job(p_job_id uuid, p_limit int default 200, p_offset int default 0)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_job record;
  v_candidate_user_id uuid;
  v_notified int := 0;
  v_considered int := 0;
  v_match public.hiring_match_scores;
  v_explanation_text text;
  v_req_matched int; v_req_total int;
begin
  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null or v_job.status <> 'open' then
    return 0;
  end if;

  for v_candidate_user_id in
    select p.user_id
    from public.profiles p
    where (p.open_to_work = true or p.actively_looking = true)
      and p.allow_recruiter_search = true
      and p.profile_visibility = 'public'
      and p.profile_discovery is not false
      and not public.is_blocked_by(p.id)
      and (
        p.open_to_roles is null or array_length(p.open_to_roles, 1) is null
        or exists (select 1 from unnest(p.open_to_roles) r where v_job.title ilike '%' || r || '%')
        or p.preferred_locations is null or array_length(p.preferred_locations, 1) is null
        or exists (select 1 from unnest(p.preferred_locations) l where v_job.location ilike '%' || l || '%')
        or (v_job.remote_option = 'remote' and exists (select 1 from unnest(coalesce(p.preferred_work_modes, '{}')) m where lower(m) = 'remote'))
      )
    order by p.last_active_at desc nulls last, p.user_id asc  -- stable tiebreaker for deterministic pagination across batches
    limit p_limit
    offset p_offset
  loop
    v_considered := v_considered + 1;
    v_match := public._calculate_job_match_core(p_job_id, v_candidate_user_id);

    if v_match.eligibility_status = 'eligible' and v_match.score >= public.strong_match_threshold() then
      delete from public.job_recommendations
        where user_id = v_candidate_user_id and job_id = p_job_id;
      insert into public.job_recommendations (user_id, job_id, score, rank, expires_at)
      values (
        v_candidate_user_id, p_job_id, v_match.score::smallint,
        coalesce((select min(rank) from public.job_recommendations where user_id = v_candidate_user_id), 1),
        now() + interval '7 days'
      );

      v_req_total := coalesce((v_match.explanation #>> '{skills,required_total}')::int, 0);
      v_req_matched := coalesce((v_match.explanation #>> '{skills,required_matched}')::int, 0);
      v_explanation_text := case when v_req_total > 0
        then v_req_matched || '/' || v_req_total || ' required skills match'
        else 'Your profile matches this role well'
      end;
      if coalesce((v_match.explanation #>> '{location,score}')::int, 0) >= 10 then
        v_explanation_text := v_explanation_text || ' and the location fits your preference';
      elsif coalesce((v_match.explanation #>> '{work_mode,score}')::int, 0) >= 5 then
        v_explanation_text := v_explanation_text || ' and the work mode fits your preference';
      end if;

      insert into public.notifications (user_id, type, payload)
      values (
        v_match.candidate_profile_id,
        'new_job',
        jsonb_build_object(
          'job_id', p_job_id,
          'job_title', v_job.title,
          'company_name', v_job.company_name,
          'company_id', v_job.company_id,
          'score', round(v_match.score),
          'explanation_text', v_explanation_text
        )
      )
      on conflict (user_id, ((payload->>'job_id'))) where type = 'new_job' do nothing;

      if found then
        v_notified := v_notified + 1;
      end if;
    end if;
  end loop;

  update public.jobs
  set matches_processed_at = now(),
      matches_processed_offset = p_offset + v_considered,
      matches_fully_processed = (v_considered < p_limit)
  where id = p_job_id;

  return v_notified;
end;
$$;

-- Manual/immediate path unchanged in spirit: still recruiter-authorized,
-- but now explicitly always starts a job's batching from offset 0 on
-- first (or re-)invocation -- completeness for any remaining candidates
-- beyond that first batch is guaranteed by the cron continuing from
-- wherever matches_processed_offset is, not by this call looping itself
-- (which would reintroduce unbounded synchronous work in one call).
create or replace function public.process_new_job_matches(p_job_id uuid, p_limit int default 200)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_job_recruiter(p_job_id) then
    raise exception 'Not authorized to process matches for this job';
  end if;
  return public._notify_strong_matches_for_job(p_job_id, p_limit, 0);
end;
$$;

-- Scheduled path: each pending job resumes from its OWN
-- matches_processed_offset, advancing one bounded batch per cron tick
-- until matches_fully_processed flips true. A job with, say, 500 eligible
-- candidates and a 200-per-batch size is fully covered within 3 ticks
-- (~6 minutes) instead of being permanently capped at the first 200.
create or replace function public.process_pending_new_job_matches(p_jobs_limit int default 20, p_candidates_per_job int default 200)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_job record;
  v_total int := 0;
begin
  for v_job in
    select j.id, j.matches_processed_offset
    from public.jobs j
    where j.status = 'open' and j.matches_fully_processed = false
    order by j.posted_at asc
    limit greatest(1, least(p_jobs_limit, 100))
  loop
    v_total := v_total + public._notify_strong_matches_for_job(v_job.id, p_candidates_per_job, v_job.matches_processed_offset);
  end loop;
  return v_total;
end;
$$;
