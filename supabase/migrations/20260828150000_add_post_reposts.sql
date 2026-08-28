-- Repost system: relational reposts of feed posts (LinkedIn-style).
-- One user may repost a given post at most once; optional commentary supports
-- "Repost with your thoughts". The original post stays the canonical source.

CREATE TABLE IF NOT EXISTS public.post_reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commentary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_reposts_user_post_unique UNIQUE (user_id, post_id),
  CONSTRAINT post_reposts_commentary_len CHECK (commentary IS NULL OR char_length(commentary) <= 3000)
);

CREATE INDEX IF NOT EXISTS idx_post_reposts_post ON public.post_reposts(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reposts_user ON public.post_reposts(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reposts_created_at ON public.post_reposts(created_at DESC);

ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;

-- Reposts are public information, consistent with posts / post_likes / comments.
CREATE POLICY "post_reposts_view_public"
ON public.post_reposts FOR SELECT
USING (true);

-- Authenticated users may create ONLY their own repost; rate-limited like comments.
-- auth.uid() IS NULL (anonymous) fails both the EXISTS and the rate-limit check.
CREATE POLICY "post_reposts_create_own"
ON public.post_reposts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.id = post_reposts.user_id
  )
  AND public.check_and_record_rate_limit('repost_create', 30, 60)
);

-- Users may edit commentary on only their own repost.
CREATE POLICY "post_reposts_update_own"
ON public.post_reposts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.id = post_reposts.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.id = post_reposts.user_id
  )
);

-- Users may remove only their own repost.
CREATE POLICY "post_reposts_delete_own"
ON public.post_reposts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.id = post_reposts.user_id
  )
);

DROP TRIGGER IF EXISTS update_post_reposts_updated_at ON public.post_reposts;
CREATE TRIGGER update_post_reposts_updated_at
  BEFORE UPDATE ON public.post_reposts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify the original post author when another user reposts their post.
-- SECURITY DEFINER mirrors notify_post_like / notify_post_comment so it can
-- write to notifications (whose INSERT RLS forbids arbitrary client inserts).
CREATE OR REPLACE FUNCTION public.notify_post_repost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  post_author_profile_id uuid;
  reposter_profile public.profiles%ROWTYPE;
BEGIN
  SELECT p.id INTO post_author_profile_id
  FROM public.profiles p
  JOIN public.posts po ON po.user_id = p.user_id
  WHERE po.id = NEW.post_id;

  IF post_author_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- never notify a user for reposting their own post
  IF post_author_profile_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO reposter_profile
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF reposter_profile.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    post_author_profile_id,
    'repost',
    jsonb_build_object(
      'sender_name', COALESCE(reposter_profile.display_name, reposter_profile.full_name, 'Someone'),
      'sender_avatar', reposter_profile.avatar_url,
      'post_id', NEW.post_id,
      'message', LEFT(COALESCE(NEW.commentary, ''), 100)
    )
  );

  RETURN NEW;
END;
$function$;

-- A duplicate repost attempt fails on post_reposts_user_post_unique before this
-- fires, so no duplicate notification is produced.
DROP TRIGGER IF EXISTS on_post_repost ON public.post_reposts;
CREATE TRIGGER on_post_repost
  AFTER INSERT ON public.post_reposts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_repost();
