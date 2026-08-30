import { useCallback, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { setFollowState } from '@/lib/followStore';
import { NETWORK_PAGE_SIZE, maskName, personName, type NetworkPerson } from '@/lib/network';
import { useCurrentProfileId } from './useCurrentProfileId';

export type FollowsKind = 'following' | 'followers';

function mapRow(row: any): NetworkPerson {
  const isConnected = !!row.is_connected;
  return {
    id: row.profile_id,
    user_id: row.profile_id, // route params use profile id
    display_name: maskName(row.display_name, row.last_name_visibility, isConnected),
    full_name: row.full_name ?? null,
    headline: row.headline ?? null,
    profession: row.profession ?? null,
    location: row.location ?? null,
    avatar_url: row.avatar_url ?? null,
    mutual_count: row.mutual_count ?? 0,
    followed_at: row.followed_at ?? null,
    they_follow_me: row.they_follow_me ?? undefined,
    i_follow_them: row.i_follow_them ?? undefined,
  };
}

/**
 * Server-paginated Following / Followers list, backed by the list_following /
 * list_followers RPCs. `follow` / `unfollow` reuse the exact followers-table +
 * new_follower-notification flow used everywhere else (PublicProfile,
 * SuggestedFollowControl), and push the result through the shared followStore
 * so every other mounted follow control for that person updates too.
 */
export function useFollowsList(kind: FollowsKind, search: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: myProfileId } = useCurrentProfileId();
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const rpc = kind === 'following' ? 'list_following' : 'list_followers';

  const query = useInfiniteQuery({
    queryKey: ['follows-list', kind, myProfileId, search],
    enabled: !!myProfileId,
    initialPageParam: 0,
    staleTime: 15 * 1000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc(rpc, {
        search,
        lim: NETWORK_PAGE_SIZE,
        off: pageParam as number,
      });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === NETWORK_PAGE_SIZE ? allPages.length * NETWORK_PAGE_SIZE : undefined,
  });

  const people = query.data?.pages.flat() ?? [];

  const setBusy = (id: string, on: boolean) =>
    setBusyIds((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Patch one person's relationship flag across every cached page of this list. */
  const patchPerson = useCallback(
    (id: string, patch: Partial<NetworkPerson>) => {
      const key = ['follows-list', kind, myProfileId, search];
      queryClient.setQueryData(key, (curr: any) => {
        if (!curr) return curr;
        return {
          ...curr,
          pages: curr.pages.map((page: NetworkPerson[]) =>
            page.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          ),
        };
      });
    },
    [kind, myProfileId, search, queryClient],
  );

  const removeFromCache = useCallback(
    (id: string) => {
      const key = ['follows-list', kind, myProfileId, search];
      queryClient.setQueryData(key, (curr: any) => {
        if (!curr) return curr;
        return {
          ...curr,
          pages: curr.pages.map((page: NetworkPerson[]) => page.filter((p) => p.id !== id)),
        };
      });
    },
    [kind, myProfileId, search, queryClient],
  );

  const follow = useCallback(
    async (person: NetworkPerson) => {
      if (!myProfileId || busyIds.has(person.id)) return;
      setBusy(person.id, true);
      // optimistic: on the followers list this flips the button to "Following"
      if (kind === 'followers') patchPerson(person.id, { i_follow_them: true });
      setFollowState(person.id, false, true);
      try {
        const { error } = await supabase
          .from('followers')
          .insert({ follower_id: myProfileId, following_id: person.id });
        if (error && error.code !== '23505') throw error;
        // Same client-side notification insert used by PublicProfile /
        // SuggestedFollowControl (RLS allows type 'new_follower' when the
        // payload follower_id is the caller's own profile id).
        await supabase.from('notifications').insert({
          user_id: person.id,
          type: 'new_follower',
          payload: { follower_id: myProfileId },
        });
        queryClient.invalidateQueries({ queryKey: ['follow-counts'] });
        toast({ title: `Following ${personName(person)}` });
      } catch (err: any) {
        if (kind === 'followers') patchPerson(person.id, { i_follow_them: false });
        setFollowState(person.id, false, false);
        toast({
          title: "Couldn't follow",
          description: err?.message ?? 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setBusy(person.id, false);
      }
    },
    [myProfileId, busyIds, kind, patchPerson, queryClient, toast],
  );

  const unfollow = useCallback(
    async (person: NetworkPerson) => {
      if (!myProfileId || busyIds.has(person.id)) return;
      setBusy(person.id, true);

      const key = ['follows-list', kind, myProfileId, search];
      const previous = queryClient.getQueryData(key);
      if (kind === 'following') removeFromCache(person.id);
      else patchPerson(person.id, { i_follow_them: false });
      setFollowState(person.id, false, false);

      try {
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', myProfileId)
          .eq('following_id', person.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['follow-counts'] });
        toast({ title: `Unfollowed ${personName(person)}` });
      } catch (err: any) {
        queryClient.setQueryData(key, previous);
        setFollowState(person.id, false, true);
        toast({
          title: "Couldn't unfollow",
          description: err?.message ?? 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setBusy(person.id, false);
      }
    },
    [myProfileId, busyIds, kind, search, queryClient, patchPerson, removeFromCache, toast],
  );

  return {
    people,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isBusy: (id: string) => busyIds.has(id),
    follow,
    unfollow,
  };
}
