import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfileId } from './useCurrentProfileId';

export interface FollowCounts {
  following_count: number;
  followers_count: number;
}

const EMPTY: FollowCounts = { following_count: 0, followers_count: 0 };

/** Following / followers totals for the current user, one RPC call. */
export function useFollowCounts() {
  const { data: myProfileId } = useCurrentProfileId();

  const query = useQuery({
    queryKey: ['follow-counts', myProfileId],
    enabled: !!myProfileId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<FollowCounts> => {
      const { data, error } = await supabase.rpc('follow_counts');
      if (error) throw error;
      return data?.[0] ?? EMPTY;
    },
  });

  return { ...query, counts: query.data ?? EMPTY };
}
