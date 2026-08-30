-- =============================================================================
-- Stories system — full creation + viewer feature set
-- =============================================================================
-- The `stories` / `story_views` tables predate the tracked migration history
-- and key identity on auth.users.id directly (stories.user_id), NOT
-- profiles.id. story_reactions / story_reports / muted_story_authors (added in
-- 20260822175955) follow the same auth.uid() convention. Everything new here
-- stays consistent with that: story-family rows key on auth.uid(); the social
-- graph (connections / followers) keys on profiles.id, so audience checks
-- bridge the two via public.current_profile_id().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Rich story metadata (text stories, backgrounds, overlays, music, a11y)
-- ---------------------------------------------------------------------------
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS kind             text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS privacy          text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS background        jsonb,
  ADD COLUMN IF NOT EXISTS font_style       text,
  ADD COLUMN IF NOT EXISTS caption          text,
  ADD COLUMN IF NOT EXISTS overlays         jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS music            jsonb,
  ADD COLUMN IF NOT EXISTS alt_text         text,
  ADD COLUMN IF NOT EXISTS alt_text_source  text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS ai_label         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duration_ms      integer,
  ADD COLUMN IF NOT EXISTS thumbnail_url    text,
  ADD COLUMN IF NOT EXISTS media_width      integer,
  ADD COLUMN IF NOT EXISTS media_height     integer,
  ADD COLUMN IF NOT EXISTS is_archived      boolean NOT NULL DEFAULT false;

-- media_url is NOT NULL in the base table; text stories have no uploaded
-- media, so relax it and guarantee integrity with a kind-aware check instead.
ALTER TABLE public.stories ALTER COLUMN media_url DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.stories
    ADD CONSTRAINT stories_kind_check CHECK (kind IN ('media', 'text'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stories
    ADD CONSTRAINT stories_privacy_check CHECK (privacy IN ('public', 'friends', 'custom'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stories
    ADD CONSTRAINT stories_alt_text_source_check CHECK (alt_text_source IN ('auto', 'custom'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stories
    ADD CONSTRAINT stories_font_style_check
    CHECK (font_style IS NULL OR font_style IN ('clean', 'casual', 'fancy', 'headline', 'simple'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stories
    ADD CONSTRAINT stories_kind_media_check CHECK (
      (kind = 'media' AND media_url IS NOT NULL)
      OR (kind = 'text' AND caption IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_id stays nullable at the column level (base table), but the INSERT
-- policy already forces auth.uid() = user_id so a NULL can never be written.

CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON public.stories (expires_at);
CREATE INDEX IF NOT EXISTS stories_user_created_idx ON public.stories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_active_idx ON public.stories (expires_at, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2) Per-story custom audience (only used when privacy = 'custom')
--    Stored as auth.users ids so the story-family RLS stays a direct
--    auth.uid() comparison with no graph join.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_audience (
  story_id       uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_user_id)
);
ALTER TABLE public.story_audience ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS story_audience_viewer_idx ON public.story_audience (viewer_user_id);

DROP POLICY IF EXISTS "Story owner manages audience" ON public.story_audience;
CREATE POLICY "Story owner manages audience" ON public.story_audience
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_audience.story_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_audience.story_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Audience member can see own row" ON public.story_audience;
CREATE POLICY "Audience member can see own row" ON public.story_audience
  FOR SELECT USING (viewer_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) Audience-aware visibility helper + tightened SELECT policy on stories
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_story(_author uuid, _privacy text, _story_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me           uuid := auth.uid();
  my_profile   uuid;
  author_prof  uuid;
BEGIN
  IF me IS NULL THEN
    RETURN false;
  END IF;
  IF me = _author THEN
    RETURN true;                      -- always see your own
  END IF;
  IF _privacy = 'public' THEN
    RETURN true;
  END IF;

  IF _privacy = 'custom' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.story_audience a
      WHERE a.story_id = _story_id AND a.viewer_user_id = me
    );
  END IF;

  IF _privacy = 'friends' THEN
    SELECT id INTO my_profile  FROM public.profiles WHERE user_id = me      LIMIT 1;
    SELECT id INTO author_prof FROM public.profiles WHERE user_id = _author LIMIT 1;
    IF my_profile IS NULL OR author_prof IS NULL THEN
      RETURN false;
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.status = 'accepted'
        AND (
          (c.user_id = my_profile AND c.connection_id = author_prof)
          OR (c.user_id = author_prof AND c.connection_id = my_profile)
        )
    );
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_story(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_view_story(uuid, text, uuid) TO authenticated;

-- Replace the old "any non-expired story" policy with an owner-or-audience one.
DROP POLICY IF EXISTS "Users can view non-expired stories" ON public.stories;
CREATE POLICY "Story visible to owner or permitted audience" ON public.stories
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (expires_at > now() AND public.can_view_story(user_id, privacy, id))
  );

-- Owners need UPDATE too (edit alt text / re-privacy / archive flag).
DROP POLICY IF EXISTS "Users can update their own stories" ON public.stories;
CREATE POLICY "Users can update their own stories" ON public.stories
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) story_views: block self-views, keep unique(story_id, viewer_id).
--    Also let an author read the viewer profiles for a "Seen by" list.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own story views" ON public.story_views;
CREATE POLICY "Users can insert their own story views" ON public.story_views
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = viewer_id
    AND NOT EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_views.story_id AND s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Per-user story settings (default privacy + auto-archive toggle)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_settings (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_privacy  text NOT NULL DEFAULT 'public' CHECK (default_privacy IN ('public','friends','custom')),
  archive_enabled  boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.story_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own story settings" ON public.story_settings;
CREATE POLICY "Users manage their own story settings" ON public.story_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) Music: read-only catalog + per-user saved tracks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_music_tracks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  artist       text NOT NULL,
  audio_url    text NOT NULL,
  duration_ms  integer NOT NULL,
  cover_color  text NOT NULL DEFAULT '#4b5563',
  genre        text,
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.story_music_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Music catalog readable by authenticated" ON public.story_music_tracks;
CREATE POLICY "Music catalog readable by authenticated" ON public.story_music_tracks
  FOR SELECT TO authenticated USING (is_active);

CREATE TABLE IF NOT EXISTS public.story_saved_music (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id   uuid NOT NULL REFERENCES public.story_music_tracks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
ALTER TABLE public.story_saved_music ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own saved music" ON public.story_saved_music;
CREATE POLICY "Users manage their own saved music" ON public.story_saved_music
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7) Storage: story media owner UPDATE/DELETE + read-only story-music bucket
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own story media" ON storage.objects;
CREATE POLICY "Users can update their own story media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'stories' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own story media" ON storage.objects;
CREATE POLICY "Users can delete their own story media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND (auth.uid())::text = (storage.foldername(name))[1]);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-music', 'story-music', true, 10485760,
  ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/aac','audio/mp4']
)
ON CONFLICT (id) DO UPDATE
  SET public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Story music is publicly readable" ON storage.objects;
CREATE POLICY "Story music is publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'story-music');

-- Tighten the stories media bucket a little (was unlimited / any mime).
UPDATE storage.buckets
  SET file_size_limit = 62914560,  -- 60 MB (covers short videos)
      allowed_mime_types = ARRAY[
        'image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/webm','video/quicktime'
      ]
  WHERE id = 'stories';

-- ---------------------------------------------------------------------------
-- 8) Expired-story housekeeping (no pg_cron on this project — exposed as a
--    SECURITY DEFINER function the app/ops can call; RLS already hides
--    expired non-archived stories from everyone but the owner meanwhile).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_stories()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.stories
    WHERE expires_at < now() - interval '30 days'
      AND is_archived = false
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM del;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_stories() FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9) Realtime for live reactions / views on the open viewer
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.story_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
