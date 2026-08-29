-- =============================================================================
-- Phase 1 — "covers" storage bucket
--
-- Dedicated PUBLIC bucket for profile cover/banner images. Policy shape copied
-- verbatim from the live "avatars" bucket policies (checked against
-- storage.objects): world path is <auth-uid>/<file> (exactly two segments),
-- and a user may only write under their own uid prefix.
--
-- Verified before writing: no "covers" bucket exists; the generic
-- "Allow authenticated uploads" policy is scoped to bucket_id = 'stories'
-- only, so it does not widen access to this bucket.
--
-- SAFE / NON-DESTRUCTIVE:
--   * bucket insert guarded with ON CONFLICT DO NOTHING
--   * every policy is DROP POLICY IF EXISTS + CREATE (idempotent)
--   * no other bucket or policy is touched
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Cover images are publicly accessible" ON storage.objects;
CREATE POLICY "Cover images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Users can upload their own cover" ON storage.objects;
CREATE POLICY "Users can upload their own cover"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND array_length(string_to_array(name, '/'), 1) = 2
  );

DROP POLICY IF EXISTS "Users can update their own cover" ON storage.objects;
CREATE POLICY "Users can update their own cover"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND array_length(string_to_array(name, '/'), 1) = 2
  );

DROP POLICY IF EXISTS "Users can delete their own cover" ON storage.objects;
CREATE POLICY "Users can delete their own cover"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND array_length(string_to_array(name, '/'), 1) = 2
  );
