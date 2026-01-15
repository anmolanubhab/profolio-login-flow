-- Security Fix: Update storage policies to prevent email exposure and add proper validation

-- First, let's update the avatars bucket policy to use secure paths
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND array_length(string_to_array(name, '/'), 1) = 2  -- Ensure only user_id/filename structure
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Update post-images bucket policies for better security
DROP POLICY IF EXISTS "Users can upload their own post images" ON storage.objects;

CREATE POLICY "Users can upload their own post images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'post-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND array_length(string_to_array(name, '/'), 1) = 2
);

-- Update certificates bucket policies
DROP POLICY IF EXISTS "Users can upload their own certificates" ON storage.objects;

CREATE POLICY "Users can upload their own certificates" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'certificates' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND array_length(string_to_array(name, '/'), 1) = 2
);

-- Update resumes bucket policies  
DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;

CREATE POLICY "Users can upload their own resumes" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND array_length(string_to_array(name, '/'), 1) = 2
);

-- Update stories bucket policies
DROP POLICY IF EXISTS "Users can upload their own stories" ON storage.objects;

CREATE POLICY "Users can upload their own stories" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'stories' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND array_length(string_to_array(name, '/'), 1) = 2
);