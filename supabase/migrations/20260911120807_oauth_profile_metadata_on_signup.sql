-- Extend the new-user profile trigger to capture the display name and avatar
-- that Google/Microsoft OAuth sign-in populates on auth.users.raw_user_meta_data,
-- so OAuth-created profiles aren't stuck with the email-prefix fallback.
--
-- This only changes what happens on the INITIAL INSERT into auth.users (i.e.
-- account creation). It does not touch existing profiles, and it never runs
-- again on subsequent logins -- so a user's manually-edited display name or
-- avatar is never overwritten by later Google/Microsoft sign-ins.
--
-- Matches the search_path fix from 20260720175411_fix_function_search_path.sql
-- (SET search_path TO 'public'), just with the added metadata coalescing.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture'
    )
  );
  RETURN NEW;
END;
$$;
