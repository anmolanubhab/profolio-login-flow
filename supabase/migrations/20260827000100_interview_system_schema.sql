-- Hiring Interview System (part 2/2): tables, columns, RLS, RPCs.
-- Additive only. No existing rows in hiring_applications/hiring_interview_rounds/
-- hiring_offers/messages are touched, updated, or deleted by this migration.
-- Built on the existing B6 recruiter authorization (is_job_recruiter,
-- is_company_recruiter, is_company_owner_or_super_admin) and B10 blocking
-- (is_blocked_by) -- no parallel authorization model is introduced.

-- ============================================================
-- 1. Columns on hiring_interview_rounds
-- ============================================================
ALTER TABLE public.hiring_interview_rounds
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS mode public.interview_mode NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS provider public.meeting_provider;

ALTER TABLE public.hiring_interview_rounds
  DROP CONSTRAINT IF EXISTS hiring_interview_rounds_meeting_link_https_check;
ALTER TABLE public.hiring_interview_rounds
  ADD CONSTRAINT hiring_interview_rounds_meeting_link_https_check
  CHECK (mode = 'offline' OR meeting_link IS NULL OR meeting_link ~ '^https://');

-- ============================================================
-- 2. hiring_interview_panelists
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hiring_interview_panelists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.hiring_interview_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  panel_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hiring_interview_panelists_round_id ON public.hiring_interview_panelists(round_id);
CREATE INDEX IF NOT EXISTS idx_hiring_interview_panelists_user_id ON public.hiring_interview_panelists(user_id);

ALTER TABLE public.hiring_interview_panelists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hip_insert_block ON public.hiring_interview_panelists;
CREATE POLICY hip_insert_block ON public.hiring_interview_panelists FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS hip_update_block ON public.hiring_interview_panelists;
CREATE POLICY hip_update_block ON public.hiring_interview_panelists FOR UPDATE USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS hip_delete_block ON public.hiring_interview_panelists;
CREATE POLICY hip_delete_block ON public.hiring_interview_panelists FOR DELETE USING (false);
DROP POLICY IF EXISTS hip_select ON public.hiring_interview_panelists;
CREATE POLICY hip_select ON public.hiring_interview_panelists FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.hiring_interview_rounds hir
    JOIN public.hiring_applications ha ON ha.id = hir.application_id
    WHERE hir.id = hiring_interview_panelists.round_id
      AND (
        ha.candidate_user_id = auth.uid()
        OR hiring_interview_panelists.user_id = auth.uid()
        OR (public.is_job_recruiter(ha.job_id) AND NOT public.is_blocked_by(ha.candidate_profile_id))
      )
  )
);

-- ============================================================
-- 3. hiring_interview_feedback (never visible to the candidate)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hiring_interview_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.hiring_interview_rounds(id) ON DELETE CASCADE,
  panelist_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  panelist_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  technical_skill smallint CHECK (technical_skill BETWEEN 1 AND 5),
  communication smallint CHECK (communication BETWEEN 1 AND 5),
  problem_solving smallint CHECK (problem_solving BETWEEN 1 AND 5),
  overall smallint CHECK (overall BETWEEN 1 AND 5),
  recommendation public.interview_recommendation,
  private_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, panelist_user_id)
);

CREATE INDEX IF NOT EXISTS idx_hiring_interview_feedback_round_id ON public.hiring_interview_feedback(round_id);

ALTER TABLE public.hiring_interview_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hif_insert_block ON public.hiring_interview_feedback;
CREATE POLICY hif_insert_block ON public.hiring_interview_feedback FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS hif_update_block ON public.hiring_interview_feedback;
CREATE POLICY hif_update_block ON public.hiring_interview_feedback FOR UPDATE USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS hif_delete_block ON public.hiring_interview_feedback;
CREATE POLICY hif_delete_block ON public.hiring_interview_feedback FOR DELETE USING (false);
DROP POLICY IF EXISTS hif_select ON public.hiring_interview_feedback;
-- Recruiter-side only. The candidate is never in this predicate, on purpose.
CREATE POLICY hif_select ON public.hiring_interview_feedback FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.hiring_interview_rounds hir
    JOIN public.hiring_applications ha ON ha.id = hir.application_id
    WHERE hir.id = hiring_interview_feedback.round_id
      AND public.is_job_recruiter(ha.job_id)
      AND NOT public.is_blocked_by(ha.candidate_profile_id)
  )
);

-- ============================================================
-- 4. messages: interview_card support
-- ============================================================
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','file','image','sticker','interview_card']::text[]));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- ============================================================
-- 5. B6-consistent helper: check a SPECIFIC user (not auth.uid()) against the
--    same owner-or-is_recruiter rule as is_company_recruiter(). Needed to
--    re-validate panelist selections server-side; company_role
--    (super_admin/content_admin) is never used as the authorization signal.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_company_recruiter_user(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members cm
    JOIN public.profiles p ON p.id = cm.user_id
    WHERE cm.company_id = _company_id AND p.user_id = _user_id AND cm.is_recruiter = true
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.id = c.owner_id
    WHERE c.id = _company_id AND p.user_id = _user_id
  );
$$;

-- ============================================================
-- 6. get_or_create_conversation: minimal helper for interview_card delivery
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_user_a uuid, _user_b uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.conversations
  WHERE (participant_1 = _user_a AND participant_2 = _user_b)
     OR (participant_1 = _user_b AND participant_2 = _user_a)
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.conversations(participant_1, participant_2) VALUES (_user_a, _user_b)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- ============================================================
-- 7. invite_interview_round
-- ============================================================
CREATE OR REPLACE FUNCTION public.invite_interview_round(
  p_application_id uuid,
  p_round_type public.interview_round_type,
  p_title text,
  p_description text,
  p_scheduled_at timestamptz,
  p_duration_minutes integer,
  p_timezone text,
  p_mode public.interview_mode,
  p_provider public.meeting_provider,
  p_meeting_link text,
  p_panelist_user_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_app public.hiring_applications%rowtype;
  v_job public.jobs%rowtype;
  v_round_no int;
  v_round_id uuid;
  v_old_stage public.application_stage;
  v_profile_id uuid;
  v_panelist_uid uuid;
  v_panelist_profile_id uuid;
  v_job_title text;
  v_company_name text;
  v_conv_id uuid;
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_app FROM public.hiring_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF NOT public.is_job_recruiter(v_app.job_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.is_blocked_by(v_app.candidate_profile_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = v_app.job_id;

  IF p_mode = 'online' THEN
    IF p_meeting_link IS NULL OR p_meeting_link !~ '^https://' THEN
      RAISE EXCEPTION 'A valid HTTPS meeting link is required for online interviews';
    END IF;
    IF p_provider IS NULL THEN RAISE EXCEPTION 'Meeting provider is required for online interviews'; END IF;
  ELSE
    IF p_meeting_link IS NOT NULL THEN RAISE EXCEPTION 'Offline interviews should not include a meeting link'; END IF;
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at <= now() THEN RAISE EXCEPTION 'Scheduled time must be in the future'; END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();

  SELECT coalesce(max(round_no), 0) + 1 INTO v_round_no
  FROM public.hiring_interview_rounds WHERE application_id = p_application_id;

  INSERT INTO public.hiring_interview_rounds (
    application_id, round_no, round_type, status, title, description,
    scheduled_at, duration_minutes, timezone, mode, provider, meeting_link,
    interviewer_user_id, interviewer_profile_id, created_by_user_id
  ) VALUES (
    p_application_id, v_round_no, p_round_type, 'invited', nullif(trim(p_title), ''), nullif(trim(p_description), ''),
    p_scheduled_at, p_duration_minutes, v_timezone, p_mode, p_provider, p_meeting_link,
    auth.uid(), v_profile_id, auth.uid()
  ) RETURNING id INTO v_round_id;

  IF p_panelist_user_ids IS NOT NULL THEN
    FOREACH v_panelist_uid IN ARRAY p_panelist_user_ids LOOP
      IF v_job.company_id IS NULL OR NOT public.is_company_recruiter_user(v_job.company_id, v_panelist_uid) THEN
        RAISE EXCEPTION 'One or more selected panelists are not authorized recruiters for this company';
      END IF;
      SELECT id INTO v_panelist_profile_id FROM public.profiles WHERE user_id = v_panelist_uid;
      INSERT INTO public.hiring_interview_panelists(round_id, user_id, profile_id)
      VALUES (v_round_id, v_panelist_uid, v_panelist_profile_id)
      ON CONFLICT (round_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  -- the inviting recruiter is always a panelist so they can join/see the round
  INSERT INTO public.hiring_interview_panelists(round_id, user_id, profile_id, panel_role)
  VALUES (v_round_id, auth.uid(), v_profile_id, 'Recruiter')
  ON CONFLICT (round_id, user_id) DO NOTHING;

  v_old_stage := v_app.current_stage;
  UPDATE public.hiring_applications
  SET current_stage = 'interview_offered', stage_updated_at = now(), updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id, metadata)
  VALUES (p_application_id, 'interview_invited', v_old_stage, 'interview_offered', auth.uid(), v_profile_id,
    jsonb_build_object('round_id', v_round_id, 'round_type', p_round_type, 'scheduled_at', p_scheduled_at));

  SELECT j.title, coalesce(c.name, j.company_name) INTO v_job_title, v_company_name
  FROM public.jobs j LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE j.id = v_app.job_id;

  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (v_app.candidate_profile_id, 'interview_invited', jsonb_build_object(
    'application_id', p_application_id, 'round_id', v_round_id, 'job_title', v_job_title,
    'company_name', v_company_name, 'scheduled_at', p_scheduled_at, 'round_type', p_round_type
  ));

  BEGIN
    v_conv_id := public.get_or_create_conversation(auth.uid(), v_app.candidate_user_id);
    INSERT INTO public.messages(conversation_id, sender_id, content, message_type, metadata)
    VALUES (
      v_conv_id, auth.uid(), coalesce(nullif(trim(p_title), ''), 'Interview invitation'), 'interview_card',
      jsonb_build_object(
        'application_id', p_application_id, 'round_id', v_round_id, 'title', p_title,
        'scheduled_at', p_scheduled_at, 'timezone', v_timezone, 'duration_minutes', p_duration_minutes,
        'mode', p_mode, 'provider', p_provider, 'status', 'invited',
        'job_title', v_job_title, 'company_name', v_company_name
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- messaging is a convenience layer; never fail the core workflow because of it
    NULL;
  END;

  RETURN v_round_id;
END;
$$;

-- ============================================================
-- 8. respond_interview_invite
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_interview_invite(
  p_round_id uuid, p_accept boolean, p_decline_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_round public.hiring_interview_rounds%rowtype;
  v_app public.hiring_applications%rowtype;
  v_profile_id uuid;
  v_candidate_name text;
  v_old_stage public.application_stage;
  v_panelist record;
  v_job_title text;
  v_company_name text;
  v_conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_round FROM public.hiring_interview_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_app FROM public.hiring_applications WHERE id = v_round.application_id;
  IF NOT FOUND OR v_app.candidate_user_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF v_round.status <> 'invited' THEN RAISE EXCEPTION 'This invitation is no longer awaiting a response'; END IF;

  SELECT id, display_name INTO v_profile_id, v_candidate_name FROM public.profiles WHERE user_id = auth.uid();
  v_old_stage := v_app.current_stage;

  SELECT j.title, coalesce(c.name, j.company_name) INTO v_job_title, v_company_name
  FROM public.jobs j LEFT JOIN public.companies c ON c.id = j.company_id WHERE j.id = v_app.job_id;

  IF p_accept THEN
    UPDATE public.hiring_interview_rounds SET status = 'scheduled', updated_at = now() WHERE id = p_round_id;
    UPDATE public.hiring_applications SET current_stage = 'interview_scheduled', stage_updated_at = now(), updated_at = now() WHERE id = v_app.id;

    INSERT INTO public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id, metadata)
    VALUES (v_app.id, 'interview_accepted', v_old_stage, 'interview_scheduled', auth.uid(), v_profile_id, jsonb_build_object('round_id', p_round_id));
  ELSE
    UPDATE public.hiring_interview_rounds SET status = 'declined', updated_at = now() WHERE id = p_round_id;

    INSERT INTO public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id, metadata)
    VALUES (v_app.id, 'interview_declined', v_old_stage, v_old_stage, auth.uid(), v_profile_id,
      jsonb_build_object('round_id', p_round_id, 'reason', p_decline_reason));
  END IF;

  FOR v_panelist IN SELECT profile_id FROM public.hiring_interview_panelists WHERE round_id = p_round_id AND profile_id IS NOT NULL LOOP
    INSERT INTO public.notifications(user_id, type, payload)
    VALUES (v_panelist.profile_id,
      CASE WHEN p_accept THEN 'interview_accepted' ELSE 'interview_declined' END,
      jsonb_build_object('application_id', v_app.id, 'round_id', p_round_id, 'job_title', v_job_title,
        'company_name', v_company_name, 'candidate_name', v_candidate_name));
  END LOOP;

  BEGIN
    v_conv_id := public.get_or_create_conversation(auth.uid(), v_round.created_by_user_id);
    INSERT INTO public.messages(conversation_id, sender_id, content, message_type, metadata)
    VALUES (
      v_conv_id, auth.uid(),
      CASE WHEN p_accept THEN 'Interview invitation accepted' ELSE 'Interview invitation declined' END,
      'interview_card',
      jsonb_build_object('application_id', v_app.id, 'round_id', p_round_id,
        'status', CASE WHEN p_accept THEN 'scheduled' ELSE 'declined' END,
        'job_title', v_job_title, 'company_name', v_company_name)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;
END;
$$;

-- ============================================================
-- 9. reschedule_interview_round
-- ============================================================
CREATE OR REPLACE FUNCTION public.reschedule_interview_round(
  p_round_id uuid, p_new_scheduled_at timestamptz, p_new_meeting_link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_round public.hiring_interview_rounds%rowtype;
  v_app public.hiring_applications%rowtype;
  v_profile_id uuid;
  v_old_time timestamptz;
  v_panelist record;
  v_job_title text;
  v_company_name text;
  v_conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_round FROM public.hiring_interview_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_app FROM public.hiring_applications WHERE id = v_round.application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF NOT public.is_job_recruiter(v_app.job_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.is_blocked_by(v_app.candidate_profile_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_round.status NOT IN ('invited', 'scheduled') THEN RAISE EXCEPTION 'This round can no longer be rescheduled'; END IF;
  IF p_new_scheduled_at IS NULL OR p_new_scheduled_at <= now() THEN RAISE EXCEPTION 'New time must be in the future'; END IF;
  IF v_round.mode = 'online' AND p_new_meeting_link IS NOT NULL AND p_new_meeting_link !~ '^https://' THEN
    RAISE EXCEPTION 'Meeting link must be HTTPS';
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();
  v_old_time := v_round.scheduled_at;

  UPDATE public.hiring_interview_rounds
  SET scheduled_at = p_new_scheduled_at,
      meeting_link = coalesce(p_new_meeting_link, meeting_link),
      updated_at = now()
  WHERE id = p_round_id;

  INSERT INTO public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id, metadata)
  VALUES (v_app.id, 'interview_rescheduled', v_app.current_stage, v_app.current_stage, auth.uid(), v_profile_id,
    jsonb_build_object('round_id', p_round_id, 'old_scheduled_at', v_old_time, 'new_scheduled_at', p_new_scheduled_at));

  SELECT j.title, coalesce(c.name, j.company_name) INTO v_job_title, v_company_name
  FROM public.jobs j LEFT JOIN public.companies c ON c.id = j.company_id WHERE j.id = v_app.job_id;

  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (v_app.candidate_profile_id, 'interview_rescheduled', jsonb_build_object(
    'application_id', v_app.id, 'round_id', p_round_id, 'job_title', v_job_title, 'company_name', v_company_name,
    'old_scheduled_at', v_old_time, 'new_scheduled_at', p_new_scheduled_at));

  FOR v_panelist IN SELECT profile_id FROM public.hiring_interview_panelists WHERE round_id = p_round_id AND profile_id IS NOT NULL AND profile_id <> v_profile_id LOOP
    INSERT INTO public.notifications(user_id, type, payload)
    VALUES (v_panelist.profile_id, 'interview_rescheduled', jsonb_build_object(
      'application_id', v_app.id, 'round_id', p_round_id, 'job_title', v_job_title,
      'old_scheduled_at', v_old_time, 'new_scheduled_at', p_new_scheduled_at));
  END LOOP;

  BEGIN
    v_conv_id := public.get_or_create_conversation(auth.uid(), v_app.candidate_user_id);
    INSERT INTO public.messages(conversation_id, sender_id, content, message_type, metadata)
    VALUES (v_conv_id, auth.uid(), 'Interview rescheduled', 'interview_card',
      jsonb_build_object('application_id', v_app.id, 'round_id', p_round_id, 'status', 'rescheduled',
        'scheduled_at', p_new_scheduled_at, 'job_title', v_job_title, 'company_name', v_company_name));
  EXCEPTION WHEN OTHERS THEN NULL; END;
END;
$$;

-- ============================================================
-- 10. cancel_interview_round
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_interview_round(p_round_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_round public.hiring_interview_rounds%rowtype;
  v_app public.hiring_applications%rowtype;
  v_profile_id uuid;
  v_panelist record;
  v_job_title text;
  v_company_name text;
  v_conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_round FROM public.hiring_interview_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_app FROM public.hiring_applications WHERE id = v_round.application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF NOT public.is_job_recruiter(v_app.job_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.is_blocked_by(v_app.candidate_profile_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_round.status IN ('cancelled', 'completed') THEN RAISE EXCEPTION 'This round is already closed'; END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();

  UPDATE public.hiring_interview_rounds SET status = 'cancelled', updated_at = now() WHERE id = p_round_id;

  INSERT INTO public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id, metadata)
  VALUES (v_app.id, 'interview_cancelled', v_app.current_stage, v_app.current_stage, auth.uid(), v_profile_id,
    jsonb_build_object('round_id', p_round_id, 'reason', p_reason));

  SELECT j.title, coalesce(c.name, j.company_name) INTO v_job_title, v_company_name
  FROM public.jobs j LEFT JOIN public.companies c ON c.id = j.company_id WHERE j.id = v_app.job_id;

  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (v_app.candidate_profile_id, 'interview_cancelled', jsonb_build_object(
    'application_id', v_app.id, 'round_id', p_round_id, 'job_title', v_job_title, 'company_name', v_company_name, 'reason', p_reason));

  FOR v_panelist IN SELECT profile_id FROM public.hiring_interview_panelists WHERE round_id = p_round_id AND profile_id IS NOT NULL AND profile_id <> v_profile_id LOOP
    INSERT INTO public.notifications(user_id, type, payload)
    VALUES (v_panelist.profile_id, 'interview_cancelled', jsonb_build_object('application_id', v_app.id, 'round_id', p_round_id, 'job_title', v_job_title, 'reason', p_reason));
  END LOOP;

  BEGIN
    v_conv_id := public.get_or_create_conversation(auth.uid(), v_app.candidate_user_id);
    INSERT INTO public.messages(conversation_id, sender_id, content, message_type, metadata)
    VALUES (v_conv_id, auth.uid(), 'Interview cancelled', 'interview_card',
      jsonb_build_object('application_id', v_app.id, 'round_id', p_round_id, 'status', 'cancelled',
        'job_title', v_job_title, 'company_name', v_company_name, 'reason', p_reason));
  EXCEPTION WHEN OTHERS THEN NULL; END;
END;
$$;

-- ============================================================
-- 11. mark_interview_outcome
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_interview_outcome(p_round_id uuid, p_outcome text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_round public.hiring_interview_rounds%rowtype;
  v_app public.hiring_applications%rowtype;
  v_profile_id uuid;
  v_event_type public.application_event_type;
  v_latest_round_id uuid;
BEGIN
  IF p_outcome NOT IN ('completed', 'no_show') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_round FROM public.hiring_interview_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_app FROM public.hiring_applications WHERE id = v_round.application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF NOT public.is_job_recruiter(v_app.job_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.is_blocked_by(v_app.candidate_profile_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_round.status <> 'scheduled' THEN RAISE EXCEPTION 'Only a scheduled round can be marked completed or no-show'; END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();

  UPDATE public.hiring_interview_rounds
  SET status = p_outcome::public.interview_round_status, updated_at = now()
  WHERE id = p_round_id;

  v_event_type := CASE WHEN p_outcome = 'completed' THEN 'interview_completed'::public.application_event_type
                        ELSE 'interview_no_show'::public.application_event_type END;

  INSERT INTO public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id, metadata)
  VALUES (v_app.id, v_event_type, v_app.current_stage, v_app.current_stage, auth.uid(), v_profile_id, jsonb_build_object('round_id', p_round_id));

  SELECT id INTO v_latest_round_id FROM public.hiring_interview_rounds
  WHERE application_id = v_app.id ORDER BY round_no DESC LIMIT 1;

  IF p_outcome = 'completed' AND v_latest_round_id = p_round_id THEN
    UPDATE public.hiring_applications
    SET current_stage = 'interview_completed', stage_updated_at = now(), updated_at = now()
    WHERE id = v_app.id;
  END IF;
END;
$$;

-- ============================================================
-- 12. submit_interview_feedback
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_interview_feedback(
  p_round_id uuid,
  p_technical smallint,
  p_communication smallint,
  p_problem_solving smallint,
  p_overall smallint,
  p_recommendation public.interview_recommendation,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_round public.hiring_interview_rounds%rowtype;
  v_app public.hiring_applications%rowtype;
  v_profile_id uuid;
  v_is_panelist boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_round FROM public.hiring_interview_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_app FROM public.hiring_applications WHERE id = v_round.application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.hiring_interview_panelists hp WHERE hp.round_id = p_round_id AND hp.user_id = auth.uid()
  ) INTO v_is_panelist;

  IF NOT v_is_panelist THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.is_job_recruiter(v_app.job_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.is_blocked_by(v_app.candidate_profile_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.hiring_interview_feedback(
    round_id, panelist_user_id, panelist_profile_id, technical_skill, communication, problem_solving, overall, recommendation, private_notes
  ) VALUES (
    p_round_id, auth.uid(), v_profile_id, p_technical, p_communication, p_problem_solving, p_overall, p_recommendation, nullif(trim(p_notes), '')
  )
  ON CONFLICT (round_id, panelist_user_id) DO UPDATE SET
    technical_skill = excluded.technical_skill,
    communication = excluded.communication,
    problem_solving = excluded.problem_solving,
    overall = excluded.overall,
    recommendation = excluded.recommendation,
    private_notes = excluded.private_notes,
    updated_at = now();

  -- deliberately excludes notes/scores -- this event is visible on the candidate-safe timeline
  INSERT INTO public.hiring_application_events(application_id, event_type, from_stage, to_stage, actor_user_id, actor_profile_id, metadata)
  VALUES (v_app.id, 'interview_feedback_submitted', v_app.current_stage, v_app.current_stage, auth.uid(), v_profile_id,
    jsonb_build_object('round_id', p_round_id));
END;
$$;
