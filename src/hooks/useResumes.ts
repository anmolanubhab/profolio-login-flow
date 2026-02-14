
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
    queryFn: async ({ signal }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (
          error.code === 'ABORTED' ||
          (error as any).name === 'AbortError' ||
          (error as any).code === 20 ||
          (error as any).code === '20'
        ) return [];
        throw error;
      }
      return data as Resume[];
    },
  });
};
