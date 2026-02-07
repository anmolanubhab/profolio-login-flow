
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { JobMessage } from './useJobMessages';

export interface Conversation {
  jobId: string;
  correspondentId: string;
  correspondentName: string;
  correspondentAvatar?: string;
  jobTitle: string;
  companyName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export const useJobConversations = () => {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['job-conversations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch all messages involving the user
      const { data: messages, error } = await supabase
        .from('job_messages')
        .select(`
          *,
          job:jobs(id, title, company_name),
          sender:profiles!job_messages_sender_id_fkey(full_name, avatar_url),
          receiver:profiles!job_messages_receiver_id_fkey(full_name, avatar_url)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by Job + Correspondent
      const grouped = new Map<string, Conversation>();

      messages.forEach((msg: any) => {
        const isSender = msg.sender_id === user.id;
        const correspondentId = isSender ? msg.receiver_id : msg.sender_id;
        const correspondent = isSender ? msg.receiver : msg.sender;
        const key = `${msg.job_id}-${correspondentId}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            jobId: msg.job_id,
            correspondentId,
            correspondentName: correspondent?.full_name || 'Unknown User',
            correspondentAvatar: correspondent?.avatar_url,
            jobTitle: msg.job?.title || 'Unknown Job',
            companyName: msg.job?.company_name || 'Unknown Company',
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unreadCount: 0
          });
        }

        const conv = grouped.get(key)!;
        if (!isSender && !msg.read) {
          conv.unreadCount++;
        }
      });

      return Array.from(grouped.values());
    },
    refetchInterval: 10000 // Poll every 10s
  });

  return {
    conversations,
    isLoading
  };
};
