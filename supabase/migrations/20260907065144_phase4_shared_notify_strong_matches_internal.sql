-- Phase 4: the actual per-job "score candidates, notify strong matches"
-- pipeline, extracted once so it is shared by BOTH invocation paths
-- (immediate manual call right after publish, and the scheduled cron
-- fallback) -- never duplicated. No auth check here (internal-only,
-- trusted callers only); each public wrapper does its own authorization
-- appropriate to its context.
create or replace function public._notify_strong_matches_for_job(p_job_id uuid, p_limit int default 200)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_job record;
  v_candidate_user_id uuid;
  v_notified int := 0;
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
    order by p.last_active_at desc nulls last
    limit p_limit
  loop
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

  update public.jobs set matches_processed_at = now() where id = p_job_id;

  return v_notified;
end;
$$;

revoke all on function public._notify_strong_matches_for_job(uuid, int) from public, anon, authenticated;
comment on function public._notify_strong_matches_for_job(uuid, int) is 'Internal-only Phase 4 pipeline: coarse-filter, score via _calculate_job_match_core, upsert job_recommendations + idempotent new_job notification for strong eligible matches. Called by process_new_job_matches() (manual, recruiter-authorized) and process_pending_new_job_matches() (scheduled, system context) -- never duplicated.';

-- Manual/immediate path: callable right after a recruiter publishes a job
-- (fire-and-forget from PostJobDialog.tsx), or to re-run for an existing
-- job. Keeps its own recruiter authorization check.
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
  return public._notify_strong_matches_for_job(p_job_id, p_limit);
end;
$$;

revoke all on function public.process_new_job_matches(uuid, int) from public, anon;
grant execute on function public.process_new_job_matches(uuid, int) to authenticated;

-- Scheduled/system path: no per-request auth (not reachable by any client
-- role at all -- only postgres/service_role, i.e. only pg_cron). Bounded
-- to p_jobs_limit jobs per run so a large backlog can never turn one
-- invocation into an unbounded scan; each job's own candidate pool is
-- already bounded by _notify_strong_matches_for_job's p_limit.
create or replace function public.process_pending_new_job_matches(p_jobs_limit int default 20, p_candidates_per_job int default 200)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_job_id uuid;
  v_total int := 0;
begin
  for v_job_id in
    select j.id
    from public.jobs j
    where j.status = 'open' and j.matches_processed_at is null
    order by j.posted_at asc
    limit greatest(1, least(p_jobs_limit, 100))
  loop
    v_total := v_total + public._notify_strong_matches_for_job(v_job_id, p_candidates_per_job);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.process_pending_new_job_matches(int, int) from public, anon, authenticated;
comment on function public.process_pending_new_job_matches(int, int) is 'Phase 4 scheduled fallback (pg_cron, every 2 min): reliably catches any job whose matches were never processed (immediate client call skipped/failed/browser closed), bounded to 20 jobs x 200 candidates per run. Not reachable by any client role.';
