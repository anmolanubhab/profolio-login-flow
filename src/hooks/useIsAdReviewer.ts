import { useQuery } from '@tanstack/react-query';
import { currentUserIsAdReviewer } from '@/lib/ads/api';

/** Whether the signed-in user can review ads (holds the `admin` app-role). */
export function useIsAdReviewer() {
  return useQuery({
    queryKey: ['is-ad-reviewer'],
    staleTime: 5 * 60 * 1000,
    queryFn: currentUserIsAdReviewer,
  });
}
