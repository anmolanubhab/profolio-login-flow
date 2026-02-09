-- Enable RLS on posts table if not already enabled
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Drop existing read policy if it exists to ensure we have the correct one
DROP POLICY IF EXISTS "Authenticated users can view all posts" ON posts;
DROP POLICY IF EXISTS "Public can view all posts" ON posts;

-- Create policy for authenticated users to view all posts
CREATE POLICY "Authenticated users can view all posts"
ON posts FOR SELECT
TO authenticated
USING (true);

-- Allow users to insert their own posts
DROP POLICY IF EXISTS "Users can create their own posts" ON posts;
CREATE POLICY "Users can create their own posts"
ON posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own posts
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
CREATE POLICY "Users can update their own posts"
ON posts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete their own posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
CREATE POLICY "Users can delete their own posts"
ON posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
