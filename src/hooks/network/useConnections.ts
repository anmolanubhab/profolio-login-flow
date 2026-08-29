import { useCallback, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProfileId } from './useCurrentProfileId';
import { NETWORK_PAGE_SIZE, maskName, personName, type NetworkPerson } from '@/lib/network';

function mapRow(row: any): NetworkPerson {
  return {
    id: row.profile_id,
    user_id: row.profile_id, // RPC returns profile id only; route params use profile id
    // Every row here is an accepted connection, so isConnected = true.
    display_name: maskName(row.display_name, row.last_name_visibility, true),
    full_name: row.full_name ?? null,
    headline: row.headline ?? null,
    profession: row.profession ?? null,
    location: row.location ?? null,
    avatar_url: row.avatar_url ?? null,
    mutual_count: row.mutual_count ?? 0,
    connected_at: row.connected_at ?? null,
  };
}

/**
 * Server-paginated, server-searched connections list.
 * `search` is expected to already be debounced by the caller.
 */
export function useConnections(search: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: myProfileId } = useCurrentProfileId();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const query = useInfiniteQuery({
    queryKey: ['network-connections', myProfileId, search],
    enabled: !!myProfileId,
    initialPageParam: 0,
    staleTime: 15 * 1000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('search_connections', {
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

  const connections = query.data?.pages.flat() ?? [];

  const remove = useCallback(
    async (person: NetworkPerson) => {
      if (removingIds.has(person.id)) return;
      setRemovingIds((s) => new Set(s).add(person.id));

      const key = ['network-connections', myProfileId, search];
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (curr: any) => {
        if (!curr) return curr;
        return {
          ...curr,
          pages: curr.pages.map((page: NetworkPerson[]) =>
            page.filter((p) => p.id !== person.id),
          ),
        };
      });

      try {
        const { error } = await supabase.rpc('remove_connection', {
          other_profile_id: person.id,
        });
        if (error) throw error;
        toast({
          title: 'Connection removed',
          description: `You are no longer connected with ${personName(person)}.`,
        });
        queryClient.invalidateQueries({ queryKey: ['network-counts'] });
        queryClient.invalidateQueries({ queryKey: ['network-connections'] });
      } catch (err: any) {
        queryClient.setQueryData(key, previous);
        toast({
          title: "Couldn't remove connection",
          description: err.message ?? 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setRemovingIds((s) => {
          const next = new Set(s);
          next.delete(person.id);
          return next;
        });
      }
    },
    [removingIds, myProfileId, search, queryClient, toast],
  );

  return {
    connections,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isRemoving: (id: string) => removingIds.has(id),
    remove,
  };
}
