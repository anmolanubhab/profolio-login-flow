
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Resume {
  id: string;
  title: string;
  content: any;
  file_url?: string; // For PDF uploads
  visibility: 'everyone' | 'recruiters' | 'only_me';
  created_at: string;
  updated_at: string;
  user_id: string;
}

export const useResumes = () => {
  return useQuery({
    queryKey: ['resumes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Resume[];
    },
  });
};
