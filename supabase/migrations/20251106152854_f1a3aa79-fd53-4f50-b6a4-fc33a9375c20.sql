-- Create saved_posts table
CREATE TABLE public.saved_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Create hidden_posts table
CREATE TABLE public.hidden_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Create blocked_users table
CREATE TABLE public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, blocked_user_id)
);

-- Create snoozed_users table
CREATE TABLE public.snoozed_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snoozed_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snoozed_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, snoozed_user_id)
);

-- Create post_notifications table
CREATE TABLE public.post_notifications_enabled (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Create post_reports table
CREATE TABLE public.post_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_feed_preferences table
CREATE TABLE public.user_feed_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interested_posts UUID[] DEFAULT ARRAY[]::UUID[],
  not_interested_posts UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hidden_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snoozed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_notifications_enabled ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feed_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_posts
CREATE POLICY "Users can manage their own saved posts" ON public.saved_posts
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = saved_posts.user_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = saved_posts.user_id AND p.user_id = auth.uid())
);

-- RLS Policies for hidden_posts
CREATE POLICY "Users can manage their own hidden posts" ON public.hidden_posts
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = hidden_posts.user_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = hidden_posts.user_id AND p.user_id = auth.uid())
);

-- RLS Policies for blocked_users
CREATE POLICY "Users can manage their own blocked users" ON public.blocked_users
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = blocked_users.user_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = blocked_users.user_id AND p.user_id = auth.uid())
);

-- RLS Policies for snoozed_users
CREATE POLICY "Users can manage their own snoozed users" ON public.snoozed_users
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = snoozed_users.user_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = snoozed_users.user_id AND p.user_id = auth.uid())
);

-- RLS Policies for post_notifications_enabled
CREATE POLICY "Users can manage their own post notifications" ON public.post_notifications_enabled
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = post_notifications_enabled.user_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = post_notifications_enabled.user_id AND p.user_id = auth.uid())
);

-- RLS Policies for post_reports
CREATE POLICY "Users can create reports" ON public.post_reports
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = post_reports.reporter_id AND p.user_id = auth.uid())
);

CREATE POLICY "Users can view their own reports" ON public.post_reports
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = post_reports.reporter_id AND p.user_id = auth.uid())
);

-- RLS Policies for user_feed_preferences
CREATE POLICY "Users can manage their own feed preferences" ON public.user_feed_preferences
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_feed_preferences.user_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_feed_preferences.user_id AND p.user_id = auth.uid())
);

-- Create trigger for updating user_feed_preferences updated_at
CREATE OR REPLACE FUNCTION public.update_user_feed_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_feed_preferences_updated_at
BEFORE UPDATE ON public.user_feed_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_user_feed_preferences_updated_at();