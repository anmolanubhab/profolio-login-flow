-- Fix storage policies for post-images bucket by removing ALL existing policies and recreating them cleanly

-- Drop ALL existing policies for post-images bucket to avoid conflicts
DO $$
BEGIN
    -- Drop all possible existing policies for post-images bucket
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Post images are publicly accessible') THEN
        DROP POLICY "Post images are publicly accessible" ON storage.objects;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view post images') THEN
        DROP POLICY "Anyone can view post images" ON storage.objects;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload post images') THEN
        DROP POLICY "Authenticated users can upload post images" ON storage.objects;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload post images') THEN
        DROP POLICY "Users can upload post images" ON storage.objects;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own post images') THEN
        DROP POLICY "Users can update their own post images" ON storage.objects;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own post images') THEN
        DROP POLICY "Users can delete their own post images" ON storage.objects;
    END IF;
END $$;

-- Now create the correct policies for post-images bucket

-- Policy for SELECT (viewing images) - anyone can view since bucket is public
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