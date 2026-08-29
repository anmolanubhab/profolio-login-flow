-- =============================================================================
-- Phase 1 — profile_reports
--
-- Backs the "Report" action in the profile More menu. Verified before writing:
-- no profile_reports table exists; post_reports exists for posts only. Uses the
-- live helper current_profile_id() (SECURITY DEFINER) for the RLS check, the
-- same pattern as other tables in this schema. Block is handled by the
-- pre-existing public.blocked_users table (no migration needed).
--
-- SAFE / NON-DESTRUCTIVE:
--   * CREATE TABLE IF NOT EXISTS + guarded DROP POLICY IF EXISTS / CREATE
--   * no existing table or data is touched
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profile_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason              text NOT NULL,
  details             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_reports_reason_len  CHECK (char_length(reason) BETWEEN 1 AND 100),
  CONSTRAINT profile_reports_details_len CHECK (details IS NULL OR char_length(details) <= 1000),
  CONSTRAINT profile_reports_no_self     CHECK (reporter_id <> reported_profile_id),
  CONSTRAINT profile_reports_unique      UNIQUE (reporter_id, reported_profile_id)
);

CREATE INDEX IF NOT EXISTS profile_reports_reported_idx ON public.profile_reports (reported_profile_id);
CREATE INDEX IF NOT EXISTS profile_reports_reporter_idx ON public.profile_reports (reporter_id);

ALTER TABLE public.profile_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_reports_insert_own" ON public.profile_reports;
CREATE POLICY "profile_reports_insert_own"
  ON public.profile_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = public.current_profile_id());

DROP POLICY IF EXISTS "profile_reports_select_own" ON public.profile_reports;
CREATE POLICY "profile_reports_select_own"
  ON public.profile_reports FOR SELECT
  TO authenticated
  USING (reporter_id = public.current_profile_id());
