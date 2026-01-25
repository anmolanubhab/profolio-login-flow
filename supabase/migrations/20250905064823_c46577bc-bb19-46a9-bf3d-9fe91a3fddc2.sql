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

-- Create friend_requests table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'friend_requests') THEN
        CREATE TABLE public.friend_requests (
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
        
        -- Enable RLS
        ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
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
        
        -- Create trigger for updated_at
        CREATE TRIGGER update_friend_requests_updated_at
            BEFORE UPDATE ON public.friend_requests
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
            
        -- Create indexes
        CREATE INDEX idx_friend_requests_sender ON public.friend_requests(sender_id);
        CREATE INDEX idx_friend_requests_receiver ON public.friend_requests(receiver_id);
        CREATE INDEX idx_friend_requests_status ON public.friend_requests(status);
    END IF;
END $$;

-- Create followers table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followers') THEN
        CREATE TABLE public.followers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            
            -- Ensure users can't follow themselves
            CONSTRAINT followers_not_self CHECK (follower_id != following_id),
            -- Ensure unique follow relationship
            CONSTRAINT followers_unique UNIQUE (follower_id, following_id)
        );
        
        -- Enable RLS
        ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Follow relationships are public" 
        ON public.followers 
        FOR SELECT 
        USING (true);

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
        
        -- Create indexes
        CREATE INDEX idx_followers_follower ON public.followers(follower_id);
        CREATE INDEX idx_followers_following ON public.followers(following_id);
    END IF;
END $$;

-- Create comments table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments') THEN
        CREATE TABLE public.comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
        
        -- Enable RLS
        ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Comments are viewable by everyone" 
        ON public.comments 
        FOR SELECT 
        USING (true);

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
        
        -- Create trigger for updated_at
        CREATE TRIGGER update_comments_updated_at
            BEFORE UPDATE ON public.comments
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
            
        -- Create indexes
        CREATE INDEX idx_comments_post ON public.comments(post_id);
        CREATE INDEX idx_comments_user ON public.comments(user_id);
        CREATE INDEX idx_comments_created_at ON public.comments(created_at);
    END IF;
END $$;