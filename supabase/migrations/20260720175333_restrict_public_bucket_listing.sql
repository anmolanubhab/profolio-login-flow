-- RECONSTRUCTED (NOT ORIGINAL SQL) -- LOW CONFIDENCE, PLEASE REVIEW.
-- Generated 2026-08-21 via read-only introspection of live project
-- ajbhpqbfcpmztjtxqxxk, representing DB migration version 20260720175333
-- "restrict_public_bucket_listing" (no matching file in
-- supabase/migrations/).
--
-- UNCERTAINTY: the live storage.objects policy set (dumped via
-- pg_policies) currently has NO public/anon SELECT policy at all for the
-- public-facing buckets (avatars, post-images, post-videos, post-documents,
-- stories) -- readers rely on the buckets' public-bucket flag for GET, and
-- explicit SELECT policies only exist for the private buckets
-- (certificates, resumes), scoped to the owning user's folder. This is
-- consistent with a fix that DROPPED a prior permissive
-- "SELECT ... USING (true)" / "list objects" policy that would have let
-- any authenticated (or anon) caller enumerate/list every object across
-- all buckets via the storage REST/list API, not just fetch a known
-- public URL. The exact name/definition of the removed policy could not
-- be recovered (it no longer exists to introspect). This file only
-- documents removal of a plausibly-named legacy listing policy; if your
-- own history shows a different policy name, adjust accordingly.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public buckets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
