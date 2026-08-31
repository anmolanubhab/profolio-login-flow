import { useCallback } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProfileId } from '@/hooks/network/useCurrentProfileId';

/**
 * Shared "Save Post" state, LinkedIn-style.
 *
 * Every post surface (feed, post detail, company page, saved-posts page,
 * insight engagement) renders the same PostCard -> PostOptionsMenu, so the
 * saved state has to be ONE source of truth keyed on `post_id`, not a query
 * per card. This module keeps that source of truth in the React Query cache
 * that App.tsx already provides app-wide:
 *
 *   - `useSavedPostIds`  -> one batched `Set<post_id>` for the current user,
 *                           shared by every card (kills the per-card N+1).
 *   - `useIsPostSaved`   -> derives a single card's boolean from that set.
 *   - `useToggleSavePost`-> optimistic save/unsave with rollback + toast,
 *                           mutating the shared set so every surface (and the
 *                           saved-posts list) updates with no refetch/refresh.
 *   - `useSavedPostsList`-> keyset-paginated list for the /saved-posts page,
 *                           rendering the ORIGINAL posts (never a copy).
 *
 * `saved_posts.user_id` references `profiles.id` (not the auth uid), so every
 * query here keys on the resolved profile id from `useCurrentProfileId`.
 */

const savedIdsKey = (profileId: string | null | undefined) =>
  ['saved-post-ids', profileId ?? 'anon'] as const;
const savedListKey = (profileId: string | null | undefined) =>
  ['saved-posts-list', profileId ?? 'anon'] as const;

// -------------------------------------------------------------------------
// 1. The batched set of saved post ids (shared across every PostCard)
// -------------------------------------------------------------------------
export function useSavedPostIds() {
  const { data: profileId } = useCurrentProfileId();
  return useQuery({
    queryKey: savedIdsKey(profileId),
    enabled: !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', profileId!);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r) => r.post_id));
    },
  });
}

/** Per-card helper: is THIS post saved by the current user? */
export function useIsPostSaved(postId: string) {
  const { data: ids, isLoading } = useSavedPostIds();
  return { isSaved: ids?.has(postId) ?? false, isLoading };
}

// -------------------------------------------------------------------------
// 2. Optimistic save / unsave
// -------------------------------------------------------------------------
export function useToggleSavePost() {
  const { data: profileId } = useCurrentProfileId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async ({ postId, save }: { postId: string; save: boolean }) => {
      if (!profileId) throw new Error('You need to be signed in to save posts.');
      if (save) {
        const { error } = await supabase
          .from('saved_posts')
          .insert({ user_id: profileId, post_id: postId });
        // 23505 = unique_violation: the post is already saved (double-click,
        // second tab). Treat as success -- the desired end state is reached.
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', profileId)
          .eq('post_id', postId);
        if (error) throw error;
      }
    },
    // Optimistically flip the shared set BEFORE the round-trip so every
    // surface (and the saved-posts list, which filters on this set) reacts
    // immediately. Snapshot for rollback.
    onMutate: async ({ postId, save }) => {
      const key = savedIdsKey(profileId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Set<string>>(key);
      const next = new Set(previous ?? []);
      if (save) next.add(postId);
      else next.delete(postId);
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back -- never leave the UI showing a state the DB rejected.
      if (ctx?.previous) {
        queryClient.setQueryData(savedIdsKey(profileId), ctx.previous);
      }
      toast({
        title: 'Failed to update saved post',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
    },
    onSuccess: (_data, { save }) => {
      toast({
        title: save ? 'Post saved successfully' : 'Post removed from Saved Posts',
      });
    },
    onSettled: () => {
      // Reconcile with the server (also refreshes the /saved-posts list).
      queryClient.invalidateQueries({ queryKey: savedIdsKey(profileId) });
      queryClient.invalidateQueries({ queryKey: savedListKey(profileId) });
    },
  });

  const toggleSave = useCallback(
    (postId: string, currentlySaved: boolean) =>
      mutation.mutateAsync({ postId, save: !currentlySaved }),
    [mutation],
  );

  return {
    toggleSave,
    isToggling: mutation.isPending,
    togglingPostId: mutation.isPending ? mutation.variables?.postId : undefined,
  };
}

// -------------------------------------------------------------------------
// 3. The /saved-posts listing -- keyset-paginated, original posts only
// -------------------------------------------------------------------------
const LIST_PAGE_SIZE = 10;

export interface SavedPostRow {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  post_type: string;
  video_url: string | null;
  document_url: string | null;
  document_name: string | null;
  carousel_urls: string[] | null;
  company_id: string | null;
  company_name: string | null;
  company_logo: string | null;
  posted_as: string;
  user_id: string;
  cta_enabled?: boolean;
  cta_label?: string | null;
  cta_url?: string | null;
  cta_open_new_tab?: boolean;
  profiles: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  post_reactions: { id: string; user_id: string; reaction_type: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  polls: any;
  comments?: { count: number }[];
}

export function useSavedPostsList() {
  const { data: profileId } = useCurrentProfileId();

  return useInfiniteQuery({
    queryKey: savedListKey(profileId),
    enabled: !!profileId,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: { nextCursor: string | null }) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      let savedQuery = supabase
        .from('saved_posts')
        .select('post_id, created_at')
        .eq('user_id', profileId!)
        .order('created_at', { ascending: false })
        .limit(LIST_PAGE_SIZE);
      if (pageParam) savedQuery = savedQuery.lt('created_at', pageParam);

      const { data: savedRows, error: savedErr } = await savedQuery;
      if (savedErr) throw savedErr;
      const rows = savedRows ?? [];
      if (rows.length === 0) {
        return { posts: [] as SavedPostRow[], nextCursor: null as string | null };
      }

      const ids = rows.map((r) => r.post_id);

      // The ORIGINAL posts -- same shape the feed fetches. `status=published`
      // silently drops deleted / unpublished posts (graceful handling); the
      // saved_posts row itself is cleaned up by the FK ON DELETE CASCADE.
      const { data: postsData, error: postsErr } = await supabase
        .from('posts')
        .select(`
          *,
          post_reactions (id, user_id, reaction_type),
          comments (count),
          polls (
            id,
            question,
            poll_options ( id, option_text, position ),
            poll_votes ( id, option_id, user_id )
          )
        `)
        .in('id', ids)
        .eq('status', 'published');
      if (postsErr) throw postsErr;

      const userIds = [...new Set((postsData ?? []).map((p) => p.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
      const profilesMap = new Map((profilesData ?? []).map((p) => [p.user_id, p]));

      // Preserve "most recently saved first" -- not whatever order Postgres
      // returned the `.in()` match in.
      const savedOrder = new Map(ids.map((id, idx) => [id, idx]));
      const posts = (postsData ?? [])
        .map((post) => ({ ...post, profiles: profilesMap.get(post.user_id) ?? null }))
        .sort((a, b) => (savedOrder.get(a.id) ?? 0) - (savedOrder.get(b.id) ?? 0)) as unknown as SavedPostRow[];

      return {
        posts,
        nextCursor:
          rows.length === LIST_PAGE_SIZE ? rows[rows.length - 1].created_at : null,
      };
    },
  });
}
