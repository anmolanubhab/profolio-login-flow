-- Update the existing profiles table to match your requirements
-- Add missing columns to profiles table
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
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
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

-- Enable Row Level Security on all new tables (if they don't already have it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'friend_requests' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'followers' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'comments' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- RLS Policies for friend_requests (drop existing ones if they exist)
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own friend requests" ON public.friend_requests;
    DROP POLICY IF EXISTS "Users can create friend requests" ON public.friend_requests;
    DROP POLICY IF EXISTS "Users can update received friend requests" ON public.friend_requests;
    DROP POLICY IF EXISTS "Users can delete sent friend requests" ON public.friend_requests;
    
    -- Create new policies
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'friend_requests') THEN
        EXECUTE 'CREATE POLICY "friend_requests_view_own" ON public.friend_requests FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND (p.id = friend_requests.sender_id OR p.id = friend_requests.receiver_id)
            )
        )';
        
        EXECUTE 'CREATE POLICY "friend_requests_create" ON public.friend_requests FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.id = friend_requests.sender_id
            )
        )';
        
        EXECUTE 'CREATE POLICY "friend_requests_update_received" ON public.friend_requests FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.id = friend_requests.receiver_id
            )
        )';
        
        EXECUTE 'CREATE POLICY "friend_requests_delete_sent" ON public.friend_requests FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.id = friend_requests.sender_id
            )
        )';
    END IF;
END $$;

-- RLS Policies for followers
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Follow relationships are public" ON public.followers;
    DROP POLICY IF EXISTS "Users can follow others" ON public.followers;
    DROP POLICY IF EXISTS "Users can unfollow others" ON public.followers;
    
    -- Create new policies
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'followers') THEN
        EXECUTE 'CREATE POLICY "followers_view_public" ON public.followers FOR SELECT USING (true)';
        
        EXECUTE 'CREATE POLICY "followers_create" ON public.followers FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.id = followers.follower_id
            )
        )';
        
        EXECUTE 'CREATE POLICY "followers_delete_own" ON public.followers FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.id = followers.follower_id
            )
        )';
    END IF;
END $$;

-- RLS Policies for comments
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
    DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
    DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
    DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
    
    -- Create new policies
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'comments') THEN
        EXECUTE 'CREATE POLICY "comments_view_public" ON public.comments FOR SELECT USING (true)';
        
        EXECUTE 'CREATE POLICY "comments_create" ON public.comments FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.id = comments.user_id
            )
        )';
        
        EXECUTE 'CREATE POLICY "comments_update_own" ON public.comments FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.id = comments.user_id
            )
        )';
        
        EXECUTE 'CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.id = comments.user_id
            )
        )';
    END IF;
END $$;

-- Create triggers for updated_at columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_friend_requests_updated_at'
    ) THEN
        CREATE TRIGGER update_friend_requests_updated_at
            BEFORE UPDATE ON public.friend_requests
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_comments_updated_at'
    ) THEN
        CREATE TRIGGER update_comments_updated_at
            BEFORE UPDATE ON public.comments
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);

CREATE INDEX IF NOT EXISTS idx_followers_follower ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON public.followers(following_id);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at);