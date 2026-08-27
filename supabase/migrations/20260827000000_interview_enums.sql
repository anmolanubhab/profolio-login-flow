-- Hiring Interview System (part 1/2): enum additions.
-- Additive only. No existing rows touched. New enum values must land in a
-- separate transaction from anything that references them (Postgres
-- restriction on ALTER TYPE ... ADD VALUE).

ALTER TYPE public.application_stage ADD VALUE IF NOT EXISTS 'interview_offered' BEFORE 'interview_scheduled';

ALTER TYPE public.application_event_type ADD VALUE IF NOT EXISTS 'interview_invited';
ALTER TYPE public.application_event_type ADD VALUE IF NOT EXISTS 'interview_accepted';
ALTER TYPE public.application_event_type ADD VALUE IF NOT EXISTS 'interview_declined';
ALTER TYPE public.application_event_type ADD VALUE IF NOT EXISTS 'interview_rescheduled';
ALTER TYPE public.application_event_type ADD VALUE IF NOT EXISTS 'interview_cancelled';
ALTER TYPE public.application_event_type ADD VALUE IF NOT EXISTS 'interview_no_show';

ALTER TYPE public.interview_round_status ADD VALUE IF NOT EXISTS 'invited';
ALTER TYPE public.interview_round_status ADD VALUE IF NOT EXISTS 'declined';

DO $$ BEGIN
  CREATE TYPE public.interview_mode AS ENUM ('online', 'offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.meeting_provider AS ENUM ('zoom', 'microsoft_teams', 'google_meet', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.interview_recommendation AS ENUM ('strong_hire', 'hire', 'maybe', 'reject');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
