-- Fix security vulnerability: Restrict profiles table access to authenticated users only
-- Currently profiles are publicly viewable which exposes sensitive personal information

-- Drop the existing public policy
DROP POLICY "Profiles are viewable by everyone" ON public.profiles;

-- Create new policy that only allows authenticated users to view profiles
-- This protects sensitive information like phone numbers, LinkedIn, GitHub, etc.
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Optional: Create a more restrictive policy where users can only see their own profiles
-- Uncomment if you want maximum privacy protection
-- CREATE POLICY "Users can only view their own profile" 
-- ON public.profiles 
-- FOR SELECT 
-- TO authenticated
-- USING (auth.uid() = user_id);