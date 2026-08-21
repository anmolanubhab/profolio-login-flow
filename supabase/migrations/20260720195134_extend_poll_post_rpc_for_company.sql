-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720195134 "extend_poll_post_rpc_for_company" (no
-- matching file in supabase/migrations/). Adds a second, company-aware
-- overload of create_poll_post (confirmed live via pg_get_functiondef --
-- both the 2-arg and 5-arg signatures exist simultaneously as distinct
-- overloaded functions), letting a company admin post a poll "as" their
-- company (mirrors the posted_as='company' pattern used elsewhere on
-- public.posts).
CREATE OR REPLACE FUNCTION public.create_poll_post(
  p_content text,
  p_options text[],
  p_company_id uuid DEFAULT NULL,
  p_company_name text DEFAULT NULL,
  p_company_logo text DEFAULT NULL
)
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

  IF p_company_id IS NOT NULL THEN
    INSERT INTO public.posts (content, user_id, post_type, posted_as, company_id, company_name, company_logo)
    VALUES (p_content, auth.uid(), 'poll', 'company', p_company_id, p_company_name, p_company_logo)
    RETURNING id INTO new_post_id;
  ELSE
    INSERT INTO public.posts (content, user_id, post_type)
    VALUES (p_content, auth.uid(), 'poll')
    RETURNING id INTO new_post_id;
  END IF;

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
