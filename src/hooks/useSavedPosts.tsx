import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useSavedPosts = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileId = profile?.id;

  const { data: savedPostIds, isLoading } = useQuery({
    queryKey: ['saved-posts', profileId],
    queryFn: async ({ signal }) => {
      if (!profileId) return new Set<string>();

      const { data, error } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', profileId)
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return new Set<string>();
        console.error('Error fetching saved posts:', error);
        throw error;
      }

      return new Set((data || []).map((item: any) => item.post_id as string));
    },
    enabled: !!profileId,
  });

  const toggleSaveMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!profileId) throw new Error('User profile not found');

      const isSaved = savedPostIds?.has(postId);

      if (isSaved) {
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', profileId)
          .eq('post_id', postId);
        if (error) throw error;
        return { action: 'unsaved', postId };
      } else {
        const { error } = await supabase
          .from('saved_posts')
          .insert({ user_id: profileId, post_id: postId });
        if (error && error.code !== '23505') throw error;
        return { action: 'saved', postId };
      }
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['saved-posts', profileId] });

      const previousSaved = queryClient.getQueryData(['saved-posts', profileId]) as Set<string> | undefined;

      queryClient.setQueryData(['saved-posts', profileId], (old: Set<string> | undefined) => {
        const newSet = new Set(old || []);
        if (newSet.has(postId)) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });

      return { previousSaved };
    },
    onError: (err, _postId, context) => {
      queryClient.setQueryData(['saved-posts', profileId], context?.previousSaved);
      console.error('Error toggling saved post:', err);
      toast({
        title: 'Error',
        description: 'Failed to update saved posts. Please try again.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-posts', profileId] });
    },
  });

  return {
    savedPostIds: savedPostIds || new Set<string>(),
    isLoading,
    toggleSave: toggleSaveMutation.mutate,
    isToggling: toggleSaveMutation.isPending,
  };
};

