import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isServerRateLimitError, SERVER_RATE_LIMIT_MESSAGE } from '@/lib/rate-limiter';
import { ReactionType, ReactionSummary } from '@/components/ReactionBar';
import { buildReactionSummary } from '@/lib/postAggregation';
import { compareForRelevance } from '@/lib/commentRanking';
import { parseForEditing, serializeEditedContent } from '@/lib/commentMentions';

/** Canonical form for comparing "did the edit actually change anything" --
 *  folds legacy/non-normalised mention tokens to the same representation the
 *  composer now produces, so re-saving an untouched comment is a true no-op. */
const canonicalContent = (s: string): string => {
  const p = parseForEditing(s);
  return serializeEditedContent(p.text, p.mentions);
};

/**
 * Client state for one post's comment thread (LinkedIn-style):
 *   - top-level comments, "Most relevant" (default) or "Most recent" sort,
 *     both paginated server-side ("Load more comments")
 *   - one level of replies per comment, loaded on demand
 *   - per-comment reactions (reuses the 6-type reaction system)
 *   - optimistic add / edit / delete / react with rollback on failure
 *   - Supabase Realtime: subscribed lazily while the section is open, scoped
 *     to this post; reconciles insert/update/delete + reaction changes
 *
 * DB is the source of truth:
 *   - public.comments (RLS: own-profile writes; one-level threading enforced
 *     by enforce_comment_reply_depth; image_url reuses the post-images bucket)
 *   - public.comment_reactions (RLS: user_id = current_profile_id())
 *   - public.get_ranked_post_comments(post, limit, offset) -> relevance sort
 *   - comment / reply / reaction / mention notifications are fired by DB
 *     triggers, so this hook never writes to public.notifications.
 */

const TOP_LEVEL_PAGE = 10;
const REPLY_PAGE = 20;

export type CommentSort = 'relevant' | 'recent';

export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface CommentNode {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  isEdited: boolean;
  parentId: string | null;
  author: CommentAuthor;
  reactions: ReactionSummary;
  /** true while an optimistic row is awaiting its server confirmation */
  pending?: boolean;
}

export interface CommentInput {
  text: string;
  imageUrl?: string | null;
}

interface RawComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  is_edited: boolean;
  parent_comment_id: string | null;
}

interface RawReaction {
  comment_id: string;
  user_id: string;
  reaction_type: ReactionType;
}

const COMMENT_COLS = 'id, post_id, user_id, content, image_url, created_at, is_edited, parent_comment_id';

const emptySummary = (): ReactionSummary => ({
  total_reactions: 0,
  user_reaction: null,
  reactions: {},
});

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export interface UseCommentsResult {
  currentProfileId: string | null;
  currentUserId: string | null;
  currentAuthor: CommentAuthor | null;
  count: number;
  topLevel: CommentNode[];
  repliesByParent: Record<string, CommentNode[]>;
  replyCount: Record<string, number>;
  hasMoreTopLevel: boolean;
  loading: boolean;
  loadingMore: boolean;
  expandedReplies: Set<string>;
  loaded: boolean;
  sort: CommentSort;
  setSort: (s: CommentSort) => void;
  load: () => Promise<void>;
  loadMoreTopLevel: () => Promise<void>;
  loadReplies: (parentId: string) => Promise<void>;
  collapseReplies: (parentId: string) => void;
  addComment: (input: CommentInput) => Promise<boolean>;
  addReply: (parentId: string, input: CommentInput) => Promise<boolean>;
  editComment: (commentId: string, text: string) => Promise<boolean>;
  deleteComment: (commentId: string) => Promise<boolean>;
  reactToComment: (commentId: string, type: ReactionType | null) => Promise<void>;
}

export function useComments(postId: string, seedCount = 0): UseCommentsResult {
  const { toast } = useToast();

  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAuthor, setCurrentAuthor] = useState<CommentAuthor | null>(null);
  const [count, setCount] = useState(seedCount);
  const [topLevel, setTopLevel] = useState<CommentNode[]>([]);
  const [repliesByParent, setRepliesByParent] = useState<Record<string, CommentNode[]>>({});
  const [replyCount, setReplyCount] = useState<Record<string, number>>({});
  const [hasMoreTopLevel, setHasMoreTopLevel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [sort, setSortState] = useState<CommentSort>('relevant');

  const profileRef = useRef<CommentAuthor | null>(null);
  const pageRef = useRef(0);
  const inFlight = useRef<Set<string>>(new Set());

  // Mirrors for the realtime callback (stable channel, fresh reads).
  const topLevelRef = useRef<CommentNode[]>([]);
  const repliesRef = useRef<Record<string, CommentNode[]>>({});
  const replyCountRef = useRef<Record<string, number>>({});
  const expandedRef = useRef<Set<string>>(new Set());
  const sortRef = useRef<CommentSort>('relevant');
  useEffect(() => { topLevelRef.current = topLevel; }, [topLevel]);
  useEffect(() => { repliesRef.current = repliesByParent; }, [repliesByParent]);
  useEffect(() => { replyCountRef.current = replyCount; }, [replyCount]);
  useEffect(() => { expandedRef.current = expandedReplies; }, [expandedReplies]);
  useEffect(() => { sortRef.current = sort; }, [sort]);

  // Order-independent fingerprint of the ranking inputs for the loaded
  // top-level set: comment ids + their reaction counts + their reply counts.
  // Changes exactly when a realtime/optimistic event could alter "Most
  // relevant" order (new/removed comment, reaction +/-, reply +/-).
  const rankSignature = useMemo(
    () =>
      topLevel
        .map((n) => `${n.id}:${n.reactions.total_reactions}:${replyCount[n.id] ?? 0}`)
        .sort()
        .join('|'),
    [topLevel, replyCount],
  );

  const rankableOf = useCallback(
    (n: CommentNode) => ({
      id: n.id,
      createdAt: n.createdAt,
      reactionCount: n.reactions.total_reactions,
      replyCount: replyCountRef.current[n.id] ?? 0,
    }),
    [],
  );

  // Re-rank the currently loaded page with the EXACT client mirror of the RPC
  // formula whenever an engagement input changes (or the user switches to
  // "relevant"). Not a timer -- only fires on real events, so age-only decay
  // never churns the list. "recent" is left in created_at DESC order.
  useEffect(() => {
    if (sort !== 'relevant') return;
    setTopLevel((prev) => {
      if (prev.length < 2) return prev;
      const now = Date.now();
      const sorted = [...prev].sort((a, b) => compareForRelevance(rankableOf(a), rankableOf(b), now));
      return sorted.every((n, i) => n.id === prev[i].id) ? prev : sorted;
    });
    // rankSignature / sort are the intentional triggers; topLevel is read
    // through the state updater so it is never stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankSignature, sort]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active || !profile) return;
      const author: CommentAuthor = {
        id: profile.id,
        name: profile.display_name || user.email?.split('@')[0] || 'You',
        avatar: profile.avatar_url,
      };
      profileRef.current = author;
      setCurrentUserId(user.id);
      setCurrentProfileId(profile.id);
      setCurrentAuthor(author);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) setCount(seedCount);
  }, [seedCount, loaded]);

  const enrich = useCallback(
    (rows: RawComment[], profiles: Map<string, CommentAuthor>, reactions: RawReaction[], myId: string | null): CommentNode[] => {
      const byComment = new Map<string, RawReaction[]>();
      reactions.forEach((r) => {
        const arr = byComment.get(r.comment_id) || [];
        arr.push(r);
        byComment.set(r.comment_id, arr);
      });
      return rows.map((c) => ({
        id: c.id,
        postId: c.post_id,
        authorId: c.user_id,
        content: c.content,
        imageUrl: c.image_url,
        createdAt: c.created_at,
        isEdited: c.is_edited,
        parentId: c.parent_comment_id,
        author: profiles.get(c.user_id) || { id: c.user_id, name: 'Unknown User', avatar: null },
        reactions: buildReactionSummary(
          (byComment.get(c.id) || []).map((r) => ({ user_id: r.user_id, reaction_type: r.reaction_type })),
          myId,
        ),
      }));
    },
    [],
  );

  const fetchProfiles = useCallback(async (ids: string[]): Promise<Map<string, CommentAuthor>> => {
    const map = new Map<string, CommentAuthor>();
    const unique = [...new Set(ids)];
    if (unique.length === 0) return map;
    const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', unique);
    (data || []).forEach((p) => {
      map.set(p.id, { id: p.id, name: p.display_name || 'Unknown User', avatar: p.avatar_url });
    });
    return map;
  }, []);

  const fetchReactions = useCallback(async (commentIds: string[]): Promise<RawReaction[]> => {
    if (commentIds.length === 0) return [];
    const { data } = await supabase
      .from('comment_reactions')
      .select('comment_id, user_id, reaction_type')
      .in('comment_id', commentIds);
    return (data || []) as RawReaction[];
  }, []);

  const loadPage = useCallback(
    async (page: number) => {
      const myId = profileRef.current?.id ?? null;
      const from = page * TOP_LEVEL_PAGE;

      let rows: RawComment[];
      let seededReplyCounts: Record<string, number> | null = null;

      if (sortRef.current === 'relevant') {
        const { data, error } = await supabase.rpc('get_ranked_post_comments', {
          p_post_id: postId,
          p_limit: TOP_LEVEL_PAGE,
          p_offset: from,
        });
        if (error) throw error;
        const ranked = (data || []) as Array<RawComment & { reply_count: number }>;
        rows = ranked.map((r) => ({
          id: r.id, post_id: r.post_id, user_id: r.user_id, content: r.content,
          image_url: r.image_url, created_at: r.created_at, is_edited: r.is_edited,
          parent_comment_id: r.parent_comment_id,
        }));
        seededReplyCounts = {};
        ranked.forEach((r) => { seededReplyCounts![r.id] = Number(r.reply_count) || 0; });
      } else {
        const { data, error } = await supabase
          .from('comments')
          .select(COMMENT_COLS)
          .eq('post_id', postId)
          .is('parent_comment_id', null)
          .order('created_at', { ascending: false })
          .range(from, from + TOP_LEVEL_PAGE - 1);
        if (error) throw error;
        rows = (data || []) as RawComment[];
      }

      const topIds = rows.map((r) => r.id);
      const counts: Record<string, number> = seededReplyCounts ?? {};

      if (!seededReplyCounts && topIds.length > 0) {
        const { data: rr } = await supabase
          .from('comments')
          .select('id, parent_comment_id')
          .in('parent_comment_id', topIds);
        topIds.forEach((id) => { counts[id] = 0; });
        (rr || []).forEach((r) => {
          if (r.parent_comment_id) counts[r.parent_comment_id] = (counts[r.parent_comment_id] || 0) + 1;
        });
      }

      const profiles = await fetchProfiles(rows.map((r) => r.user_id));
      const reactions = await fetchReactions(topIds);
      const nodes = enrich(rows, profiles, reactions, myId);

      return { nodes, counts, hasMore: rows.length === TOP_LEVEL_PAGE };
    },
    [postId, enrich, fetchProfiles, fetchReactions],
  );

  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      pageRef.current = 0;
      const [{ nodes, counts, hasMore }, { count: exact }] = await Promise.all([
        loadPage(0),
        supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId)
          .then((r) => ({ count: r.count ?? 0 })),
      ]);
      setTopLevel(nodes);
      setReplyCount((prev) => ({ ...prev, ...counts }));
      setHasMoreTopLevel(hasMore);
      setCount(exact);
      setLoaded(true);
    } catch (err) {
      console.error('Error loading comments:', err);
      toast({ title: 'Error', description: 'Could not load comments.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [loading, loadPage, postId, toast]);

  const setSort = useCallback((s: CommentSort) => {
    if (s === sortRef.current) return;
    sortRef.current = s;
    setSortState(s);
    pageRef.current = 0;
    setLoading(true);
    loadPage(0)
      .then(({ nodes, counts, hasMore }) => {
        setTopLevel(nodes);
        setReplyCount((prev) => ({ ...prev, ...counts }));
        setHasMoreTopLevel(hasMore);
      })
      .catch((err) => {
        console.error('Error re-sorting comments:', err);
        toast({ title: 'Error', description: 'Could not re-sort comments.', variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [loadPage, toast]);

  const loadMoreTopLevel = useCallback(async () => {
    if (loadingMore || !hasMoreTopLevel) return;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const { nodes, counts, hasMore } = await loadPage(next);
      pageRef.current = next;
      setTopLevel((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...nodes.filter((n) => !seen.has(n.id))];
      });
      setReplyCount((prev) => ({ ...prev, ...counts }));
      setHasMoreTopLevel(hasMore);
    } catch (err) {
      console.error('Error loading more comments:', err);
      toast({ title: 'Error', description: 'Could not load more comments.', variant: 'destructive' });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreTopLevel, loadPage, toast]);

  const loadReplies = useCallback(
    async (parentId: string) => {
      setExpandedReplies((prev) => new Set(prev).add(parentId));
      try {
        const myId = profileRef.current?.id ?? null;
        const { data: rr, error } = await supabase
          .from('comments')
          .select(COMMENT_COLS)
          .eq('parent_comment_id', parentId)
          .order('created_at', { ascending: true })
          .limit(REPLY_PAGE * 5);
        if (error) throw error;
        const rows = (rr || []) as RawComment[];
        const profiles = await fetchProfiles(rows.map((r) => r.user_id));
        const reactions = await fetchReactions(rows.map((r) => r.id));
        const nodes = enrich(rows, profiles, reactions, myId);
        setRepliesByParent((prev) => ({ ...prev, [parentId]: nodes }));
        setReplyCount((prev) => ({ ...prev, [parentId]: nodes.length }));
      } catch (err) {
        console.error('Error loading replies:', err);
        toast({ title: 'Error', description: 'Could not load replies.', variant: 'destructive' });
        setExpandedReplies((prev) => {
          const n = new Set(prev);
          n.delete(parentId);
          return n;
        });
      }
    },
    [enrich, fetchProfiles, fetchReactions, toast],
  );

  const collapseReplies = useCallback((parentId: string) => {
    setExpandedReplies((prev) => {
      const n = new Set(prev);
      n.delete(parentId);
      return n;
    });
  }, []);

  const requireAuth = useCallback((): CommentAuthor | null => {
    const me = profileRef.current;
    if (!me) {
      toast({ title: 'Sign in required', description: 'Please sign in to join the conversation.', variant: 'destructive' });
      return null;
    }
    return me;
  }, [toast]);

  const reportError = useCallback(
    (err: unknown, fallback: string) => {
      if (isServerRateLimitError(err)) {
        toast({ title: 'Slow down', description: SERVER_RATE_LIMIT_MESSAGE, variant: 'destructive' });
      } else {
        toast({ title: fallback, description: err instanceof Error ? err.message : fallback, variant: 'destructive' });
      }
    },
    [toast],
  );

  const addComment = useCallback(
    async (input: CommentInput) => {
      const me = requireAuth();
      if (!me) return false;
      const content = input.text.trim();
      const imageUrl = input.imageUrl ?? null;
      if (!content && !imageUrl) return false;
      if (inFlight.current.has('new')) return false;
      inFlight.current.add('new');

      const id = newId();
      const optimistic: CommentNode = {
        id, postId, authorId: me.id, content, imageUrl,
        createdAt: new Date().toISOString(), isEdited: false, parentId: null,
        author: me, reactions: emptySummary(), pending: true,
      };
      setTopLevel((prev) => [optimistic, ...prev]);
      setCount((c) => c + 1);

      try {
        const { error } = await supabase
          .from('comments')
          .insert({ id, post_id: postId, user_id: me.id, content, image_url: imageUrl });
        if (error) throw error;
        setTopLevel((prev) => prev.map((n) => (n.id === id ? { ...n, pending: false } : n)));
        return true;
      } catch (err) {
        console.error('Error adding comment:', err);
        setTopLevel((prev) => prev.filter((n) => n.id !== id));
        setCount((c) => Math.max(0, c - 1));
        reportError(err, 'Could not add comment');
        return false;
      } finally {
        inFlight.current.delete('new');
      }
    },
    [postId, requireAuth, reportError],
  );

  const addReply = useCallback(
    async (parentId: string, input: CommentInput) => {
      const me = requireAuth();
      if (!me) return false;
      const content = input.text.trim();
      const imageUrl = input.imageUrl ?? null;
      if (!content && !imageUrl) return false;
      const key = `reply-${parentId}`;
      if (inFlight.current.has(key)) return false;
      inFlight.current.add(key);

      const id = newId();
      const optimistic: CommentNode = {
        id, postId, authorId: me.id, content, imageUrl,
        createdAt: new Date().toISOString(), isEdited: false, parentId,
        author: me, reactions: emptySummary(), pending: true,
      };
      setExpandedReplies((prev) => new Set(prev).add(parentId));
      setRepliesByParent((prev) => ({ ...prev, [parentId]: [...(prev[parentId] || []), optimistic] }));
      setReplyCount((prev) => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 }));
      setCount((c) => c + 1);

      try {
        const { error } = await supabase
          .from('comments')
          .insert({ id, post_id: postId, user_id: me.id, content, image_url: imageUrl, parent_comment_id: parentId });
        if (error) throw error;
        setRepliesByParent((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] || []).map((n) => (n.id === id ? { ...n, pending: false } : n)),
        }));
        return true;
      } catch (err) {
        console.error('Error adding reply:', err);
        setRepliesByParent((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] || []).filter((n) => n.id !== id),
        }));
        setReplyCount((prev) => ({ ...prev, [parentId]: Math.max(0, (prev[parentId] || 1) - 1) }));
        setCount((c) => Math.max(0, c - 1));
        reportError(err, 'Could not post reply');
        return false;
      } finally {
        inFlight.current.delete(key);
      }
    },
    [postId, requireAuth, reportError],
  );

  const patchNode = useCallback(
    (commentId: string, parentId: string | null, patch: (n: CommentNode) => CommentNode) => {
      if (parentId) {
        setRepliesByParent((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] || []).map((n) => (n.id === commentId ? patch(n) : n)),
        }));
      } else {
        setTopLevel((prev) => prev.map((n) => (n.id === commentId ? patch(n) : n)));
      }
    },
    [],
  );

  const findNode = useCallback((commentId: string): CommentNode | undefined => {
    return (
      topLevelRef.current.find((n) => n.id === commentId) ||
      Object.values(repliesRef.current).flat().find((n) => n.id === commentId)
    );
  }, []);

  const editComment = useCallback(
    async (commentId: string, text: string) => {
      const me = requireAuth();
      if (!me) return false;
      const content = text.trim();
      if (!content) return false;
      const key = `edit-${commentId}`;
      if (inFlight.current.has(key)) return false;
      inFlight.current.add(key);

      const target = findNode(commentId);
      if (!target) { inFlight.current.delete(key); return false; }
      // "Save" with no real change (incl. only mention-token normalisation) is
      // a no-op -- no write, no "(edited)" tag, no notifications.
      if (canonicalContent(target.content) === canonicalContent(content)) {
        inFlight.current.delete(key);
        return true;
      }
      const prevContent = target.content;
      patchNode(commentId, target.parentId, (n) => ({ ...n, content, isEdited: true }));

      try {
        const { error } = await supabase
          .from('comments')
          .update({ content })
          .eq('id', commentId)
          .eq('user_id', me.id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error('Error editing comment:', err);
        patchNode(commentId, target.parentId, (n) => ({ ...n, content: prevContent }));
        reportError(err, 'Could not save changes');
        return false;
      } finally {
        inFlight.current.delete(key);
      }
    },
    [requireAuth, reportError, patchNode, findNode],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      const me = requireAuth();
      if (!me) return false;
      const key = `del-${commentId}`;
      if (inFlight.current.has(key)) return false;
      inFlight.current.add(key);

      const isTopLevel = topLevelRef.current.some((n) => n.id === commentId);
      const parentId = isTopLevel
        ? null
        : Object.keys(repliesRef.current).find((pid) =>
            (repliesRef.current[pid] || []).some((n) => n.id === commentId),
          ) || null;

      const prevTop = topLevelRef.current;
      const prevReplies = repliesRef.current;
      const prevReplyCount = replyCount;
      const removedReplies = isTopLevel ? (repliesRef.current[commentId] || []).length : 0;

      if (isTopLevel) {
        setTopLevel((prev) => prev.filter((n) => n.id !== commentId));
        setRepliesByParent((prev) => {
          const n = { ...prev };
          delete n[commentId];
          return n;
        });
        setCount((c) => Math.max(0, c - 1 - removedReplies));
      } else if (parentId) {
        setRepliesByParent((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] || []).filter((n) => n.id !== commentId),
        }));
        setReplyCount((prev) => ({ ...prev, [parentId]: Math.max(0, (prev[parentId] || 1) - 1) }));
        setCount((c) => Math.max(0, c - 1));
      }

      try {
        const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('user_id', me.id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error('Error deleting comment:', err);
        setTopLevel(prevTop);
        setRepliesByParent(prevReplies);
        setReplyCount(prevReplyCount);
        setCount((c) => c + 1 + removedReplies);
        reportError(err, 'Could not delete comment');
        return false;
      } finally {
        inFlight.current.delete(key);
      }
    },
    [replyCount, requireAuth, reportError],
  );

  const reactToComment = useCallback(
    async (commentId: string, type: ReactionType | null) => {
      const me = requireAuth();
      if (!me) return;
      const target = findNode(commentId);
      if (!target || target.pending) return;
      const parentId = target.parentId;
      const prevSummary = target.reactions;

      const nextSummary: ReactionSummary = (() => {
        const reactions = { ...prevSummary.reactions };
        const had = prevSummary.user_reaction;
        if (had) reactions[had] = Math.max(0, (reactions[had] || 0) - 1);
        if (type) reactions[type] = (reactions[type] || 0) + 1;
        const total = Object.values(reactions).reduce((s, v) => s + (v || 0), 0);
        return { total_reactions: total, user_reaction: type, reactions };
      })();
      patchNode(commentId, parentId, (n) => ({ ...n, reactions: nextSummary }));

      try {
        if (type === null) {
          const { error } = await supabase
            .from('comment_reactions')
            .delete()
            .eq('comment_id', commentId)
            .eq('user_id', me.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('comment_reactions')
            .upsert({ comment_id: commentId, user_id: me.id, reaction_type: type }, { onConflict: 'user_id,comment_id' });
          if (error) throw error;
        }
      } catch (err) {
        console.error('Error reacting to comment:', err);
        patchNode(commentId, parentId, (n) => ({ ...n, reactions: prevSummary }));
        reportError(err, 'Could not update your reaction');
      }
    },
    [requireAuth, reportError, patchNode, findNode],
  );

  // --- Realtime: only while the section is open, scoped to this post -------
  const reactionRefreshTimer = useRef<ReturnType<typeof setTimeout>>();

  /** Rebuild reaction summaries for the given comment ids (or every loaded
   *  comment when `ids` is omitted -- used when a reaction DELETE event, which
   *  carries only the PK, gives us no comment_id to target). */
  const refreshReactionsFor = useCallback(
    (ids?: string[]) => {
      if (reactionRefreshTimer.current) clearTimeout(reactionRefreshTimer.current);
      reactionRefreshTimer.current = setTimeout(async () => {
        const targetIds =
          ids && ids.length
            ? ids
            : [
                ...topLevelRef.current.map((n) => n.id),
                ...Object.values(repliesRef.current).flat().map((n) => n.id),
              ];
        const known = targetIds.filter((id) => findNode(id));
        if (known.length === 0) return;
        const myId = profileRef.current?.id ?? null;
        const rows = await fetchReactions(known);
        const byComment = new Map<string, RawReaction[]>();
        rows.forEach((r) => {
          const arr = byComment.get(r.comment_id) || [];
          arr.push(r);
          byComment.set(r.comment_id, arr);
        });
        known.forEach((id) => {
          const node = findNode(id);
          if (!node) return;
          const summary = buildReactionSummary(
            (byComment.get(id) || []).map((r) => ({ user_id: r.user_id, reaction_type: r.reaction_type })),
            myId,
          );
          patchNode(id, node.parentId, (n) => ({ ...n, reactions: summary }));
        });
      }, 180);
    },
    [fetchReactions, findNode, patchNode],
  );

  useEffect(() => {
    if (!loaded) return;

    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        async (payload) => {
          const row = payload.new as RawComment;
          const myProfileId = profileRef.current?.id ?? null;

          if (!row.parent_comment_id) {
            if (topLevelRef.current.some((n) => n.id === row.id)) return; // our own / dupe
            const profiles = await fetchProfiles([row.user_id]);
            const [node] = enrich([row], profiles, [], myProfileId);
            setTopLevel((prev) => {
              if (prev.some((n) => n.id === row.id)) return prev;
              const next = [node, ...prev];
              // "recent" is newest-first, so prepend is already correct.
              // "relevant": drop it straight into its ranked slot -- never a
              // blind prepend-then-jump.
              if (sortRef.current !== 'relevant') return next;
              const now = Date.now();
              return [...next].sort((a, b) => compareForRelevance(rankableOf(a), rankableOf(b), now));
            });
            setCount((c) => c + 1);
          } else {
            const parentId = row.parent_comment_id;
            const known = topLevelRef.current.some((n) => n.id === parentId);
            if (!known) return;
            setReplyCount((prev) => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 }));
            setCount((c) => c + 1);
            if (expandedRef.current.has(parentId)) {
              if ((repliesRef.current[parentId] || []).some((n) => n.id === row.id)) return;
              const profiles = await fetchProfiles([row.user_id]);
              const [node] = enrich([row], profiles, [], myProfileId);
              setRepliesByParent((prev) => {
                const list = prev[parentId] || [];
                if (list.some((n) => n.id === row.id)) return prev;
                return { ...prev, [parentId]: [...list, node] };
              });
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        (payload) => {
          const row = payload.new as RawComment;
          const node = findNode(row.id);
          if (!node) return;
          patchNode(row.id, node.parentId, (n) => ({
            ...n,
            content: row.content,
            imageUrl: row.image_url,
            isEdited: row.is_edited,
          }));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments' },
        (payload) => {
          // Supabase only sends the primary key in `old` for DELETE, so we
          // route purely by id: if it's in our loaded set it belongs here.
          const old = payload.old as Partial<RawComment>;
          if (!old.id) return;
          // Our own in-progress delete already updated the UI optimistically.
          if (inFlight.current.has(`del-${old.id}`)) return;
          if (topLevelRef.current.some((n) => n.id === old.id)) {
            const removedReplies = (repliesRef.current[old.id] || []).length;
            setTopLevel((prev) => prev.filter((n) => n.id !== old.id));
            setRepliesByParent((prev) => {
              const n = { ...prev };
              delete n[old.id as string];
              return n;
            });
            setCount((c) => Math.max(0, c - 1 - removedReplies));
          } else {
            const parentId = Object.keys(repliesRef.current).find((pid) =>
              (repliesRef.current[pid] || []).some((n) => n.id === old.id),
            );
            if (!parentId) return;
            setRepliesByParent((prev) => ({
              ...prev,
              [parentId]: (prev[parentId] || []).filter((n) => n.id !== old.id),
            }));
            setReplyCount((prev) => ({ ...prev, [parentId]: Math.max(0, (prev[parentId] || 1) - 1) }));
            setCount((c) => Math.max(0, c - 1));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_reactions' },
        (payload) => {
          // INSERT/UPDATE carry comment_id; DELETE carries only the PK, so
          // fall back to refreshing every loaded comment's reactions.
          const rec = payload.new as Partial<RawReaction> | null;
          if (rec?.comment_id) refreshReactionsFor([rec.comment_id]);
          else refreshReactionsFor();
        },
      )
      .subscribe();

    return () => {
      if (reactionRefreshTimer.current) clearTimeout(reactionRefreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [loaded, postId, enrich, fetchProfiles, findNode, patchNode, refreshReactionsFor, rankableOf]);

  return {
    currentProfileId,
    currentUserId,
    currentAuthor,
    count,
    topLevel,
    repliesByParent,
    replyCount,
    hasMoreTopLevel,
    loading,
    loadingMore,
    expandedReplies,
    loaded,
    sort,
    setSort,
    load,
    loadMoreTopLevel,
    loadReplies,
    collapseReplies,
    addComment,
    addReply,
    editComment,
    deleteComment,
    reactToComment,
  };
}
