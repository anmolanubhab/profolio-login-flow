-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260820200149 "fix_groups_insert_owner_spoofing" (no
-- matching file in supabase/migrations/). Recreates the current live
-- INSERT policy on public.groups verbatim (pg_policies), which requires
-- owner_user_id to equal the authenticated caller -- preventing a client
-- from creating a group "owned" by an arbitrary other user_id.
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);
