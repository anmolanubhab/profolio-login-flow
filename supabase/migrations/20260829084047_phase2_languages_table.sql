-- =============================================================================
-- Phase 2 — public.languages
--
-- Verified against the LIVE DB first: there was NO languages table and NO
-- language column anywhere. Created here following the exact experience /
-- education pattern (PK, FK -> profiles.id ON DELETE CASCADE, owner-write RLS,
-- visitor read delegated to profile visibility). Projects were checked too and
-- deliberately left in profiles.projects (jsonb) — that column is the store.
--
-- proficiency is a text column with a CHECK for the LinkedIn-style ladder
-- (kept separate from the skills-oriented proficiency_level enum).
--
-- SAFE / NON-DESTRUCTIVE: CREATE ... IF NOT EXISTS + DROP POLICY IF EXISTS /
-- CREATE POLICY. No data writes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.languages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  proficiency text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT languages_name_len CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT languages_proficiency_check CHECK (proficiency IN (
    'elementary', 'limited_working', 'professional_working',
    'full_professional', 'native'
  )),
  CONSTRAINT languages_unique_per_user UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_languages_user ON public.languages (user_id);

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

-- read: delegate to profile visibility (same pattern as experience/education)
DROP POLICY IF EXISTS "languages_read_if_profile_visible" ON public.languages;
CREATE POLICY "languages_read_if_profile_visible"
  ON public.languages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = languages.user_id));

-- write: owner only (identical shape to experience_owner_write)
DROP POLICY IF EXISTS "languages_owner_write" ON public.languages;
CREATE POLICY "languages_owner_write"
  ON public.languages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = languages.user_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = languages.user_id AND p.user_id = auth.uid()
  ));

COMMENT ON TABLE public.languages IS 'Profile languages with proficiency; owner-write, visible wherever the profile is visible.';
