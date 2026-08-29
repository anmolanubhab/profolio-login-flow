import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves the signed-in auth user to their `profiles.id`, which is the key the
 * connections / friend_requests / followers tables are actually keyed on.
 */
export function useCurrentProfileId() {
  return useQuery({
    queryKey: ['current-profile-id'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data.id as string;
    },
  });
}
