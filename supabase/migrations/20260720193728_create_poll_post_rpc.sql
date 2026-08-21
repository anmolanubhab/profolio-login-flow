-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720193728 "create_poll_post_rpc" (no matching
-- file in supabase/migrations/). Reconstructed from information_schema
-- columns, pg_constraint, pg_indexes, pg_policies and
-- pg_get_functiondef for the live polls/poll_options/poll_votes tables
-- and the two-argument create_poll_post(text, text[]) RPC (the
-- company-aware five-argument overload is added by the follow-up
-- migration 20260720195134_extend_poll_post_rpc_for_company.sql).
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES public.posts(id) ON DELETE CASCADE,
  question text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  "position" integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options (poll_id);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes (poll_id);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS polls_view_public ON public.polls;
CREATE POLICY polls_view_public ON public.polls FOR SELECT USING (true);
DROP POLICY IF EXISTS polls_insert_own ON public.polls;
CREATE POLICY polls_insert_own ON public.polls
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.posts po WHERE po.id = polls.post_id AND po.user_id = auth.uid()));

DROP POLICY IF EXISTS poll_options_view_public ON public.poll_options;
CREATE POLICY poll_options_view_public ON public.poll_options FOR SELECT USING (true);
DROP POLICY IF EXISTS poll_options_insert_own ON public.poll_options;
CREATE POLICY poll_options_insert_own ON public.poll_options
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.polls p JOIN public.posts po ON po.id = p.post_id WHERE p.id = poll_options.poll_id AND po.user_id = auth.uid()));

DROP POLICY IF EXISTS poll_votes_view_public ON public.poll_votes;
CREATE POLICY poll_votes_view_public ON public.poll_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS poll_votes_insert_own ON public.poll_votes;
CREATE POLICY poll_votes_insert_own ON public.poll_votes
  FOR INSERT WITH CHECK (user_id = current_profile_id());

CREATE OR REPLACE FUNCTION public.create_poll_post(p_content text, p_options text[])
RETURNS uuid
LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE
  new_post_id UUID;
  new_poll_id UUID;
  opt TEXT;
  opt_position INT := 0;
BEGIN
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Poll question cannot be empty';
  END IF;

  IF array_length(p_options, 1) IS NULL OR array_length(p_options, 1) < 2 THEN
    RAISE EXCEPTION 'A poll needs at least 2 options';
  END IF;

  IF array_length(p_options, 1) > 6 THEN
    RAISE EXCEPTION 'A poll can have at most 6 options';
  END IF;

  INSERT INTO public.posts (content, user_id, post_type)
  VALUES (p_content, auth.uid(), 'poll')
  RETURNING id INTO new_post_id;

  INSERT INTO public.polls (post_id, question)
  VALUES (new_post_id, p_content)
  RETURNING id INTO new_poll_id;

  FOREACH opt IN ARRAY p_options LOOP
    INSERT INTO public.poll_options (poll_id, option_text, position)
    VALUES (new_poll_id, opt, opt_position);
    opt_position := opt_position + 1;
  END LOOP;

  RETURN new_post_id;
END;
$$;
