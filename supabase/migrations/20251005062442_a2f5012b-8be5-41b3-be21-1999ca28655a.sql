-- Fix infinite recursion in profiles RLS policies
-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new simple policies without recursion

-- Allow read access to all profiles (needed for feed, network, connections)
CREATE POLICY "Allow read access to all profiles"
ON public.profiles
FOR SELECT
USING (true);

-- Allow users to update only their own profile
CREATE POLICY "Allow users to update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to insert their own profile record
CREATE POLICY "Allow users to insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);