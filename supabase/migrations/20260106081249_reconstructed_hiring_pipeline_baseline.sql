-- ============================================================================
-- RECONSTRUCTED BASELINE (NOT THE ORIGINAL MIGRATION SQL)
-- ============================================================================
-- Generated 2026-08-21 by introspecting the LIVE production schema of
-- Supabase project ajbhpqbfcpmztjtxqxxk ("Profolio") via read-only queries
-- (information_schema.columns, pg_constraint, pg_indexes, pg_policies,
-- pg_proc/pg_get_functiondef, pg_trigger). No apply_migration/DDL was ever
-- run against the live database to produce this file.
--
-- This single file consolidates SIX applied-but-uncommitted migrations that
-- `list_migrations` reported for this project but for which no matching
-- file existed anywhere in supabase/migrations/:
--   20260106081249
--   20260106085551
--   20260108080700
--   20260109084130
--   20260109084222
--   20260110062207
--
-- These six migrations had no descriptive names in the migration history
-- (unlike the later 2026-07-20 batch), so the exact boundary between them
-- could not be recovered. Based on the objects that exist live and did not
-- exist as of the last committed migration (20260103074125), they appear to
-- collectively implement a "hiring pipeline" feature set: structured job
-- applications/interviews/offers/match-scoring, a candidate search index,
-- and a hardened company-invitation flow. They are combined here into one
-- idempotent file rather than guessed apart into six, per the task's
-- "or a single consolidated baseline file" allowance.
--
-- GOAL: running this file (in order, after the 30 existing migration files)
-- against a fresh empty database should produce a schema EQUIVALENT to the
-- live one for these objects -- not necessarily byte-identical DDL.
--
-- UNCERTAIN / COULD NOT FULLY VERIFY:
--   * The exact split of objects across the six original migrations.
--   * Whether `user_skills` table (referenced by compute_match_score) was
--     created here or already existed; it is not created by this file --
--     if it's missing from a fresh DB, compute_match_score() will fail at
--     call time (not at migration time, since the function body is only
--     parsed, not resolved, at CREATE FUNCTION time for plpgsql).
--   * Whether `applications` (legacy) vs `hiring_applications` overlap was
--     introduced earlier; only hiring_* objects are (re)created here.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.application_stage AS ENUM (
    'applied','screening','shortlisted','interview_scheduled','interview_completed',
    'offer_extended','offer_accepted','offer_declined','hired','rejected','withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.application_event_type AS ENUM (
    'created','stage_changed','note_added','interview_scheduled',
    'interview_feedback_submitted','offer_created','offer_accepted','offer_declined','withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.interview_round_type AS ENUM (
    'recruiter_screen','hiring_manager','technical','panel','culture','executive'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.interview_round_status AS ENUM (
    'scheduled','completed','cancelled','no_show'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.offer_status AS ENUM (
    'draft','extended','accepted','declined','expired','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hiring_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resume_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL,
  cover_note text,
  current_stage public.application_stage NOT NULL DEFAULT 'applied',
  stage_updated_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  rejection_reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_user_id)
);
CREATE INDEX IF NOT EXISTS idx_ha_candidate ON public.hiring_applications (candidate_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ha_job_stage ON public.hiring_applications (job_id, current_stage);

CREATE TABLE IF NOT EXISTS public.hiring_application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.hiring_applications(id) ON DELETE CASCADE,
  event_type public.application_event_type NOT NULL,
  from_stage public.application_stage,
  to_stage public.application_stage,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hae_app_created ON public.hiring_application_events (application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.hiring_interview_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.hiring_applications(id) ON DELETE CASCADE,
  round_no integer NOT NULL CHECK (round_no > 0),
  round_type public.interview_round_type NOT NULL,
  status public.interview_round_status NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamptz,
  duration_minutes integer CHECK (duration_minutes > 0),
  meeting_link text,
  interviewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  interviewer_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  feedback_text text,
  feedback_score numeric CHECK (feedback_score >= 0 AND feedback_score <= 10),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, round_no)
);

CREATE TABLE IF NOT EXISTS public.hiring_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.hiring_applications(id) ON DELETE CASCADE,
  status public.offer_status NOT NULL DEFAULT 'draft',
  base_salary numeric,
  bonus numeric,
  equity text,
  currency text NOT NULL DEFAULT 'USD',
  start_date date,
  expires_at timestamptz,
  offer_letter_url text,
  extended_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hiring_match_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  matched_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_hms_candidate ON public.hiring_match_scores (candidate_profile_id);
CREATE INDEX IF NOT EXISTS idx_hms_job_score ON public.hiring_match_scores (job_id, score DESC);

CREATE TABLE IF NOT EXISTS public.job_skill_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  min_level smallint CHECK (min_level >= 1 AND min_level <= 5),
  weight numeric NOT NULL DEFAULT 1.0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_skill_job ON public.job_skill_requirements (job_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_skill_unique ON public.job_skill_requirements (job_id, lower(skill_name));

CREATE TABLE IF NOT EXISTS public.candidate_search_index (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  headline text,
  location text,
  years_experience numeric,
  skills text[] NOT NULL DEFAULT '{}'::text[],
  open_to_work boolean NOT NULL DEFAULT false,
  searchable tsvector,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csi_open_to_work ON public.candidate_search_index (open_to_work);
CREATE INDEX IF NOT EXISTS idx_csi_searchable ON public.candidate_search_index USING gin (searchable);
CREATE INDEX IF NOT EXISTS idx_csi_skills_gin ON public.candidate_search_index USING gin (skills);

-- Company invitations hardening: token hashing + rate limiting.
ALTER TABLE public.company_invitations ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.company_invitations ADD COLUMN IF NOT EXISTS used_at timestamptz;
ALTER TABLE public.company_invitations ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles(id);

CREATE TABLE IF NOT EXISTS public.invitation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text,
  user_id uuid,
  attempt_count integer DEFAULT 1,
  last_attempt_at timestamptz DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Legacy compatibility views (created security_invoker via a later fix
-- migration -- 20260720175136_fix_legacy_views_security_invoker.sql -- but
-- the views themselves originate here since they read hiring_applications).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.applications_legacy AS
SELECT
  id,
  candidate_profile_id AS user_id,
  job_id,
  resume_id,
  cover_note AS cover_letter,
  CASE
    WHEN current_stage = 'applied' THEN 'applied'
    WHEN current_stage IN ('shortlisted','interview_scheduled','interview_completed') THEN 'shortlisted'
    WHEN current_stage = 'rejected' THEN 'rejected'
    ELSE 'applied'
  END AS status,
  created_at AS applied_at
FROM public.hiring_applications ha;

CREATE OR REPLACE VIEW public.job_applications_legacy AS
SELECT
  id,
  candidate_user_id AS user_id,
  job_id,
  resume_id,
  cover_note,
  CASE
    WHEN current_stage = 'applied' THEN 'applied'
    WHEN current_stage = 'screening' THEN 'viewed'
    WHEN current_stage IN ('shortlisted','interview_scheduled','interview_completed') THEN 'shortlisted'
    WHEN current_stage = 'rejected' THEN 'rejected'
    ELSE 'applied'
  END AS status,
  created_at
FROM public.hiring_applications ha;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_company_recruiter(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select exists (
    select 1 from public.company_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.company_id = _company_id
      and p.user_id = auth.uid()
      and cm.role in ('super_admin','content_admin')
  )
  or exists (
    select 1 from public.companies c
    join public.profiles p on p.id = c.owner_id
    where c.id = _company_id and p.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_job_recruiter(_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select exists (
    select 1 from public.jobs j
    where j.id = _job_id and public.is_company_recruiter(j.company_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.hash_token(token_input text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $$
BEGIN
  RETURN encode(digest(token_input, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_company_invitation(company_id uuid, email text, role company_role)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  plain_token TEXT;
  token_hash_val TEXT;
  sender_id UUID;
BEGIN
  sender_id := auth.uid();
  IF NOT is_company_admin(sender_id, create_company_invitation.company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  plain_token := encode(gen_random_bytes(32), 'hex');
  token_hash_val := public.hash_token(plain_token);

  INSERT INTO public.company_invitations (
    company_id, email, invited_by, role, status, token_hash, token, expires_at
  ) VALUES (
    create_company_invitation.company_id,
    create_company_invitation.email,
    sender_id,
    create_company_invitation.role,
    'pending',
    token_hash_val,
    gen_random_uuid(),
    now() + INTERVAL '48 hours'
  );

  RETURN plain_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_company_invitation_v2(invitation_id uuid, token_input text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  inv RECORD;
  user_profile_id UUID;
  attempt_record RECORD;
  hashed_input TEXT;
  target_profile_id UUID;
  user_email TEXT;
BEGIN
  user_profile_id := auth.uid();
  IF user_profile_id IS NULL THEN
     RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO attempt_record FROM public.invitation_attempts
  WHERE user_id = user_profile_id
  AND created_at > (now() - INTERVAL '1 hour');

  IF FOUND THEN
    IF attempt_record.blocked_until > now() THEN
       RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
    END IF;

    IF attempt_record.attempt_count >= 3 THEN
       UPDATE public.invitation_attempts
       SET blocked_until = now() + INTERVAL '15 minutes'
       WHERE id = attempt_record.id;
       RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
    END IF;
  END IF;

  SELECT * INTO inv FROM public.company_invitations WHERE id = invitation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  IF inv.status != 'pending' THEN
     RETURN jsonb_build_object('success', false, 'error', 'Invitation already ' || inv.status);
  END IF;

  IF inv.expires_at < now() THEN
     UPDATE public.company_invitations SET status = 'expired' WHERE id = invitation_id;
     RETURN jsonb_build_object('success', false, 'error', 'Invitation expired');
  END IF;

  hashed_input := public.hash_token(token_input);

  IF inv.token_hash IS NULL OR inv.token_hash != hashed_input THEN
    IF FOUND THEN
      UPDATE public.invitation_attempts
      SET attempt_count = attempt_count + 1, last_attempt_at = now()
      WHERE id = attempt_record.id;
    ELSE
      INSERT INTO public.invitation_attempts (user_id, attempt_count) VALUES (user_profile_id, 1);
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL OR lower(user_email) != lower(inv.email) THEN
     RETURN jsonb_build_object('success', false, 'error', 'Email mismatch');
  END IF;

  SELECT id INTO target_profile_id FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (inv.company_id, target_profile_id, inv.role)
  ON CONFLICT (company_id, user_id) DO UPDATE SET role = inv.role;

  UPDATE public.company_invitations
  SET status = 'accepted', used_at = now(), accepted_by = target_profile_id, updated_at = now()
  WHERE id = invitation_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_to_job(p_job_id uuid, p_resume_id uuid DEFAULT NULL, p_cover_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare v_profile_id uuid; v_application_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_profile_id from public.profiles where user_id = auth.uid();
  if v_profile_id is null then raise exception 'Profile not found'; end if;

  insert into public.hiring_applications(job_id,candidate_user_id,candidate_profile_id,resume_id,cover_note,current_stage)
  values (p_job_id,auth.uid(),v_profile_id,p_resume_id,nullif(trim(p_cover_note),''),'applied')
  on conflict (job_id,candidate_user_id) do update set updated_at = now()
  returning id into v_application_id;

  insert into public.hiring_application_events(application_id,event_type,to_stage,actor_user_id,actor_profile_id)
  values (v_application_id,'created','applied',auth.uid(),v_profile_id);

  return v_application_id;
end $$;

CREATE OR REPLACE FUNCTION public.update_application_stage(p_application_id uuid, p_new_stage application_stage, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare v_app public.hiring_applications%rowtype; v_old public.application_stage; v_profile_id uuid;
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
end $$;

CREATE OR REPLACE FUNCTION public.schedule_interview_round(p_application_id uuid, p_round_type interview_round_type, p_scheduled_at timestamptz, p_duration_minutes integer, p_meeting_link text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare v_app public.hiring_applications%rowtype; v_round_no int; v_id uuid;
begin
  select * into v_app from public.hiring_applications where id = p_application_id;
  if not found then raise exception 'Application not found'; end if;
  if not public.is_job_recruiter(v_app.job_id) then raise exception 'Not authorized'; end if;

  select coalesce(max(round_no),0)+1 into v_round_no
  from public.hiring_interview_rounds where application_id = p_application_id;

  insert into public.hiring_interview_rounds(application_id,round_no,round_type,status,scheduled_at,duration_minutes,meeting_link,created_by_user_id)
  values (p_application_id,v_round_no,p_round_type,'scheduled',p_scheduled_at,p_duration_minutes,p_meeting_link,auth.uid())
  returning id into v_id;

  perform public.update_application_stage(p_application_id,'interview_scheduled',null);
  return v_id;
end $$;

CREATE OR REPLACE FUNCTION public.create_offer(p_application_id uuid, p_base_salary numeric, p_bonus numeric DEFAULT NULL, p_equity text DEFAULT NULL, p_currency text DEFAULT 'USD', p_start_date date DEFAULT NULL, p_expires_at timestamptz DEFAULT NULL, p_offer_letter_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare v_app public.hiring_applications%rowtype; v_offer_id uuid;
begin
  select * into v_app from public.hiring_applications where id = p_application_id;
  if not found then raise exception 'Application not found'; end if;
  if not public.is_job_recruiter(v_app.job_id) then raise exception 'Not authorized'; end if;

  insert into public.hiring_offers(application_id,status,base_salary,bonus,equity,currency,start_date,expires_at,offer_letter_url,extended_by_user_id)
  values (p_application_id,'extended',p_base_salary,p_bonus,p_equity,p_currency,p_start_date,p_expires_at,p_offer_letter_url,auth.uid())
  on conflict (application_id) do update
    set status='extended', base_salary=excluded.base_salary, bonus=excluded.bonus, equity=excluded.equity,
        currency=excluded.currency, start_date=excluded.start_date, expires_at=excluded.expires_at,
        offer_letter_url=excluded.offer_letter_url, updated_at=now()
  returning id into v_offer_id;

  perform public.update_application_stage(p_application_id,'offer_extended',null);
  return v_offer_id;
end $$;

CREATE OR REPLACE FUNCTION public.accept_offer(p_offer_id uuid, p_accept boolean, p_decline_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare v_offer public.hiring_offers%rowtype; v_app public.hiring_applications%rowtype;
begin
  select * into v_offer from public.hiring_offers where id = p_offer_id;
  if not found then raise exception 'Offer not found'; end if;

  select * into v_app from public.hiring_applications where id = v_offer.application_id;
  if auth.uid() <> v_app.candidate_user_id then raise exception 'Only candidate can respond'; end if;

  if p_accept then
    update public.hiring_offers set status='accepted', accepted_at=now(), updated_at=now() where id = p_offer_id;
    perform public.update_application_stage(v_offer.application_id,'offer_accepted',null);
    perform public.update_application_stage(v_offer.application_id,'hired',null);
  else
    update public.hiring_offers set status='declined', declined_at=now(), decline_reason=p_decline_reason, updated_at=now() where id = p_offer_id;
    perform public.update_application_stage(v_offer.application_id,'offer_declined',p_decline_reason);
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.compute_match_score(p_job_id uuid, p_candidate_profile_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare v_candidate_user uuid; v_score numeric := 0;
begin
  select user_id into v_candidate_user from public.profiles where id = p_candidate_profile_id;
  if v_candidate_user is null then raise exception 'Candidate profile not found'; end if;

  with req as (
    select skill_name, coalesce(weight,1.0) as w from public.job_skill_requirements where job_id = p_job_id
  ),
  cand as (
    select lower(skill_name) s from public.user_skills where user_id = v_candidate_user
    union
    select lower(skill_name) s from public.skills where user_id = p_candidate_profile_id
  ),
  agg as (
    select coalesce(sum(req.w),0) tw,
           coalesce(sum(case when exists(select 1 from cand where cand.s = lower(req.skill_name)) then req.w else 0 end),0) mw
    from req
  )
  select case when tw > 0 then round((mw/tw)*100,2) else 0 end into v_score from agg;

  insert into public.hiring_match_scores(job_id,candidate_profile_id,candidate_user_id,score,explanation)
  values (p_job_id,p_candidate_profile_id,v_candidate_user,v_score,jsonb_build_object('method','weighted_skill_overlap'))
  on conflict (job_id,candidate_profile_id) do update
    set score = excluded.score, explanation = excluded.explanation, computed_at = now();

  return v_score;
end $$;

CREATE OR REPLACE FUNCTION public.search_candidates(p_company_id uuid, p_query text DEFAULT NULL, p_location text DEFAULT NULL, p_required_skills text[] DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(profile_id uuid, full_name text, headline text, location text, years_experience numeric, skills text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.is_company_recruiter(p_company_id) then raise exception 'Not authorized recruiter'; end if;

  return query
  select csi.profile_id, csi.full_name, csi.headline, csi.location, csi.years_experience, csi.skills
  from public.candidate_search_index csi
  where (p_query is null or csi.searchable @@ websearch_to_tsquery('english', p_query))
    and (p_location is null or lower(csi.location)=lower(p_location))
    and (p_required_skills is null or csi.skills @> p_required_skills)
  order by csi.updated_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.hiring_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_interview_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_skill_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_attempts ENABLE ROW LEVEL SECURITY;

-- hiring_applications: mutated only via SECURITY DEFINER RPCs above.
DROP POLICY IF EXISTS ha_select ON public.hiring_applications;
CREATE POLICY ha_select ON public.hiring_applications FOR SELECT
  USING (candidate_user_id = auth.uid() OR is_job_recruiter(job_id));
DROP POLICY IF EXISTS ha_insert_block ON public.hiring_applications;
CREATE POLICY ha_insert_block ON public.hiring_applications FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS ha_update_block ON public.hiring_applications;
CREATE POLICY ha_update_block ON public.hiring_applications FOR UPDATE USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS ha_delete_block ON public.hiring_applications;
CREATE POLICY ha_delete_block ON public.hiring_applications FOR DELETE USING (false);

DROP POLICY IF EXISTS hae_select ON public.hiring_application_events;
CREATE POLICY hae_select ON public.hiring_application_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.hiring_applications ha WHERE ha.id = hiring_application_events.application_id AND (ha.candidate_user_id = auth.uid() OR is_job_recruiter(ha.job_id))));
DROP POLICY IF EXISTS hae_insert_block ON public.hiring_application_events;
CREATE POLICY hae_insert_block ON public.hiring_application_events FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS hir_select ON public.hiring_interview_rounds;
CREATE POLICY hir_select ON public.hiring_interview_rounds FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.hiring_applications ha WHERE ha.id = hiring_interview_rounds.application_id AND (ha.candidate_user_id = auth.uid() OR is_job_recruiter(ha.job_id))));
DROP POLICY IF EXISTS hir_insert_block ON public.hiring_interview_rounds;
CREATE POLICY hir_insert_block ON public.hiring_interview_rounds FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS hir_update_block ON public.hiring_interview_rounds;
CREATE POLICY hir_update_block ON public.hiring_interview_rounds FOR UPDATE USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS ho_select ON public.hiring_offers;
CREATE POLICY ho_select ON public.hiring_offers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.hiring_applications ha WHERE ha.id = hiring_offers.application_id AND (ha.candidate_user_id = auth.uid() OR is_job_recruiter(ha.job_id))));
DROP POLICY IF EXISTS ho_insert_block ON public.hiring_offers;
CREATE POLICY ho_insert_block ON public.hiring_offers FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS ho_update_block ON public.hiring_offers;
CREATE POLICY ho_update_block ON public.hiring_offers FOR UPDATE USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS hms_select ON public.hiring_match_scores;
CREATE POLICY hms_select ON public.hiring_match_scores FOR SELECT
  USING (candidate_user_id = auth.uid() OR is_job_recruiter(job_id));
DROP POLICY IF EXISTS hms_insert_block ON public.hiring_match_scores;
CREATE POLICY hms_insert_block ON public.hiring_match_scores FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS hms_update_block ON public.hiring_match_scores;
CREATE POLICY hms_update_block ON public.hiring_match_scores FOR UPDATE USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS jsr_select ON public.job_skill_requirements;
CREATE POLICY jsr_select ON public.job_skill_requirements FOR SELECT USING (true);
DROP POLICY IF EXISTS jsr_insert ON public.job_skill_requirements;
CREATE POLICY jsr_insert ON public.job_skill_requirements FOR INSERT WITH CHECK (is_job_recruiter(job_id));
DROP POLICY IF EXISTS jsr_update ON public.job_skill_requirements;
CREATE POLICY jsr_update ON public.job_skill_requirements FOR UPDATE USING (is_job_recruiter(job_id)) WITH CHECK (is_job_recruiter(job_id));
DROP POLICY IF EXISTS jsr_delete ON public.job_skill_requirements;
CREATE POLICY jsr_delete ON public.job_skill_requirements FOR DELETE USING (is_job_recruiter(job_id));

DROP POLICY IF EXISTS csi_select ON public.candidate_search_index;
CREATE POLICY csi_select ON public.candidate_search_index FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.company_members cm JOIN public.profiles p ON p.id = cm.user_id WHERE p.user_id = auth.uid() AND cm.role = ANY (ARRAY['super_admin'::company_role,'content_admin'::company_role])));
DROP POLICY IF EXISTS csi_insert ON public.candidate_search_index;
CREATE POLICY csi_insert ON public.candidate_search_index FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS csi_update ON public.candidate_search_index;
CREATE POLICY csi_update ON public.candidate_search_index FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- invitation_attempts: no direct end-user access; managed via SECURITY DEFINER functions only.

COMMENT ON TABLE public.hiring_applications IS 'Reconstructed baseline (see file header) representing DB migrations 20260106081249..20260110062207.';
