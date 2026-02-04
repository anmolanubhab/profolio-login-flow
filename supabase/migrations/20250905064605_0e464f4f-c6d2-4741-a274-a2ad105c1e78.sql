-- Create enum types for the app
CREATE TYPE public.friend_request_status AS ENUM ('pending', 'accepted', 'rejected');

-- Update the existing profiles table to match your requirements
-- First, let's check if columns exist and add missing ones
DO $$ 
BEGIN
    -- Add full_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN
        ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
    END IF;
    
    -- Add email column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT UNIQUE;
    END IF;
    
    -- Add photo_url column if it doesn't exist (avatar_url might already exist)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'photo_url') THEN
        ALTER TABLE public.profiles ADD COLUMN photo_url TEXT;
    END IF;
    
    -- Add address column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address') THEN
        ALTER TABLE public.profiles ADD COLUMN address TEXT;
    END IF;
END $$;

-- Create friend_requests table
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status public.friend_request_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure users can't send friend requests to themselves
    CONSTRAINT friend_requests_not_self CHECK (sender_id != receiver_id),
    -- Ensure unique friend request between two users
    CONSTRAINT friend_requests_unique UNIQUE (sender_id, receiver_id)
);

-- Create followers table
CREATE TABLE IF NOT EXISTS public.followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure users can't follow themselves
    CONSTRAINT followers_not_self CHECK (follower_id != following_id),
    -- Ensure unique follow relationship
    CONSTRAINT followers_unique UNIQUE (follower_id, following_id)
);

-- Create comments table for posts
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all new tables
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friend_requests
-- Users can view friend requests they sent or received
CREATE POLICY "Users can view their own friend requests" 
ON public.friend_requests 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND (p.id = friend_requests.sender_id OR p.id = friend_requests.receiver_id)
    )
);

-- Users can create friend requests (as sender)
CREATE POLICY "Users can create friend requests" 
ON public.friend_requests 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.id = friend_requests.sender_id
    )
);

-- Users can update friend requests they received (to accept/reject)
CREATE POLICY "Users can update received friend requests" 
ON public.friend_requests 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.id = friend_requests.receiver_id
    )
);

-- Users can delete friend requests they sent
CREATE POLICY "Users can delete sent friend requests" 
ON public.friend_requests 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.id = friend_requests.sender_id
    )
);

-- RLS Policies for followers
-- Users can view all follow relationships (public information)
CREATE POLICY "Follow relationships are public" 
ON public.followers 
FOR SELECT 
USING (true);

-- Users can create follow relationships (as follower)
CREATE POLICY "Users can follow others" 
ON public.followers 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.id = followers.follower_id
    )
);

-- Users can delete their own follow relationships
CREATE POLICY "Users can unfollow others" 
ON public.followers 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.id = followers.follower_id
    )
);

-- RLS Policies for comments
-- Comments are viewable by everyone (public)
CREATE POLICY "Comments are viewable by everyone" 
ON public.comments 
FOR SELECT 
USING (true);

-- Users can create comments
CREATE POLICY "Users can create comments" 
ON public.comments 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.id = comments.user_id
    )
);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" 
ON public.comments 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.id = comments.user_id
    )
);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" 
ON public.comments 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND p.id = comments.user_id
    )
);

-- Create triggers for updated_at columns
CREATE TRIGGER update_friend_requests_updated_at
    BEFORE UPDATE ON public.friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);

CREATE INDEX IF NOT EXISTS idx_followers_follower ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON public.followers(following_id);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at);