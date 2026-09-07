/**
 * Phase 6C finalization — safe, server-side storage cleanup.
 *
 * The `post-images` bucket's client-side DELETE is unreliable for the owner,
 * and a client can't safely decide an object is unreferenced anyway. All
 * deletion goes through the `media-cleanup` Edge Function (service role), which
 * re-verifies that each path is caller-owned AND unreferenced by any post
 * before removing it. Every call here is best-effort: a failure never blocks
 * the post update / delete it follows, and the periodic `sweep` mops up
 * anything a `prune` missed.
 */
import { supabase } from '@/integrations/supabase/client';

/** ".../object/public/post-images/<path>" -> "<path>" (or null if not one). */
export function postImagePath(url: string): string | null {
  const m = url.match(/\/object\/public\/post-images\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Delete specific now-unreferenced objects (after an edit removal or a post delete). */
export async function pruneOrphanMedia(pathsOrUrls: string[]): Promise<void> {
  const paths = Array.from(new Set(pathsOrUrls.filter((p): p is string => !!p)));
  if (paths.length === 0) return;
  try {
    const { data, error } = await supabase.functions.invoke('media-cleanup', {
      body: { mode: 'prune', paths },
    });
    if (error) console.warn('[media-cleanup] prune error (sweep will retry):', error.message);
    else if (data?.skipped?.length) console.warn('[media-cleanup] prune skipped:', data.skipped);
  } catch (e) {
    console.warn('[media-cleanup] prune threw (sweep will retry):', e);
  }
}

/** Bounded sweep of the current user's own post-images folder for orphans. */
export async function sweepOrphanMedia(limit = 50): Promise<void> {
  try {
    await supabase.functions.invoke('media-cleanup', { body: { mode: 'sweep', limit } });
  } catch (e) {
    console.warn('[media-cleanup] sweep threw:', e);
  }
}
