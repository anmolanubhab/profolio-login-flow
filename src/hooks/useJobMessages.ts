
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface JobMessage {
  id: string;
  job_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export const useJobMessages = (jobId: string, correspondentId: string) => {
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ['job-messages', jobId, correspondentId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('job_messages')
        .select('*')
        .eq('job_id', jobId)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .or(`sender_id.eq.${correspondentId},receiver_id.eq.${correspondentId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Client-side filtering to ensure we only get messages between these two people
      // The OR query above might return messages where I am sender but receiver is someone else if not careful
      // But with AND logic it should be fine.
      // Actually, Supabase .or() is tricky.
      // Let's rely on the fact that we want messages where:
      // (sender = me AND receiver = other) OR (sender = other AND receiver = me)
      // AND job_id = job_id
      
      return data.filter(m => 
        (m.sender_id === user.id && m.receiver_id === correspondentId) ||
        (m.sender_id === correspondentId && m.receiver_id === user.id)
      ) as JobMessage[];
    },
    enabled: !!jobId && !!correspondentId,
    refetchInterval: 5000 // Poll every 5s
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('job_messages')
        .insert({
          job_id: jobId,
          sender_id: user.id,
          receiver_id: correspondentId,
          content
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-messages', jobId, correspondentId] });
    }
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('job_messages')
        .update({ read: true })
        .eq('job_id', jobId)
        .eq('sender_id', correspondentId)
        .eq('receiver_id', user.id)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-messages', jobId, correspondentId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] }); // Update badge
    }
  });

  return {
    messages,
    isLoading,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    markAsRead: markReadMutation.mutate
  };
};
