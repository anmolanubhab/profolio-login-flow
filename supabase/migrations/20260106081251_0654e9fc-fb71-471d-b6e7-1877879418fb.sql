-- Add media_type column to posts table for video support
ALTER TABLE public.posts 
ADD COLUMN media_type TEXT DEFAULT 'image';

-- Create post-videos storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-videos', 'post-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for post-videos bucket
CREATE POLICY "Anyone can view post videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'post-videos');

CREATE POLICY "Authenticated users can upload post videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'post-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own post videos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own post videos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);