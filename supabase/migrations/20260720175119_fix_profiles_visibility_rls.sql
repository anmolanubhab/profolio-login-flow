-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720175119 "fix_profiles_visibility_rls" which has
-- no matching file in supabase/migrations/. Recreates the current live
-- SELECT policy on public.profiles verbatim (pg_policies.qual), which
-- respects profile_visibility ('public' / null / 'connections_only') and
-- always allows a user to see their own row. The pre-fix policy is not
-- recoverable; only the resulting (fixed) definition is reproduced here.
DROP POLICY IF EXISTS profiles_select_respecting_visibility ON public.profiles;
CREATE POLICY profiles_select_respecting_visibility ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid())
    OR (profile_visibility = 'public'::text)
    OR (profile_visibility IS NULL)
    OR (
      profile_visibility = 'connections_only'::text
      AND EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.status = 'accepted'::connection_status
          AND (
            (c.user_id = profiles.id AND c.connection_id = current_profile_id())
            OR (c.connection_id = profiles.id AND c.user_id = current_profile_id())
          )
      )
    )
  );
