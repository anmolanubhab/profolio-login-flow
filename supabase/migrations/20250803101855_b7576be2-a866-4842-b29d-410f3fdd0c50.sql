-- Create storage policies for post-images bucket
-- Policy for SELECT (viewing images)
CREATE POLICY "Anyone can view post images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'post-images');

-- Policy for INSERT (uploading images)
CREATE POLICY "Authenticated users can upload post images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');

-- Policy for UPDATE (updating images)
CREATE POLICY "Users can update their own post images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy for DELETE (deleting images)
CREATE POLICY "Users can delete their own post images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);