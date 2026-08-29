import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfileId } from './useCurrentProfileId';

export interface NetworkCounts {
  connections_count: number;
  pending_received: number;
  pending_sent: number;
}

const EMPTY: NetworkCounts = {
  connections_count: 0,
  pending_received: 0,
  pending_sent: 0,
};

/** Left-rail counts (connections + pending invitations), fetched in one RPC call. */
export function useNetworkCounts() {
  const { data: myProfileId } = useCurrentProfileId();

  const query = useQuery({
    queryKey: ['network-counts', myProfileId],
    enabled: !!myProfileId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<NetworkCounts> => {
      const { data, error } = await supabase.rpc('network_counts');
      if (error) throw error;
      return data?.[0] ?? EMPTY;
    },
  });

  return { ...query, counts: query.data ?? EMPTY };
}
