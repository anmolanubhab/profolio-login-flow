-- Product rule: once an offer has been extended and is still awaiting a
-- response, the candidate's action is to Accept/Decline that offer -- not
-- to withdraw the application through the generic path. Enforced
-- server-side (not just hiding the button in the UI) so a direct RPC call
-- can't bypass it.
--
-- update_application_stage() is unchanged for every other case: candidates
-- can still withdraw freely before an offer exists, and can still withdraw
-- after an offer was declined or has expired (status stays 'extended' but
-- expires_at has passed -- at that point it's no longer "awaiting response"
-- in any meaningful sense, so blocking withdrawal there would trap the
-- candidate with no way out).
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
  v_has_active_offer boolean;
begin
  select * into v_app from public.hiring_applications where id = p_application_id;
  if not found then raise exception 'Application not found'; end if;

  v_old := v_app.current_stage;
  select id into v_profile_id from public.profiles where user_id = auth.uid();

  if auth.uid() = v_app.candidate_user_id then
    if p_new_stage <> 'withdrawn' then raise exception 'Applicant can only withdraw'; end if;

    select exists (
      select 1 from public.hiring_offers o
      where o.application_id = p_application_id
        and o.status = 'extended'
        and (o.expires_at is null or o.expires_at > now())
    ) into v_has_active_offer;

    if v_has_active_offer then
      raise exception 'You have an active offer on this application -- accept or decline it instead of withdrawing.';
    end if;
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

-- Server-side expiry enforcement: an already-expired offer (expires_at
-- passed, but nothing has flipped its status -- offer_status has an
-- 'expired' value but no RPC/trigger ever sets it) must not be acceptable
-- or declinable via direct RPC call, even though the frontend already
-- hides the buttons once expires_at has passed.
CREATE OR REPLACE FUNCTION public.accept_offer(p_offer_id uuid, p_accept boolean, p_decline_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  v_offer public.hiring_offers%rowtype;
  v_app public.hiring_applications%rowtype;
  v_old public.application_stage;
  v_profile_id uuid;
begin
  select * into v_offer from public.hiring_offers where id = p_offer_id;
  if not found then raise exception 'Offer not found'; end if;

  select * into v_app from public.hiring_applications where id = v_offer.application_id;
  if not found then raise exception 'Application not found'; end if;
  if auth.uid() <> v_app.candidate_user_id then raise exception 'Only candidate can respond'; end if;
  if v_offer.status <> 'extended' then raise exception 'Offer is not open for a response'; end if;
  if v_offer.expires_at is not null and v_offer.expires_at < now() then raise exception 'This offer has expired'; end if;

  select id into v_profile_id from public.profiles where user_id = auth.uid();
  v_old := v_app.current_stage;

  if p_accept then
    update public.hiring_offers set status = 'accepted', accepted_at = now(), updated_at = now() where id = p_offer_id;

    update public.hiring_applications set current_stage = 'offer_accepted', stage_updated_at = now(), updated_at = now() where id = v_app.id;
    insert into public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id)
    values (v_app.id, 'offer_accepted', v_old, 'offer_accepted', auth.uid(), v_profile_id);

    update public.hiring_applications set current_stage = 'hired', stage_updated_at = now(), updated_at = now() where id = v_app.id;
    insert into public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id)
    values (v_app.id, 'stage_changed', 'offer_accepted', 'hired', auth.uid(), v_profile_id);
  else
    update public.hiring_offers set status = 'declined', declined_at = now(), decline_reason = p_decline_reason, updated_at = now() where id = p_offer_id;

    update public.hiring_applications set current_stage = 'offer_declined', stage_updated_at = now(), updated_at = now() where id = v_app.id;
    insert into public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id, metadata)
    values (v_app.id, 'offer_declined', v_old, 'offer_declined', auth.uid(), v_profile_id, jsonb_build_object('reason', p_decline_reason));
  end if;
end $$;
