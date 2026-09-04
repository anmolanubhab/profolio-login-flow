-- Supabase default privileges auto-grant EXECUTE to `anon` on new functions;
-- `REVOKE ... FROM public` does not remove that explicit grant. There is no
-- logged-out profile view in the app, so none of these accessors should be
-- callable by `anon`.
revoke execute on function public.get_public_profile(uuid) from anon;
revoke execute on function public.get_my_settings() from anon;
revoke execute on function public.search_mentionable_people(text) from anon;
