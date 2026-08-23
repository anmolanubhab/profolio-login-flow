-- Notify candidates when a recruiter moves their application to a new stage.
--
-- update_application_stage() is the single write path for every stage
-- transition in the hiring pipeline: it's called directly by the recruiter
-- Hiring Pipeline UI, and internally (via `perform`) by
-- schedule_interview_round(), create_offer(), and accept_offer(). Appending
-- one notification insert here therefore covers "interview scheduled",
-- "offer extended", "offer accepted/declined", "hired", and "rejected" for
-- free, without a second notification system or new triggers.
--
-- Only fires when the *recruiter* changed the stage (auth.uid() differs from
-- the candidate) -- a candidate withdrawing their own application doesn't
-- need to be told they did it. Function body is otherwise byte-for-byte the
-- existing one from 20260106081249_reconstructed_hiring_pipeline_baseline.sql;
-- only the notification insert at the end is new.
CREATE OR REPLACE FUNCTION public.update_application_stage(p_application_id uuid, p_new_stage application_stage, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  v_app public.hiring_applications%rowtype;
  v_old public.application_stage;
  v_profile_id uuid;
  v_job_title text;
  v_company_name text;
begin
  select * into v_app from public.hiring_applications where id = p_application_id;
  if not found then raise exception 'Application not found'; end if;

  v_old := v_app.current_stage;
  select id into v_profile_id from public.profiles where user_id = auth.uid();

  if auth.uid() = v_app.candidate_user_id then
    if p_new_stage <> 'withdrawn' then raise exception 'Applicant can only withdraw'; end if;
  else
    if not public.is_job_recruiter(v_app.job_id) then raise exception 'Not authorized'; end if;
    if p_new_stage = 'withdrawn' then raise exception 'Recruiter cannot set withdrawn'; end if;
  end if;

  update public.hiring_applications
  set current_stage = p_new_stage, stage_updated_at = now(), updated_at = now(),
      withdrawn_at = case when p_new_stage='withdrawn' then now() else withdrawn_at end,
      rejection_reason = case when p_new_stage='rejected' then p_reason else rejection_reason end
  where id = p_application_id;

  insert into public.hiring_application_events(application_id,event_type,from_stage,to_stage,actor_user_id,actor_profile_id,metadata)
  values (p_application_id,'stage_changed',v_old,p_new_stage,auth.uid(),v_profile_id,jsonb_build_object('reason',p_reason));

  if auth.uid() <> v_app.candidate_user_id and p_new_stage <> v_old then
    select j.title, coalesce(c.name, j.company_name) into v_job_title, v_company_name
    from public.jobs j left join public.companies c on c.id = j.company_id
    where j.id = v_app.job_id;

    insert into public.notifications(user_id, type, payload)
    values (
      v_app.candidate_profile_id,
      'application_stage_changed',
      jsonb_build_object(
        'application_id', p_application_id,
        'job_title', v_job_title,
        'company_name', v_company_name,
        'from_stage', v_old,
        'to_stage', p_new_stage
      )
    );
  end if;
end $$;
