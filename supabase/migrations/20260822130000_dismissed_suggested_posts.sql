-- Suggested-post "X" dismissal (Feed.tsx "Suggested" cards -- a post from an
-- author/company the viewer doesn't yet follow). Dismissing must not touch
-- follow state, hide the author's other posts, or affect the post for any
-- other user -- it's purely "don't show me this specific suggested item
-- again", scoped to (user, post) like the existing hidden_posts/saved_posts
-- tables it mirrors.
CREATE TABLE public.dismissed_suggested_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.dismissed_suggested_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own dismissed suggestions" ON public.dismissed_suggested_posts
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = dismissed_suggested_posts.user_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = dismissed_suggested_posts.user_id AND p.user_id = auth.uid())
);
