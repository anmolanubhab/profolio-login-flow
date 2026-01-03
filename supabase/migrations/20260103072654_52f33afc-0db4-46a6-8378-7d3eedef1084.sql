-- Add policy to allow authenticated users to read all profiles for chat/search
CREATE POLICY "profiles_read_all_authenticated" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);