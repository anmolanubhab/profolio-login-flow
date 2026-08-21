-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720175815 "fix_current_profile_id_recursion" (no
-- matching file in supabase/migrations/). Recreates the current live
-- definition of public.current_profile_id() verbatim (pg_get_functiondef).
-- It is STABLE + SECURITY DEFINER, which lets policies on public.profiles
-- call it without the function's own internal SELECT on profiles
-- re-triggering (and recursing into) profiles' own RLS policies.
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  result uuid;
BEGIN
  SELECT id INTO result FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  RETURN result;
END;
$$;
