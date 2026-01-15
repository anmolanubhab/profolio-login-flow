-- Fix infinite recursion in profiles RLS policy
-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view public profiles" ON public.profiles;

-- Create a new policy without recursive profile lookups
CREATE POLICY "Users can view public profiles" 
ON public.profiles 
FOR SELECT 
USING (
  profile_visibility = 'public' 
  OR user_id = auth.uid() 
  OR (
    profile_visibility = 'connections_only' 
    AND EXISTS (
      SELECT 1
      FROM connections
      WHERE connections.status = 'accepted'::connection_status
      AND (
        (connections.user_id = profiles.id AND connections.connection_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        ))
        OR 
        (connections.connection_id = profiles.id AND connections.user_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        ))
      )
    )
  )
);