-- Fix storage policies for post-images bucket by removing conflicts and ensuring proper policies exist

-- First, drop any conflicting policies that might exist
DO $$
BEGIN
    -- Drop the old "Post images are publicly accessible" policy if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Post images are publicly accessible') THEN
        DROP POLICY "Post images are publicly accessible" ON storage.objects;
    END IF;
    
    -- Drop duplicate "Anyone can view post images" if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view post images') THEN
        DROP POLICY "Anyone can view post images" ON storage.objects;
    END IF;
    
    -- Drop duplicate "Authenticated users can upload post images" if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload post images') THEN
        DROP POLICY "Authenticated users can upload post images" ON storage.objects;
    END IF;
END $$;

-- Now create the correct policies for post-images bucket

-- Policy for SELECT (viewing images) - anyone can view
CREATE POLICY "Anyone can view post images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'post-images');

-- Policy for INSERT (uploading images) - authenticated users only
CREATE POLICY "Authenticated users can upload post images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');

-- Policy for UPDATE (updating images) - users can update their own
CREATE POLICY "Users can update their own post images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy for DELETE (deleting images) - users can delete their own
CREATE POLICY "Users can delete their own post images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);