-- Fixes a real, confirmed-live bug: accept_offer() called
-- update_application_stage(..., 'offer_accepted'/'hired'/'offer_declined')
-- internally, but update_application_stage() only allows a candidate caller
-- to set 'withdrawn' -- so every candidate offer response (accept OR
-- decline) raised "Applicant can only withdraw" and never completed.
--
-- Fix: accept_offer() now performs its own hiring_applications stage update
-- + hiring_application_events insert directly, instead of delegating to
-- update_application_stage(). This is the "narrowly scoped, already-audited
-- RPC" approach -- accept_offer() already verifies
-- `auth.uid() = v_app.candidate_user_id` (offer ownership) before doing
-- anything, so it's the correct place for this one candidate-driven
-- exception to the "candidates can only withdraw" rule.
-- update_application_stage() itself is UNCHANGED: candidates still cannot
-- set screening/shortlisted/interview/offer/rejected/hired through it.
--
-- Also fixes a latent double-call bug: the old code left the whole
-- accept/decline path non-atomic across two update_application_stage()
-- calls that could partially fail; this version does both stage updates
-- (offer_accepted -> hired, or -> offer_declined) inside the same
-- function invocation, which Postgres already runs as a single transaction,
-- so a failure anywhere rolls back the offer status update too -- no more
-- "offer accepted but application still offer_extended" possibility.
--
-- Also adds an idempotency guard (offer must be 'extended' to respond to)
-- so a duplicate/stale client request can't re-fire the transition or
-- silently double-insert events.
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
