
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useJobApplication = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appliedJobIds, isLoading: isLoadingApplications } = useQuery({
    queryKey: ['applied-jobs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Set<string>();

      const { data, error } = await supabase
        .from('job_applications')
        .select('job_id')
        .eq('user_id', user.id);

      if (error) throw error;
      return new Set(data.map(app => app.job_id));
    },
    initialData: new Set<string>(),
  });

  const applyMutation = useMutation({
    mutationFn: async ({ jobId, resumeId, coverNote }: { jobId: string; resumeId?: string; coverNote?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('job_applications')
        .insert({
          user_id: user.id,
          job_id: jobId,
          resume_id: resumeId || null,
          cover_note: coverNote || null,
        });

      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error('You have already applied to this job.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applied-jobs'] });
      toast({
        title: "Application submitted",
        description: "Good luck! Your application has been sent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Application failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    appliedJobIds,
    isLoadingApplications,
    apply: applyMutation.mutate,
    isApplying: applyMutation.isPending,
  };
};
