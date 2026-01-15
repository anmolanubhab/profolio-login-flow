-- Add privacy settings to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'connections_only'));

-- Create profile_views table to track who viewed whose profile
CREATE TABLE IF NOT EXISTS public.profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL,
  viewed_profile_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_profile_view UNIQUE(viewer_id, viewed_profile_id)
);

-- Enable RLS on profile_views
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- RLS policies for profile_views
CREATE POLICY "Users can view their own profile views"
ON public.profile_views
FOR SELECT
USING (viewed_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert profile views"
ON public.profile_views
FOR INSERT
WITH CHECK (viewer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Update profiles RLS to handle visibility
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view public profiles"
ON public.profiles
FOR SELECT
USING (
  profile_visibility = 'public' OR
  user_id = auth.uid() OR
  (profile_visibility = 'connections_only' AND EXISTS (
    SELECT 1 FROM connections 
    WHERE status = 'accepted' 
    AND ((user_id = profiles.id AND connection_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
      OR (connection_id = profiles.id AND user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
  ))
);