-- Match the Phase 6A advisor-hardening precedent: the tag trigger function is
-- never a real RPC, and anon has no business reading tag rows or the helper
-- predicates. RLS still governs everything for authenticated users.
revoke all on function public.notify_photo_tag() from public, anon, authenticated;

revoke select on public.post_media_tags from anon;

-- Helpers are only needed by RLS (SECURITY DEFINER, run as owner) and, for
-- search_taggable_people, by the signed-in tag picker. Keep authenticated on
-- the search fn; drop anon everywhere.
revoke all on function public.owns_post(uuid) from anon;
revoke all on function public.can_tag_profile(uuid) from anon;
revoke all on function public.search_taggable_people(text) from anon;
