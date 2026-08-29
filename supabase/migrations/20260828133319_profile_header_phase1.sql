-- =============================================================================
-- Phase 1 — Profile header fields
--
-- Adds only the header fields that DO NOT already exist on public.profiles:
--   * cover_position   — vertical focal point for the (already-existing) cover_url
--   * headline         — LinkedIn-style tagline (UI falls back to profession)
--   * pronouns         — shown next to the name
--   * photo_visibility — public | connections_only | private
--
-- Verified against the live schema before writing this file:
--   * cover_url         ALREADY EXISTS  -> not re-added
--   * open_to_work      ALREADY EXISTS  -> not re-added
--   * email_visibility / phone_visibility ALREADY EXIST (text, check
--       public|private|connections_only) -> reused by the Edit dialog; no new
--       contact_visibility column is introduced.
--
-- SAFE / NON-DESTRUCTIVE:
--   * only ADD COLUMN IF NOT EXISTS + guarded CHECK constraints
--   * no drops, no type changes, no data writes, JSON columns untouched
--   * RLS: profiles already has "profiles_update_own" (user_id = auth.uid())
--     for USING + WITH CHECK, so the new columns are writable only by the
--     owner with no policy change.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_position numeric NOT NULL DEFAULT 50;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS headline text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pronouns text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_visibility text NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_cover_position_range') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_cover_position_range
      CHECK (cover_position >= 0 AND cover_position <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_photo_visibility_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_photo_visibility_check
      CHECK (photo_visibility IN ('public', 'private', 'connections_only'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_headline_len') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_headline_len
      CHECK (headline IS NULL OR char_length(headline) <= 300);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pronouns_len') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_pronouns_len
      CHECK (pronouns IS NULL OR char_length(pronouns) <= 40);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.cover_position IS 'Cover image object-position Y as a 0-100 percentage (default 50 = centre).';
COMMENT ON COLUMN public.profiles.headline IS 'LinkedIn-style headline; UI falls back to profession when null.';
COMMENT ON COLUMN public.profiles.pronouns IS 'Free-text pronouns shown next to the name.';
COMMENT ON COLUMN public.profiles.photo_visibility IS 'public | connections_only | private — who may see the profile photo.';
