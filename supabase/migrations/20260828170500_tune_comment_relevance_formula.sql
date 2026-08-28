-- Rebalance get_ranked_post_comments so engagement outweighs pure recency
-- (the first cut's linear -0.15*age_hours decay erased a like within a day).
-- New deterministic score for a top-level comment:
--   relevance = 5*reaction_count + 4*reply_count - 1.5*ln(age_hours + 2)
-- => a brand-new comment with no engagement scores ~ -1.0; a couple of
--    reactions keeps a multi-day-old comment above fresh empty ones; ties
--    break newest-first then id. Pagination (limit/offset) unchanged.
CREATE OR REPLACE FUNCTION public.get_ranked_post_comments(
  p_post_id uuid,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  post_id uuid,
  user_id uuid,
  content text,
  image_url text,
  created_at timestamptz,
  is_edited boolean,
  parent_comment_id uuid,
  reaction_count bigint,
  reply_count bigint,
  relevance double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    c.id, c.post_id, c.user_id, c.content, c.image_url, c.created_at,
    c.is_edited, c.parent_comment_id,
    COALESCE(rx.n, 0) AS reaction_count,
    COALESCE(rp.n, 0) AS reply_count,
    (COALESCE(rx.n, 0) * 5 + COALESCE(rp.n, 0) * 4)
      - 1.5 * ln((EXTRACT(epoch FROM (now() - c.created_at)) / 3600.0) + 2) AS relevance
  FROM public.comments c
  LEFT JOIN (
    SELECT comment_id, count(*)::bigint AS n
    FROM public.comment_reactions GROUP BY comment_id
  ) rx ON rx.comment_id = c.id
  LEFT JOIN (
    SELECT parent_comment_id, count(*)::bigint AS n
    FROM public.comments
    WHERE parent_comment_id IS NOT NULL
    GROUP BY parent_comment_id
  ) rp ON rp.parent_comment_id = c.id
  WHERE c.post_id = p_post_id AND c.parent_comment_id IS NULL
  ORDER BY relevance DESC, c.created_at DESC, c.id DESC
  LIMIT greatest(COALESCE(p_limit, 10), 0)
  OFFSET greatest(COALESCE(p_offset, 0), 0);
$$;
