
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { checkAndGenerateJobAlerts } from '@/services/jobAlerts';
import { useQuery } from '@tanstack/react-query';

export const useJobAlerts = () => {
  // We use useQuery to handle the "check" logic to benefit from caching/deduplication
  // preventing multiple checks in short succession across components.
  useQuery({
    queryKey: ['check-job-alerts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await checkAndGenerateJobAlerts(user.id);
      }
      return true;
    },
    staleTime: 1000 * 60 * 60, // Only check once per hour per session
    refetchOnWindowFocus: false,
    refetchOnMount: true
  });
};
