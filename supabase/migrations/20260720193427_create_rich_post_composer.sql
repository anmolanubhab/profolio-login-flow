-- RECONSTRUCTED (NOT ORIGINAL SQL). Generated 2026-08-21 via read-only
-- introspection of live project ajbhpqbfcpmztjtxqxxk, representing DB
-- migration version 20260720193427 "create_rich_post_composer" (no
-- matching file in supabase/migrations/). Adds the columns on public.posts
-- (confirmed live via information_schema.columns) that support video,
-- document, and carousel post types, plus the storage policies (confirmed
-- live via pg_policies on storage.objects) that let authenticated users
-- upload/manage post videos and post documents. post_type/company_* columns
-- already existed from the earlier company-posting feature and are not
-- recreated here.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS document_name text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS carousel_urls text[];

-- Storage: post-videos bucket policies
DROP POLICY IF EXISTS "Authenticated users can upload post videos" ON storage.objects;
CREATE POLICY "Authenticated users can upload post videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-videos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own post videos" ON storage.objects;
CREATE POLICY "Users can update their own post videos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own post videos" ON storage.objects;
CREATE POLICY "Users can delete their own post videos" ON storage.objects
  FOR DELETE USING (bucket_id = 'post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage: post-documents bucket policies
DROP POLICY IF EXISTS "Users can upload their own post documents" ON storage.objects;
CREATE POLICY "Users can upload their own post documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own post documents" ON storage.objects;
CREATE POLICY "Users can update their own post documents" ON storage.objects
  FOR UPDATE USING (bucket_id = 'post-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own post documents" ON storage.objects;
CREATE POLICY "Users can delete their own post documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'post-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
