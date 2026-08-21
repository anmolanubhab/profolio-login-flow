-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720192822 "create_threaded_comments_system" (no
-- matching file in supabase/migrations/). public.comments already existed
-- pre-baseline (posted_as/acted_as company-comment support came earlier);
-- this migration is inferred to have added one-level-deep threading
-- (parent_comment_id) plus depth enforcement and reply notifications,
-- based on the live column/constraint/trigger/function definitions below.
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON public.comments (parent_comment_id);

CREATE OR REPLACE FUNCTION public.enforce_comment_reply_depth()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  parent_comment public.comments%ROWTYPE;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO parent_comment FROM public.comments WHERE id = NEW.parent_comment_id;

  IF parent_comment.id IS NULL THEN
    RAISE EXCEPTION 'Parent comment does not exist';
  END IF;

  IF parent_comment.parent_comment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot reply to a reply -- comments are only threaded one level deep';
  END IF;

  IF parent_comment.post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'A reply must belong to the same post as its parent comment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_comment_reply_depth_trigger ON public.comments;
CREATE TRIGGER enforce_comment_reply_depth_trigger
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_reply_depth();

CREATE OR REPLACE FUNCTION public.notify_comment_reply()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  parent_author_id UUID;
  replier_profile public.profiles%ROWTYPE;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO parent_author_id FROM public.comments WHERE id = NEW.parent_comment_id;

  IF parent_author_id IS NULL OR parent_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO replier_profile FROM public.profiles WHERE id = NEW.user_id;
  IF replier_profile.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    parent_author_id,
    'comment_reply',
    jsonb_build_object(
      'sender_name', COALESCE(replier_profile.display_name, replier_profile.full_name, 'Someone'),
      'sender_avatar', replier_profile.avatar_url,
      'post_id', NEW.post_id,
      'comment_id', NEW.parent_comment_id,
      'message', LEFT(NEW.content, 100)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_reply ON public.comments;
CREATE TRIGGER on_comment_reply
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_reply();

-- notify_post_comment() already existed for top-level comments but is
-- recreated here to confirm it skips replies (parent_comment_id IS NOT NULL)
-- so a reply doesn't double-notify the post author via both triggers.
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  post_author_profile_id UUID;
  commenter_profile public.profiles%ROWTYPE;
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.id INTO post_author_profile_id
  FROM public.profiles p
  JOIN public.posts po ON po.user_id = p.user_id
  WHERE po.id = NEW.post_id;

  IF post_author_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF post_author_profile_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO commenter_profile FROM public.profiles WHERE id = NEW.user_id;
  IF commenter_profile.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    post_author_profile_id,
    'comment',
    jsonb_build_object(
      'sender_name', COALESCE(commenter_profile.display_name, commenter_profile.full_name, 'Someone'),
      'sender_avatar', commenter_profile.avatar_url,
      'post_id', NEW.post_id,
      'message', LEFT(NEW.content, 100)
    )
  );

  RETURN NEW;
END;
$$;
