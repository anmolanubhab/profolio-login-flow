/**
 * Phase 6C finalization — Photo Tagging.
 *
 * A photo tag attaches a *person* to one *image* of a post. It is a completely
 * separate system from Phase 6A caption @mentions:
 *   - @mention  -> text inside posts.content_rich -> post_mentions + post_mention notification
 *   - photo tag -> row in post_media_tags (media_key + normalised x/y) -> photo_tag notification
 *
 * Marker coordinates are stored normalised (0..1) so a tag stays in the right
 * place across desktop / mobile / any rendered image size. `media_key` is the
 * stable posts.media[i].id, so a tag follows its image across reorder and is
 * removed with its image.
 */
import { supabase } from '@/integrations/supabase/client';

export interface TaggablePerson {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  profession: string | null;
}

/** A tag as held in the editor / rendered on an image. */
export interface DraftTag {
  profileId: string;
  name: string;
  avatarUrl?: string | null;
  /** normalised marker position, 0..1 within the image box */
  x: number;
  y: number;
}

interface TagRow {
  id: string;
  media_key: string;
  profile_id: string;
  x: number | string;
  y: number | string;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

export const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5);

/** Debounced, privacy-aware people search for the tag picker. */
export async function searchTaggablePeople(q: string): Promise<TaggablePerson[]> {
  const query = q.trim();
  if (!query) return [];
  const { data, error } = await supabase.rpc('search_taggable_people', { q: query });
  if (error) {
    console.error('search_taggable_people failed:', error);
    return [];
  }
  return (data ?? []) as TaggablePerson[];
}

/** All tags for a post, grouped by media_key. */
export async function loadPostMediaTags(postId: string): Promise<Record<string, DraftTag[]>> {
  const { data, error } = await supabase
    .from('post_media_tags')
    .select('id, media_key, profile_id, x, y, profiles:profile_id ( display_name, avatar_url )')
    .eq('post_id', postId);
  if (error) {
    console.error('loadPostMediaTags failed:', error);
    return {};
  }
  const out: Record<string, DraftTag[]> = {};
  for (const row of (data ?? []) as TagRow[]) {
    (out[row.media_key] ||= []).push({
      profileId: row.profile_id,
      name: row.profiles?.display_name || 'Someone',
      avatarUrl: row.profiles?.avatar_url ?? null,
      x: clamp01(Number(row.x)),
      y: clamp01(Number(row.y)),
    });
  }
  return out;
}

export interface DesiredMediaTags {
  mediaKey: string;
  tags: DraftTag[];
}

/**
 * Reconcile post_media_tags for a post against `desired`:
 *   - rows removed from `desired`  -> DELETE (relationship removed)
 *   - rows whose marker moved       -> UPDATE x/y (no notification)
 *   - brand-new rows                -> INSERT (fires photo_tag notification once
 *                                     via the DB trigger; the unique constraint
 *                                     means re-saving an unchanged tag is a
 *                                     no-op and never re-notifies)
 * RLS enforces author-only writes + can_tag_profile(); a rejected individual
 * insert is skipped, not fatal. Returns the number of newly-created tags.
 */
export async function reconcilePostMediaTags(
  postId: string,
  desired: DesiredMediaTags[],
): Promise<{ added: number; removed: number; failed: number }> {
  const wanted = new Map<string, { mediaKey: string; tag: DraftTag }>();
  for (const group of desired) {
    for (const tag of group.tags) {
      wanted.set(`${group.mediaKey}|${tag.profileId}`, { mediaKey: group.mediaKey, tag });
    }
  }

  const { data: existingRows, error: exErr } = await supabase
    .from('post_media_tags')
    .select('id, media_key, profile_id, x, y')
    .eq('post_id', postId);
  if (exErr) {
    console.error('reconcilePostMediaTags: load existing failed:', exErr);
    return { added: 0, removed: 0, failed: wanted.size };
  }

  const existing = new Map<string, TagRow>();
  for (const row of (existingRows ?? []) as TagRow[]) {
    existing.set(`${row.media_key}|${row.profile_id}`, row);
  }

  // deletes
  const removeIds: string[] = [];
  for (const [key, row] of existing) {
    if (!wanted.has(key)) removeIds.push(row.id);
  }
  let removed = 0;
  if (removeIds.length) {
    const { error } = await supabase.from('post_media_tags').delete().in('id', removeIds);
    if (error) console.error('reconcilePostMediaTags: delete failed:', error);
    else removed = removeIds.length;
  }

  // inserts + moves
  let added = 0;
  let failed = 0;
  for (const [key, { mediaKey, tag }] of wanted) {
    const x = clamp01(tag.x);
    const y = clamp01(tag.y);
    const prev = existing.get(key);
    if (prev) {
      if (Math.abs(Number(prev.x) - x) > 1e-4 || Math.abs(Number(prev.y) - y) > 1e-4) {
        const { error } = await supabase
          .from('post_media_tags')
          .update({ x, y })
          .eq('id', prev.id);
        if (error) console.error('reconcilePostMediaTags: move failed:', error);
      }
      continue;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('post_media_tags').insert({
      post_id: postId,
      media_key: mediaKey,
      profile_id: tag.profileId,
      x,
      y,
      created_by: auth.user?.id,
    });
    if (error) {
      // most likely: target not taggable (block / discovery off) -> skip it
      console.warn('reconcilePostMediaTags: insert skipped:', error.message);
      failed += 1;
    } else {
      added += 1;
    }
  }

  return { added, removed, failed };
}
