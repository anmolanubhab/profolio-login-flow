-- Phase 6A follow-up: address database-linter warnings for the new objects.
--   * pin search_path on normalize_hashtag (function_search_path_mutable)
--   * search_hashtags: SECURITY INVOKER (only reads the public hashtags table)
--     + lock EXECUTE to authenticated
--   * can_receive_mention_from: internal to the trigger only -> no role grants
--   * trigger functions: not callable as RPCs

create or replace function public.normalize_hashtag(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    substring(
      regexp_replace(lower(regexp_replace(coalesce(input, ''), '^#+', '')), '[^a-z0-9_]+', '', 'g')
      from 1 for 100
    ),
    ''
  );
$$;

create or replace function public.search_hashtags(q text)
returns table (tag text, post_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.tag, h.post_count
  from public.hashtags h
  where h.tag like (public.normalize_hashtag(q) || '%')
  order by h.post_count desc, h.tag asc
  limit 8;
$$;
revoke all on function public.search_hashtags(text) from public, anon;
grant execute on function public.search_hashtags(text) to authenticated, service_role;

revoke all on function public.can_receive_mention_from(uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_receive_mention_from(uuid, uuid) to service_role;

revoke all on function public.sync_post_entities() from public, anon, authenticated;
revoke all on function public.hashtag_recount_after_unlink() from public, anon, authenticated;
