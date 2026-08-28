-- LinkedIn-style comment enhancements:
--   1. comments.is_edited: set true by a BEFORE UPDATE trigger whenever the
--      comment body actually changes, so the UI can show an "(edited)" tag.
--   2. comment_reactions: per-user reactions on a comment, reusing the same
--      6-value public.reaction_type enum and one-row-per-(user,comment) shape
--      as public.post_reactions.
--   3. notify_comment_reaction(): SECURITY DEFINER trigger that notifies the
--      comment author (never themselves) when someone reacts to their comment,
--      mirroring notify_post_reaction / notify_post_comment.
-- Existing comment rows, the reply-depth / reply-notification triggers and
-- all existing comments RLS policies are left untouched.

-- 1. is_edited ----------------------------------------------------------------
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.mark_comment_edited()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.is_edited := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_comment_edited_trigger ON public.comments;
CREATE TRIGGER mark_comment_edited_trigger
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.mark_comment_edited();

-- Lenient length guard: NOT VALID so pre-existing rows are not re-scanned;
-- only new inserts / updated content must satisfy it.
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_content_len;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_content_len
  CHECK (char_length(content) BETWEEN 1 AND 3000) NOT VALID;

-- 2. comment_reactions ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type public.reaction_type NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comment_reactions_user_comment_unique UNIQUE (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON public.comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON public.comment_reactions(user_id);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- Reactions are public information, consistent with post_reactions / comments.
CREATE POLICY "comment_reactions_view_public"
  ON public.comment_reactions FOR SELECT USING (true);

-- A user may create ONLY their own reaction; anonymous (current_profile_id()
-- IS NULL) fails the equality. Rate-limited like other write-heavy actions.
CREATE POLICY "comment_reactions_insert_own"
  ON public.comment_reactions FOR INSERT
  WITH CHECK (
    user_id = public.current_profile_id()
    AND public.check_and_record_rate_limit('comment_reaction', 60, 60)
  );

CREATE POLICY "comment_reactions_update_own"
  ON public.comment_reactions FOR UPDATE
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

CREATE POLICY "comment_reactions_delete_own"
  ON public.comment_reactions FOR DELETE
  USING (user_id = public.current_profile_id());

DROP TRIGGER IF EXISTS update_comment_reactions_updated_at ON public.comment_reactions;
CREATE TRIGGER update_comment_reactions_updated_at
  BEFORE UPDATE ON public.comment_reactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. reaction notification ------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_comment_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  comment_row public.comments%ROWTYPE;
  reactor_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO comment_row FROM public.comments WHERE id = NEW.comment_id;
  IF comment_row.id IS NULL OR comment_row.user_id = NEW.user_id THEN
    RETURN NEW;  -- comment gone, or reacting to your own comment
  END IF;

  SELECT * INTO reactor_profile FROM public.profiles WHERE id = NEW.user_id;
  IF reactor_profile.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    comment_row.user_id,
    'comment_reaction',
    jsonb_build_object(
      'sender_name', COALESCE(reactor_profile.display_name, reactor_profile.full_name, 'Someone'),
      'sender_avatar', reactor_profile.avatar_url,
      'post_id', comment_row.post_id,
      'comment_id', comment_row.id,
      'reaction_type', NEW.reaction_type
    )
  );
  RETURN NEW;
END;
$$;

-- Only on INSERT: switching an existing reaction type (UPDATE) must not
-- re-notify, and a duplicate insert fails the UNIQUE constraint before this.
DROP TRIGGER IF EXISTS on_comment_reaction ON public.comment_reactions;
CREATE TRIGGER on_comment_reaction
  AFTER INSERT ON public.comment_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_reaction();
