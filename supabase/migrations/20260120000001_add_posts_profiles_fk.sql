-- Add explicit foreign key between posts and profiles to enable PostgREST resource embedding
-- This allows querying posts with their author profile using the relationship
-- We name it posts_profiles_fk to distinguish from the auth.users FK
ALTER TABLE public.posts
ADD CONSTRAINT posts_profiles_fk
FOREIGN KEY (user_id)
REFERENCES public.profiles(user_id)
ON DELETE CASCADE;
