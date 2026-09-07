-- Job Matching Phase 1: extend apply_to_job with ONLY the match-score
-- snapshot addition. Every existing declared variable, resume-snapshot
-- branch, hiring_application_events insert, notification fan-out to
-- company owner/admins, duplicate-application (ON CONFLICT) handling, and
-- error/authorization behavior is preserved byte-for-byte from the
-- definition captured immediately before this migration.
--
-- match_score_at_apply is computed here, server-side, never accepted from
-- the client: prefer an existing cached job_match_scores row; if none
-- exists yet, compute one via calculate_job_match(). The scoring call is
-- wrapped so any matching-engine failure can NEVER block the application
-- itself (a candidate must still be able to apply regardless of the
-- matching engine's state).
CREATE OR REPLACE FUNCTION public.apply_to_job(p_job_id uuid, p_resume_id uuid DEFAULT NULL::uuid, p_cover_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile_id uuid;
  v_candidate_name text;
  v_application_id uuid;
  v_is_new boolean;
  v_job_title text;
  v_company_id uuid;
  v_company_name text;
  v_owner_id uuid;
  v_recipient_ids uuid[] := '{}';
  v_admin_ids uuid[];
  v_recipient_id uuid;
  v_resume_title text;
  v_resume_content jsonb;
  v_snapshot jsonb;
  v_file_path text;
  v_match_score smallint;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id, display_name into v_profile_id, v_candidate_name from public.profiles where user_id = auth.uid();
  if v_profile_id is null then raise exception 'Profile not found'; end if;

  if p_resume_id is not null then
    select title, content into v_resume_title, v_resume_content
    from public.resumes
    where id = p_resume_id and user_id = auth.uid();

    if v_resume_title is null then
      raise exception 'Resume not found or not owned by candidate';
    end if;

    if v_resume_content ->> 'type' = 'pdf' then
      v_snapshot := jsonb_build_object(
        'type', 'pdf',
        'title', v_resume_title,
        'fileName', v_resume_content ->> 'fileName'
      );
      v_file_path := v_resume_content ->> 'storagePath';
    else
      v_snapshot := jsonb_build_object(
        'title', v_resume_title,
        'personalInfo', jsonb_build_object(
          'name', v_resume_content #>> '{personalInfo,name}',
          'location', v_resume_content #>> '{personalInfo,location}'
        ),
        'summary', v_resume_content ->> 'summary',
        'experience', v_resume_content ->> 'experience',
        'education', v_resume_content ->> 'education',
        'skills', v_resume_content ->> 'skills'
      );
      v_file_path := null;
    end if;
  else
    v_snapshot := null;
    v_file_path := null;
  end if;

  -- Match-score snapshot: prefer an already-cached job_match_scores row;
  -- fall back to computing one now. Never accepts a client-provided score.
  -- Wrapped so a matching-engine error can never block the application.
  begin
    select overall_score into v_match_score
    from public.job_match_scores
    where job_id = p_job_id and candidate_user_id = auth.uid();

    if v_match_score is null then
      select jms.overall_score into v_match_score
      from public.calculate_job_match(p_job_id, auth.uid()) jms;
    end if;
  exception when others then
    v_match_score := null;
  end;

  select not exists (
    select 1 from public.hiring_applications where job_id = p_job_id and candidate_user_id = auth.uid()
  ) into v_is_new;

  insert into public.hiring_applications(
    job_id, candidate_user_id, candidate_profile_id, resume_id, cover_note, current_stage,
    resume_snapshot, resume_snapshot_created_at, resume_sharing_revoked, resume_file_path,
    match_score_at_apply
  )
  values (
    p_job_id, auth.uid(), v_profile_id, p_resume_id, nullif(trim(p_cover_note),''), 'applied',
    v_snapshot, case when v_snapshot is not null then now() else null end, false, v_file_path,
    v_match_score
  )
  on conflict (job_id,candidate_user_id) do update set
    updated_at = now(),
    resume_id = case when p_resume_id is not null then p_resume_id else hiring_applications.resume_id end,
    resume_snapshot = case when p_resume_id is not null then v_snapshot else hiring_applications.resume_snapshot end,
    resume_snapshot_created_at = case when p_resume_id is not null then now() else hiring_applications.resume_snapshot_created_at end,
    resume_sharing_revoked = case when p_resume_id is not null then false else hiring_applications.resume_sharing_revoked end,
    resume_file_path = case when p_resume_id is not null then v_file_path else hiring_applications.resume_file_path end,
    match_score_at_apply = coalesce(v_match_score, hiring_applications.match_score_at_apply)
  returning id into v_application_id;

  insert into public.hiring_application_events(application_id,event_type,to_stage,actor_user_id,actor_profile_id)
  values (v_application_id,'created','applied',auth.uid(),v_profile_id);

  if v_is_new then
    select j.title, j.company_id into v_job_title, v_company_id from public.jobs j where j.id = p_job_id;

    if v_company_id is not null then
      select name, owner_id into v_company_name, v_owner_id from public.companies where id = v_company_id;

      if v_owner_id is not null then
        v_recipient_ids := array_append(v_recipient_ids, v_owner_id);
      end if;

      select array_agg(cm.user_id) into v_admin_ids
      from public.company_members cm
      where cm.company_id = v_company_id and cm.role in ('super_admin','content_admin');

      if v_admin_ids is not null then
        v_recipient_ids := array_cat(v_recipient_ids, v_admin_ids);
      end if;

      foreach v_recipient_id in array (select array(select distinct unnest(v_recipient_ids)))
      loop
        if v_recipient_id is distinct from v_profile_id then
          insert into public.notifications(user_id, type, payload)
          values (
            v_recipient_id,
            'job_application_received',
            jsonb_build_object(
              'job_id', p_job_id,
              'job_title', v_job_title,
              'company_id', v_company_id,
              'company_name', v_company_name,
              'application_id', v_application_id,
              'candidate_profile_id', v_profile_id,
              'candidate_name', v_candidate_name
            )
          );
        end if;
      end loop;
    end if;
  end if;

  return v_application_id;
end $function$;
