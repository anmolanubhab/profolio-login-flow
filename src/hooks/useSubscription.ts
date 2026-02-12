import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionPlan = 'free' | 'recruiter_pro';

export interface SubscriptionDetails {
  plan: SubscriptionPlan;
  status: string;
  features: {
    canViewExtendedAnalytics: boolean;
    canExportApplicants: boolean;
    canFeatureJobs: boolean;
  };
}

const PLAN_FEATURES = {
  free: {
    canViewExtendedAnalytics: false,
    canExportApplicants: false,
    canFeatureJobs: false,
  },
  recruiter_pro: {
    canViewExtendedAnalytics: true,
    canExportApplicants: true,
    canFeatureJobs: true,
  },
};

export const useSubscription = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async ({ signal }): Promise<SubscriptionDetails> => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_plan, subscription_status')
        .eq('id', user.id)
        .abortSignal(signal)
        .maybeSingle();

      if (error) {
        if (error.code === 'ABORTED') {
          return {
            plan: 'free',
            status: 'active',
            features: PLAN_FEATURES.free,
          };
        }
        console.error('Error fetching subscription:', error);
        // Default to free on error
        return {
          plan: 'free',
          status: 'active',
          features: PLAN_FEATURES.free,
        };
      }

      const plan = (data?.subscription_plan as SubscriptionPlan) || 'free';
      
      return {
        plan,
        status: data?.subscription_status || 'active',
        features: PLAN_FEATURES[plan] || PLAN_FEATURES.free,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
