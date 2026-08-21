-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720175129 "fix_notifications_insert_spoofing"
-- (no matching file in supabase/migrations/). Recreates the current live
-- INSERT policy on public.notifications verbatim (pg_policies.with_check).
-- Before this fix the INSERT policy presumably allowed a client to insert
-- a notification for an arbitrary user_id/type (spoofing); the fixed
-- version restricts client-side inserts to a narrow allow-list of types
-- and requires the payload to reference the authenticated actor's own
-- profile id as viewer/sender/follower. All other notification types are
-- inserted server-side via SECURITY DEFINER triggers, which bypass RLS.
DROP POLICY IF EXISTS notifications_insert_verified_actor ON public.notifications;
CREATE POLICY notifications_insert_verified_actor ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    type = ANY (ARRAY['profile_view'::text, 'friend_request'::text, 'new_follower'::text])
    AND user_id <> current_profile_id()
    AND (
      current_profile_id() = (NULLIF(payload ->> 'viewer_id', ''))::uuid
      OR current_profile_id() = (NULLIF(payload ->> 'sender_id', ''))::uuid
      OR current_profile_id() = (NULLIF(payload ->> 'follower_id', ''))::uuid
    )
  );
