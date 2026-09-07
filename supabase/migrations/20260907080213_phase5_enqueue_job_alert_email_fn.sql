-- Phase 5: enqueues a job-alert email, gated by explicit consent (never
-- inferred from open_to_work/actively_looking or in-app notification
-- prefs). Looks up the candidate's own verified auth email directly --
-- never trusts a passed-in email string -- and only enqueues if
-- email_confirmed_at is set (a real, verified, usable address). Idempotent
-- via the dedup_key unique constraint. Internal-only: not reachable by any
-- client role.
create or replace function public._enqueue_job_alert_email(
  p_candidate_profile_id uuid, p_candidate_user_id uuid, p_job_id uuid,
  p_job_title text, p_company_name text, p_score numeric, p_explanation_text text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email_enabled boolean;
  v_job_alert_enabled boolean;
  v_email text;
  v_email_confirmed boolean;
  v_dedup_key text;
begin
  select p.email_notifications_enabled, p.job_alert_emails
  into v_email_enabled, v_job_alert_enabled
  from public.profiles p where p.id = p_candidate_profile_id;

  if not coalesce(v_email_enabled, false) or not coalesce(v_job_alert_enabled, false) then
    return; -- no consent -- never send
  end if;

  select u.email, (u.email_confirmed_at is not null)
  into v_email, v_email_confirmed
  from auth.users u where u.id = p_candidate_user_id;

  if v_email is null or not coalesce(v_email_confirmed, false) then
    return; -- no verified, usable email on file
  end if;

  v_dedup_key := 'job_alert:' || p_candidate_profile_id::text || ':' || p_job_id::text;

  insert into public.email_outbox (
    user_id, recipient_email, email_type, entity_type, entity_id, dedup_key, template_key, payload
  ) values (
    p_candidate_profile_id, v_email, 'job_alert', 'job', p_job_id, v_dedup_key, 'job_alert_v1',
    jsonb_build_object(
      'job_id', p_job_id, 'job_title', p_job_title, 'company_name', p_company_name,
      'score', round(p_score), 'explanation_text', p_explanation_text
    )
  )
  on conflict (dedup_key) do nothing;
end;
$$;

revoke all on function public._enqueue_job_alert_email(uuid, uuid, uuid, text, text, numeric, text) from public, anon, authenticated;
comment on function public._enqueue_job_alert_email is 'Phase 5: internal-only. Enqueues a job_alert email_outbox row iff email_notifications_enabled AND job_alert_emails AND a verified auth email exists. Called from _notify_strong_matches_for_job() alongside the existing in-app notification -- same trigger point, separate consent gate.';
