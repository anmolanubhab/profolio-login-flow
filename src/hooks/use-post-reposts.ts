import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Optional seed values so a parent that already loaded repost data (e.g. the
 * feed query) can render the correct state with no extra round-trip / flicker.
 */
export interface RepostSeed {
  count?: number;
  hasReposted?: boolean;
  myCommentary?: string | null;
}

export interface UsePostRepostsResult {
  repostCount: number;
  hasReposted: boolean;
  myCommentary: string | null;
  /** a mutation is in flight */
  busy: boolean;
  /** current-profile + initial state resolved */
  ready: boolean;
  currentProfileId: string | null;
  /** Create a repost, or (if one exists) update its commentary. Returns success. */
  repost: (commentary?: string | null) => Promise<boolean>;
  /** Remove the current user's repost of this post. Returns success. */
  removeRepost: () => Promise<boolean>;
  /** Re-read counts/state from the database. */
  refresh: () => Promise<void>;
}

/**
 * Reusable client state for the repost relationship between the current user
 * and a single post. The database (`post_reposts`, UNIQUE(user_id, post_id))
 * is the source of truth; this hook keeps an optimistic local mirror and
 * reconciles on error. Works standalone (self-fetches) or seeded from a
 * parent query.
 */
export function usePostReposts(postId: string, seed?: RepostSeed): UsePostRepostsResult {
  const { toast } = useToast();
  const hasSeed = seed !== undefined;

  const [repostCount, setRepostCount] = useState(seed?.count ?? 0);
  const [hasReposted, setHasReposted] = useState(!!seed?.hasReposted);
  const [myCommentary, setMyCommentary] = useState<string | null>(seed?.myCommentary ?? null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  const profileIdRef = useRef<string | null>(null);
  const myRepostIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('post_reposts')
      .select('id, user_id, commentary')
      .eq('post_id', postId);
    if (error || !data) return;
    setRepostCount(data.length);
    const pid = profileIdRef.current;
    const mine = pid ? data.find((r) => r.user_id === pid) : undefined;
    myRepostIdRef.current = mine?.id ?? null;
    setHasReposted(!!mine);
    setMyCommentary(mine?.commentary ?? null);
  }, [postId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let pid: string | null = null;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        pid = profile?.id ?? null;
      }
      if (!active) return;
      profileIdRef.current = pid;
      setCurrentProfileId(pid);

      // Confirm the per-user bits against the DB even when a count seed exists
      // (must be correct after navigating back to the feed).
      if (!hasSeed || pid) {
        await refresh();
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const repost = useCallback(
    async (commentary?: string | null) => {
      const pid = profileIdRef.current;
      if (!pid) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to repost.',
          variant: 'destructive',
        });
        return false;
      }
      if (busy) return false;
      setBusy(true);
      const trimmed = commentary && commentary.trim() ? commentary.trim() : null;

      // Already reposted -> treat as "edit commentary".
      if (hasReposted && myRepostIdRef.current) {
        const prev = myCommentary;
        setMyCommentary(trimmed);
        const { error } = await supabase
          .from('post_reposts')
          .update({ commentary: trimmed })
          .eq('id', myRepostIdRef.current);
        setBusy(false);
        if (error) {
          setMyCommentary(prev);
          toast({ title: 'Could not update repost', description: error.message, variant: 'destructive' });
          return false;
        }
        return true;
      }

      // Optimistic create.
      setHasReposted(true);
      setRepostCount((c) => c + 1);
      setMyCommentary(trimmed);
      const { data, error } = await supabase
        .from('post_reposts')
        .insert({ post_id: postId, user_id: pid, commentary: trimmed })
        .select('id')
        .single();
      setBusy(false);

      if (error) {
        // 23505: a repost already exists (e.g. created in another tab) — reconcile.
        if ((error as { code?: string }).code === '23505') {
          await refresh();
          return true;
        }
        setHasReposted(false);
        setRepostCount((c) => Math.max(0, c - 1));
        setMyCommentary(null);
        toast({ title: 'Could not repost', description: error.message, variant: 'destructive' });
        return false;
      }
      myRepostIdRef.current = data.id;
      return true;
    },
    [busy, hasReposted, myCommentary, postId, refresh, toast],
  );

  const removeRepost = useCallback(async () => {
    const pid = profileIdRef.current;
    if (!pid || busy) return false;
    setBusy(true);

    const prevCommentary = myCommentary;
    setHasReposted(false);
    setRepostCount((c) => Math.max(0, c - 1));
    setMyCommentary(null);

    const { error } = await supabase
      .from('post_reposts')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', pid);
    setBusy(false);

    if (error) {
      setHasReposted(true);
      setRepostCount((c) => c + 1);
      setMyCommentary(prevCommentary);
      toast({ title: 'Could not remove repost', description: error.message, variant: 'destructive' });
      return false;
    }
    myRepostIdRef.current = null;
    return true;
  }, [busy, myCommentary, postId, toast]);

  return {
    repostCount,
    hasReposted,
    myCommentary,
    busy,
    ready,
    currentProfileId,
    repost,
    removeRepost,
    refresh,
  };
}
