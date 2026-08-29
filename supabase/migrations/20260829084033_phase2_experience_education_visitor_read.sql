-- =============================================================================
-- Phase 2 — visitor read for experience / education
--
-- Verified against the LIVE DB first: both tables already exist, are populated
-- (backfill 20260821171617), and have owner-only read + write RLS
-- (experience_owner_read / experience_owner_write, same for education). They
-- had NO path for other users to read them, so career history was invisible
-- on other people's profiles.
--
-- This adds a NEW permissive SELECT policy (the existing owner policies are
-- left untouched — nothing is weakened). Visibility is delegated to profiles'
-- own RLS: the profiles sub-select is itself filtered by
-- profiles_select_respecting_visibility, so a viewer sees a member's
-- experience/education exactly when they may see that member's profile.
-- One privacy model, no duplication.
--
-- SAFE / NON-DESTRUCTIVE: DROP POLICY IF EXISTS + CREATE POLICY only.
-- =============================================================================

DROP POLICY IF EXISTS "experience_read_if_profile_visible" ON public.experience;
CREATE POLICY "experience_read_if_profile_visible"
  ON public.experience FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = experience.user_id));

DROP POLICY IF EXISTS "education_read_if_profile_visible" ON public.education;
CREATE POLICY "education_read_if_profile_visible"
  ON public.education FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = education.user_id));
