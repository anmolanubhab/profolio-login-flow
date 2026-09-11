-- The message-attachments bucket was created for document attachments only;
-- its allowed_mime_types was never widened when Phase 3a (image messaging)
-- shipped, so every real image-send attempt failed server-side with
-- "mime type image/png is not supported" even though the client-side upload
-- code (uploadMessageAttachment / sendImage in ChatInterface.tsx) was
-- already correct. Additive only -- existing document types are untouched,
-- and this does not affect the unrelated post-images bucket.
update storage.buckets
set allowed_mime_types = allowed_mime_types || array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
where id = 'message-attachments'
  and not (allowed_mime_types @> array['image/png']::text[]);
