
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Applicant {
  id: string; // application id
  user_id: string;
  job_id: string;
  resume_id?: string;
  cover_note?: string;
  status: 'applied' | 'viewed' | 'shortlisted' | 'rejected';
  created_at: string;
  profile: {
    full_name: string;
    avatar_url?: string;
    email?: string;
  };
  resume?: {
    id: string;
    title: string;
    file_url?: string;
  };
}

export const useJobApplicants = (jobId: string) => {
  const queryClient = useQueryClient();

  const { data: applicants, isLoading } = useQuery({
    queryKey: ['job-applicants', jobId],
    queryFn: async ({ signal }) => {
      // 1. Fetch applications
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          profile:profiles!job_applications_user_id_fkey(full_name, avatar_url, email),
          resume:resumes(id, title, file_url)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return [];
        throw error;
      }
      return data as any as Applicant[];
    },
    enabled: !!jobId
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: Applicant['status'] }) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ status })
        .eq('id', applicationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applicants', jobId] });
    }
  });

  return {
    applicants,
    isLoading,
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending
  };
};
