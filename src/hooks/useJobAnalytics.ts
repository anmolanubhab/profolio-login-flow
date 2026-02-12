
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JobAnalytics {
  views: number;
  total_applications: number;
  shortlisted: number;
  rejected: number;
  messages_sent: number;
}

export const useJobAnalytics = (jobId: string | undefined) => {
  return useQuery({
    queryKey: ['job-analytics', jobId],
    queryFn: async ({ signal }) => {
      if (!jobId) throw new Error('Job ID is required');
      
      const { data, error } = await supabase.rpc('get_job_analytics', {
        p_job_id: jobId
      }).abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return null;
        throw error;
      }

      return data as JobAnalytics;
    },
    enabled: !!jobId,
    refetchInterval: 10000, // Poll every 10 seconds for near real-time updates
  });
};
