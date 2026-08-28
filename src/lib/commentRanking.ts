/**
 * Client-side mirror of the SQL function `public.get_ranked_post_comments`
 * (see supabase/migrations/20260828170500_tune_comment_relevance_formula.sql).
 *
 * The database is the source of truth on load / reload / sort-change / "load
 * more". This module exists ONLY so that realtime engagement events can nudge
 * the currently-loaded page into the right order between server fetches — it
 * uses the EXACT same formula, weights and tie-breakers as the RPC:
 *
 *   relevance = 5*reaction_count + 4*reply_count - 1.5*ln(age_hours + 2)
 *   ORDER BY relevance DESC, created_at DESC, id DESC
 *
 * If the SQL formula changes, change these three constants (and the migration)
 * together — there must never be two different algorithms.
 */

export const RELEVANCE_REACTION_WEIGHT = 5;
export const RELEVANCE_REPLY_WEIGHT = 4;
export const RELEVANCE_AGE_DECAY = 1.5;

const MS_PER_HOUR = 3_600_000;

export function calculateCommentRelevance(
  reactionCount: number,
  replyCount: number,
  createdAt: string | number | Date,
  now: number = Date.now(),
): number {
  const ageHours = Math.max(0, (now - new Date(createdAt).getTime()) / MS_PER_HOUR);
  return (
    RELEVANCE_REACTION_WEIGHT * reactionCount +
    RELEVANCE_REPLY_WEIGHT * replyCount -
    RELEVANCE_AGE_DECAY * Math.log(ageHours + 2)
  );
}

export interface RankableComment {
  id: string;
  createdAt: string;
  reactionCount: number;
  replyCount: number;
}

/**
 * Comparator matching the RPC's `ORDER BY relevance DESC, created_at DESC,
 * id DESC`. Pass a single `now` for a whole sort pass so time-decay can't
 * reorder ties mid-sort.
 */
export function compareForRelevance(
  a: RankableComment,
  b: RankableComment,
  now: number = Date.now(),
): number {
  const ra = calculateCommentRelevance(a.reactionCount, a.replyCount, a.createdAt, now);
  const rb = calculateCommentRelevance(b.reactionCount, b.replyCount, b.createdAt, now);
  if (rb !== ra) return rb - ra;

  const ta = new Date(a.createdAt).getTime();
  const tb = new Date(b.createdAt).getTime();
  if (tb !== ta) return tb - ta;

  // id DESC
  if (a.id === b.id) return 0;
  return a.id > b.id ? -1 : 1;
}
