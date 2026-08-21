-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720191134 "create_post_reactions_system" (no
-- matching file in supabase/migrations/). Reconstructed from
-- information_schema.columns, pg_constraint, pg_indexes, pg_policies and
-- pg_get_functiondef/pg_get_triggerdef for the live public.post_reactions
-- table and its supporting trigger/function.
DO $$ BEGIN
  CREATE TYPE public.reaction_type AS ENUM ('like','celebrate','support','love','insightful','funny');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type public.reaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON public.post_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON public.post_reactions (user_id);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_reactions_view_public ON public.post_reactions;
CREATE POLICY post_reactions_view_public ON public.post_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS post_reactions_insert_own ON public.post_reactions;
CREATE POLICY post_reactions_insert_own ON public.post_reactions
  FOR INSERT WITH CHECK (user_id = current_profile_id());

DROP POLICY IF EXISTS post_reactions_update_own ON public.post_reactions;
CREATE POLICY post_reactions_update_own ON public.post_reactions
  FOR UPDATE USING (user_id = current_profile_id()) WITH CHECK (user_id = current_profile_id());

DROP POLICY IF EXISTS post_reactions_delete_own ON public.post_reactions;
CREATE POLICY post_reactions_delete_own ON public.post_reactions
  FOR DELETE USING (user_id = current_profile_id());

DROP TRIGGER IF EXISTS update_post_reactions_updated_at ON public.post_reactions;
CREATE TRIGGER update_post_reactions_updated_at
  BEFORE UPDATE ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bundled notification: groups repeated reactions from different users on
-- the same post within a 24h unread window into a single notification row
-- (reactor_ids/reactor_count in payload), instead of spamming one row per
-- reaction.
CREATE OR REPLACE FUNCTION public.notify_post_reaction()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  post_author_profile_id UUID;
  reactor_profile profiles%ROWTYPE;
  existing_notification notifications%ROWTYPE;
  reactor_ids JSONB;
  new_count INT;
BEGIN
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

  SELECT * INTO reactor_profile FROM public.profiles WHERE id = NEW.user_id;
  IF reactor_profile.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO existing_notification
  FROM public.notifications
  WHERE user_id = post_author_profile_id
    AND type = 'post_reaction'
    AND is_read = false
    AND (payload->>'post_id') = NEW.post_id::text
    AND created_at > now() - interval '24 hours'
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_notification.id IS NULL THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      post_author_profile_id,
      'post_reaction',
      jsonb_build_object(
        'post_id', NEW.post_id,
        'reactor_ids', jsonb_build_array(NEW.user_id::text),
        'reactor_count', 1,
        'latest_reaction_type', NEW.reaction_type,
        'sender_name', COALESCE(reactor_profile.display_name, reactor_profile.full_name, 'Someone'),
        'sender_avatar', reactor_profile.avatar_url
      )
    );
  ELSE
    reactor_ids := COALESCE(existing_notification.payload->'reactor_ids', '[]'::jsonb);

    IF reactor_ids @> jsonb_build_array(NEW.user_id::text) THEN
      UPDATE public.notifications
      SET payload = payload
                    || jsonb_build_object('latest_reaction_type', NEW.reaction_type)
                    || jsonb_build_object('sender_name', COALESCE(reactor_profile.display_name, reactor_profile.full_name, 'Someone'))
                    || jsonb_build_object('sender_avatar', reactor_profile.avatar_url),
          created_at = now()
      WHERE id = existing_notification.id;
    ELSE
      new_count := COALESCE((existing_notification.payload->>'reactor_count')::int, 1) + 1;
      UPDATE public.notifications
      SET payload = payload
                    || jsonb_build_object('reactor_ids', reactor_ids || jsonb_build_array(NEW.user_id::text))
                    || jsonb_build_object('reactor_count', new_count)
                    || jsonb_build_object('latest_reaction_type', NEW.reaction_type)
                    || jsonb_build_object('sender_name', COALESCE(reactor_profile.display_name, reactor_profile.full_name, 'Someone'))
                    || jsonb_build_object('sender_avatar', reactor_profile.avatar_url),
          is_read = false,
          created_at = now()
      WHERE id = existing_notification.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_reaction ON public.post_reactions;
CREATE TRIGGER on_post_reaction
  AFTER INSERT OR UPDATE ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_reaction();
