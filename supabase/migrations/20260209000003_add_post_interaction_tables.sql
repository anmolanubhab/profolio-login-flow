-- Create saved_posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.saved_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, post_id)
);

-- Create post_reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.post_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create post_notifications_enabled table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.post_notifications_enabled (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, post_id)
);

-- Create user_feed_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_feed_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    interested_posts UUID[] DEFAULT '{}',
    not_interested_posts UUID[] DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create snoozed_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.snoozed_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    snoozed_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    snoozed_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, snoozed_user_id)
);

-- Enable RLS on new tables
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_notifications_enabled ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feed_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snoozed_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- saved_posts
CREATE POLICY "Users can view their own saved posts" ON public.saved_posts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved posts" ON public.saved_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved posts" ON public.saved_posts
    FOR DELETE USING (auth.uid() = user_id);

-- post_reports
CREATE POLICY "Users can insert reports" ON public.post_reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- post_notifications_enabled
CREATE POLICY "Users can manage their post notifications" ON public.post_notifications_enabled
    FOR ALL USING (auth.uid() = user_id);

-- user_feed_preferences
CREATE POLICY "Users can manage their feed preferences" ON public.user_feed_preferences
    FOR ALL USING (auth.uid() = user_id);

-- snoozed_users
CREATE POLICY "Users can manage their snoozed users" ON public.snoozed_users
    FOR ALL USING (auth.uid() = user_id);
