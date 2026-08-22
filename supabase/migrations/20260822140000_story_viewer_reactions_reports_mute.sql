-- Dedicated Story Viewer support. `stories`/`story_views` already exist
-- (created outside the tracked migration history -- see live schema) and
-- both key identity as auth.users.id directly (stories.user_id, no
-- profiles.id column at all, no company_id -- stories are personal-only in
-- this schema). New tables here follow that SAME convention (auth.uid()),
-- not profiles.id, to stay consistent within this table family and avoid
-- yet another id-mixing bug.

-- 1) stories had no UPDATE/DELETE policy at all -- an owner could never
-- delete their own story via the API. Story Viewer's "Delete Story" needs
-- this.
CREATE POLICY "Users can delete their own stories" ON public.stories
FOR DELETE USING (auth.uid() = user_id);

-- 2) story_views' only SELECT policy scopes to `viewer_id = auth.uid()`,
-- so a story's author could never query who viewed it. Add a second
-- (additive/OR'd) SELECT policy letting the story owner read views of
-- their own stories, for an optional "seen by" count.
CREATE POLICY "Story owners can view their story's views" ON public.story_views
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.user_id = auth.uid())
);

-- 3) Quick reactions on a story (no story_reactions table existed).
CREATE TABLE public.story_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Story reactions are viewable by everyone" ON public.story_reactions
FOR SELECT USING (true);

CREATE POLICY "Users can manage their own story reactions" ON public.story_reactions
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) Report Story (mirrors post_reports).
CREATE TABLE public.story_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'misinformation', 'inappropriate', 'scam', 'other')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reporter_id, story_id)
);

ALTER TABLE public.story_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create story reports" ON public.story_reports
FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own story reports" ON public.story_reports
FOR SELECT USING (auth.uid() = reporter_id);

-- 5) Mute Story: stop seeing a specific author's stories, without
-- unfollowing/blocking them anywhere else in the app.
CREATE TABLE public.muted_story_authors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, muted_user_id)
);

ALTER TABLE public.muted_story_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own muted story authors" ON public.muted_story_authors
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6) Story replies reuse the existing messages/conversations system rather
-- than a parallel one -- just a nullable pointer back to the story so a
-- reply's origin is real, structured data instead of encoded into `content`.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL;
