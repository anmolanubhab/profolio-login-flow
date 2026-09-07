-- Phase 6C — advanced photo editor: per-image metadata (alt text + dimensions)
-- and deterministic ordering for multi-image posts.
--
-- Additive only. Existing posts keep rendering from posts.image_url /
-- posts.carousel_urls exactly as before (posts.media stays NULL for them).
-- Does NOT touch Phase 1-5 job matching or the frozen Phase 5 email infra.
-- Photo *tagging* (people markers on an image) is intentionally NOT in this
-- migration -- it is a separate, privacy-sensitive subsystem deferred to a
-- later phase; @mentions in the caption already cover "mention a person".

alter table public.posts add column if not exists media jsonb;

comment on column public.posts.media is
  'Ordered image list: [{ url text, alt text, w int, h int }]. Array order IS '
  'the display order. When present and non-empty it supersedes image_url / '
  'carousel_urls for rendering; NULL keeps the legacy single/carousel fields.';

-- Shape guard only (NOT VALID: existing rows are untouched). Per-item fields
-- are validated + sanitized client-side and re-checked by secure-upload.
alter table public.posts drop constraint if exists posts_media_is_array;
alter table public.posts add constraint posts_media_is_array
  check (media is null or jsonb_typeof(media) = 'array') not valid;
