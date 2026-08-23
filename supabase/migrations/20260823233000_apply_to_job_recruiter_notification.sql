-- Restores a notification that regressed when the candidate apply flow
-- moved off the legacy `applications` table.
--
-- Discovery: `applications` has a live trigger `on_application_created`
-- (function handle_new_application_notification) that notifies the company
-- owner + admins ('super_admin','content_admin') with a
-- 'job_application_received' notification whenever a row is inserted. Since
-- Jobs.tsx now calls apply_to_job() -> hiring_applications instead of
-- inserting into `applications`, that trigger stopped firing for every new
-- application submitted through the app -- a real regression, not a
-- hypothetical one.
--
-- Fix: apply_to_job() now performs the same notification itself (same
-- type, same recipient logic: company owner_id + admins, excluding the
-- applicant) when -- and only when -- the INSERT is a genuinely new
-- application, not the ON CONFLICT (job_id, candidate_user_id) re-apply
-- upsert path. This keeps notification logic colocated with the one write
-- path for applying, consistent with how update_application_stage() already
-- owns its own notification, rather than adding a second trigger-based
-- system.
CREATE OR REPLACE FUNCTION public.apply_to_job(p_job_id uuid, p_resume_id uuid DEFAULT NULL, p_cover_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id, display_name into v_profile_id, v_candidate_name from public.profiles where user_id = auth.uid();
  if v_profile_id is null then raise exception 'Profile not found'; end if;

  select not exists (
    select 1 from public.hiring_applications where job_id = p_job_id and candidate_user_id = auth.uid()
  ) into v_is_new;

  insert into public.hiring_applications(job_id,candidate_user_id,candidate_profile_id,resume_id,cover_note,current_stage)
  values (p_job_id,auth.uid(),v_profile_id,p_resume_id,nullif(trim(p_cover_note),''),'applied')
  on conflict (job_id,candidate_user_id) do update set updated_at = now()
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
end $$;
