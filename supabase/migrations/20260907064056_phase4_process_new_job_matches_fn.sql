-- Phase 4: candidate-side "strong match" notification for a newly
-- published job. Reuses the SAME canonical engine (calculate_job_match)
-- and tables (hiring_match_scores, job_recommendations, notifications) --
-- no new matching engine, no new score table, no new notification system.
--
-- Called once, right after a job is published (fire-and-forget from the
-- client, see PostJobDialog.tsx) -- NOT from a synchronous trigger, so the
-- job INSERT itself stays fast regardless of candidate-pool size. Bounded
-- coarse-filtered pool, same consent model as refresh_job_candidate_matches'
-- Pool B (open_to_work/actively_looking + allow_recruiter_search + public
-- visibility + profile_discovery + not blocked).
create or replace function public.process_new_job_matches(p_job_id uuid, p_limit int default 200)
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
  -- Authorization: only the job's own recruiter can trigger this (it's
  -- invoked right after that same person publishes the job).
  if not public.is_job_recruiter(p_job_id) then
    raise exception 'Not authorized to process matches for this job';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  -- Only a genuinely published/public job triggers candidate notifications.
  if v_job.status <> 'open' then
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
    v_match := public.calculate_job_match(p_job_id, v_candidate_user_id);

    if v_match.eligibility_status = 'eligible' and v_match.score >= public.strong_match_threshold() then
      -- Refresh this one candidate's recommendation ranking so the new job
      -- shows up in job_recommendations too, not just as a notification.
      delete from public.job_recommendations
        where user_id = v_candidate_user_id and job_id = p_job_id;
      insert into public.job_recommendations (user_id, job_id, score, rank, expires_at)
      values (
        v_candidate_user_id, p_job_id, v_match.score::smallint,
        coalesce((select min(rank) from public.job_recommendations where user_id = v_candidate_user_id), 1),
        now() + interval '7 days'
      );

      -- Deterministic explanation snippet, derived only from the actual
      -- stored explanation JSON -- never invented text.
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

      -- Idempotent: the partial unique index on (user_id, payload->>job_id)
      -- where type='new_job' makes this safe to call repeatedly (refresh
      -- run twice, retry, etc.) without ever creating a second notification
      -- for the same candidate/job.
      insert into public.notifications (user_id, type, payload)
      values (
        v_candidate_user_id,
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

  return v_notified;
end;
$$;

revoke execute on function public.process_new_job_matches(uuid, int) from public;
grant execute on function public.process_new_job_matches(uuid, int) to authenticated;

comment on function public.process_new_job_matches(uuid, int) is 'Phase 4: fires once after a job is published (client-invoked, fire-and-forget). Scores a bounded, consent-gated candidate pool via calculate_job_match(), and for eligible candidates scoring >= strong_match_threshold(), upserts job_recommendations and inserts a deduplicated new_job notification (partial unique index enforces at most one per candidate/job).';
