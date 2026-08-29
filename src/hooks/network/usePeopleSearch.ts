import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfileId } from './useCurrentProfileId';
import { NETWORK_PAGE_SIZE, maskName, type NetworkPerson } from '@/lib/network';
import type { Relationship } from '@/components/network/ConnectButton';

export interface PeopleSearchResult extends NetworkPerson {
  relationship: Relationship;
  request_id: string | null;
}

function mapRow(row: any): PeopleSearchResult {
  const relationship = (row.relationship ?? 'none') as Relationship;
  return {
    id: row.profile_id,
    user_id: row.profile_id,
    display_name: maskName(
      row.display_name,
      row.last_name_visibility,
      relationship === 'connected',
    ),
    full_name: row.full_name ?? null,
    headline: row.headline ?? null,
    profession: row.profession ?? null,
    location: row.location ?? null,
    avatar_url: row.avatar_url ?? null,
    mutual_count: row.mutual_count ?? 0,
    relationship,
    request_id: row.request_id ?? null,
  };
}

/** People directory search for the Grow tab. `search` should be debounced. */
export function usePeopleSearch(search: string) {
  const { data: myProfileId } = useCurrentProfileId();

  const query = useInfiniteQuery({
    queryKey: ['people-search', myProfileId, search],
    enabled: !!myProfileId,
    initialPageParam: 0,
    staleTime: 15 * 1000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('search_people', {
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

  return {
    people: query.data?.pages.flat() ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
