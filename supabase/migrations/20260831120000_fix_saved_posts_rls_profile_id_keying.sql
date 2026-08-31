-- saved_posts.user_id references profiles.id (NOT auth.users.id). At some point
-- the live policy drifted to "auth.uid() = user_id" (the saved_jobs form, which
-- is correct there because saved_jobs.user_id references auth.users). On
-- saved_posts that predicate can never be true, so it was silently denying
-- every save / unsave / select for every user (PostgREST 403, PG 42501).
--
-- Restore the profiles-resolved form from the original migration
-- (20251106152854) -- identical to every sibling table that is also keyed on
-- profiles.id: hidden_posts, post_notifications_enabled,
-- dismissed_suggested_posts. No table, column, or index changes.

DROP POLICY IF EXISTS "Users manage their own saved posts" ON public.saved_posts;
DROP POLICY IF EXISTS "Users can manage their own saved posts" ON public.saved_posts;

CREATE POLICY "Users can manage their own saved posts" ON public.saved_posts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = saved_posts.user_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = saved_posts.user_id AND p.user_id = auth.uid()
  )
);
