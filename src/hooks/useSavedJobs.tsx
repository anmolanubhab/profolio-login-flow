
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useSavedJobs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedJobIds, isLoading } = useQuery({
    queryKey: ['saved-jobs', user?.id],
    queryFn: async ({ signal }) => {
      if (!user?.id) return new Set<string>();
      
      const { data, error } = await supabase
        .from('saved_jobs')
        .select('job_id')
        .eq('user_id', user.id)
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return new Set<string>();
        console.error('Error fetching saved jobs:', error);
        throw error;
      }

      return new Set(data.map(item => item.job_id));
    },
    enabled: !!user?.id,
  });

  const toggleSaveMutation = useMutation({
    mutationFn: async (jobId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const isSaved = savedJobIds?.has(jobId);

      if (isSaved) {
        const { error } = await supabase
          .from('saved_jobs')
          .delete()
          .eq('user_id', user.id)
          .eq('job_id', jobId);
        if (error) throw error;
        return { action: 'unsaved', jobId };
      } else {
        const { error } = await supabase
          .from('saved_jobs')
          .insert({ user_id: user.id, job_id: jobId });
        if (error) throw error;
        return { action: 'saved', jobId };
      }
    },
    onMutate: async (jobId) => {
      await queryClient.cancelQueries({ queryKey: ['saved-jobs', user?.id] });

      const previousSaved = queryClient.getQueryData(['saved-jobs', user?.id]) as Set<string> | undefined;

      queryClient.setQueryData(['saved-jobs', user?.id], (old: Set<string> | undefined) => {
        const newSet = new Set(old || []);
        if (newSet.has(jobId)) {
          newSet.delete(jobId);
        } else {
          newSet.add(jobId);
        }
        return newSet;
      });

      return { previousSaved };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['saved-jobs', user?.id], context?.previousSaved);
      toast({
        title: "Error",
        description: "Failed to update saved jobs. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs', user?.id] });
    },
  });

  return {
    savedJobIds: savedJobIds || new Set<string>(),
    isLoading,
    toggleSave: toggleSaveMutation.mutate,
    isToggling: toggleSaveMutation.isPending
  };
};
