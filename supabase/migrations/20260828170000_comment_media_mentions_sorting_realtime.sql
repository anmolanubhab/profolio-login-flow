-- Extends the existing comment system with: image attachments, @mention
-- notifications, a "Most relevant" ranking helper, and Realtime publication.
-- No table is duplicated; no existing policy is weakened.

-- 1. IMAGE ATTACHMENT --------------------------------------------------------
-- Reuses the existing PUBLIC 'post-images' storage bucket and its RLS
-- (auth.uid() = foldername(name)[1], 2-segment path) -- no new bucket, no new
-- storage policy. Only the URL is persisted on the comment row.
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS image_url text;

-- Permit an image-only comment (blank text) while keeping the 3000-char cap.
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_content_len;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_content_len
  CHECK (
    char_length(content) <= 3000
    AND (char_length(btrim(content)) >= 1 OR image_url IS NOT NULL)
  ) NOT VALID;

-- 2. "MOST RELEVANT" RANKING ----------------------------------------------
-- Deterministic score for top-level comments of a post:
--   relevance = 3*reaction_count + 2*reply_count - 0.15*age_hours
-- tie-break: newest first, then id. Pagination via limit/offset so the
-- browser never loads the whole thread to sort. security invoker => the
-- caller's RLS still applies (comments SELECT is public anyway).
CREATE INDEX IF NOT EXISTS idx_comments_post_toplevel_created
  ON public.comments (post_id, created_at DESC)
  WHERE parent_comment_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_ranked_post_comments(
  p_post_id uuid,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  post_id uuid,
  user_id uuid,
  content text,
  image_url text,
  created_at timestamptz,
  is_edited boolean,
  parent_comment_id uuid,
  reaction_count bigint,
  reply_count bigint,
  relevance double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    c.id, c.post_id, c.user_id, c.content, c.image_url, c.created_at,
    c.is_edited, c.parent_comment_id,
    COALESCE(rx.n, 0) AS reaction_count,
    COALESCE(rp.n, 0) AS reply_count,
    (COALESCE(rx.n, 0) * 3 + COALESCE(rp.n, 0) * 2)
      - 0.15 * (EXTRACT(epoch FROM (now() - c.created_at)) / 3600.0) AS relevance
  FROM public.comments c
  LEFT JOIN (
    SELECT comment_id, count(*)::bigint AS n
    FROM public.comment_reactions GROUP BY comment_id
  ) rx ON rx.comment_id = c.id
  LEFT JOIN (
    SELECT parent_comment_id, count(*)::bigint AS n
    FROM public.comments
    WHERE parent_comment_id IS NOT NULL
    GROUP BY parent_comment_id
  ) rp ON rp.parent_comment_id = c.id
  WHERE c.post_id = p_post_id AND c.parent_comment_id IS NULL
  ORDER BY relevance DESC, c.created_at DESC, c.id DESC
  LIMIT greatest(COALESCE(p_limit, 10), 0)
  OFFSET greatest(COALESCE(p_offset, 0), 0);
$$;

-- 3. @MENTION NOTIFICATIONS ---------------------------------------------
-- Mentions live inside comment.content as the token
--     @[Display Name](<profile-uuid>)
-- The uuid identifies the user regardless of later name changes. This
-- SECURITY DEFINER trigger (client cannot INSERT arbitrary notification
-- types) fires 'comment_mention' for each newly-mentioned profile, skipping
-- the author and -- on edit -- anyone already mentioned in the old text.
CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  author_prof  public.profiles%ROWTYPE;
  already      uuid[] := '{}';
  m            text[];
  mentioned_id uuid;
BEGIN
  SELECT * INTO author_prof FROM public.profiles WHERE id = NEW.user_id;
  IF author_prof.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR m IN
      SELECT regexp_matches(COALESCE(OLD.content, ''),
        '@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)', 'g')
    LOOP
      already := already || (m[1])::uuid;
    END LOOP;
  END IF;

  FOR m IN
    SELECT regexp_matches(COALESCE(NEW.content, ''),
      '@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)', 'g')
  LOOP
    mentioned_id := (m[1])::uuid;
    CONTINUE WHEN mentioned_id = NEW.user_id;
    CONTINUE WHEN mentioned_id = ANY(already);
    already := already || mentioned_id;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = mentioned_id) THEN
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (
        mentioned_id,
        'comment_mention',
        jsonb_build_object(
          'sender_name', COALESCE(author_prof.display_name, author_prof.full_name, 'Someone'),
          'sender_avatar', author_prof.avatar_url,
          'post_id', NEW.post_id,
          'comment_id', NEW.id,
          'message', left(regexp_replace(NEW.content,
            '@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)', '@\1', 'g'), 100)
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_mention ON public.comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT OR UPDATE OF content ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_mentions();

-- 4. REALTIME ------------------------------------------------------------
-- The feed still only reads comment COUNTS; realtime is subscribed lazily,
-- client-side, filtered by post_id, and only while a comment section is open.
-- REPLICA IDENTITY FULL so UPDATE/DELETE payloads carry post_id /
-- parent_comment_id / comment_id for client-side routing.
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.comment_reactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
