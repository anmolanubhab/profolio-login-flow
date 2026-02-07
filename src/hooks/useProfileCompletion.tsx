import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface CompletionItem {
  id: string;
  label: string;
  isComplete: boolean;
  weight: number;
  actionUrl: string;
  actionLabel: string;
}

export interface ProfileCompletion {
  percentage: number;
  isComplete: boolean; // Threshold e.g. 90%
  items: CompletionItem[];
  missingItems: CompletionItem[];
}

export const useProfileCompletion = (): ProfileCompletion & { isLoading: boolean } => {
  const { user, profile } = useAuth();

  const { data: counts, isLoading: isLoadingCounts } = useQuery({
    queryKey: ['profile-completion-counts', user?.id],
    queryFn: async () => {
      if (!user?.id) return { experience: 0, education: 0, certificates: 0, resumes: 0 };

      // Parallel fetch for counts
      const [exp, edu, cert, res] = await Promise.all([
        supabase.from('experience').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('education').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('resumes').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      ]);

      return {
        experience: exp.count || 0,
        education: edu.count || 0,
        certificates: cert.count || 0,
        resumes: res.count || 0
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  if (!profile || !counts) {
    return {
      percentage: 0,
      isComplete: false,
      items: [],
      missingItems: [],
      isLoading: isLoadingCounts
    };
  }

  // Define criteria and weights
  // Total weight should sum to 100
  const criteria: CompletionItem[] = [
    {
      id: 'photo',
      label: 'Profile Photo',
      isComplete: !!(profile.avatar_url || profile.photo_url),
      weight: 15,
      actionUrl: '/profile',
      actionLabel: 'Add photo'
    },
    {
      id: 'headline',
      label: 'Headline / Bio',
      isComplete: !!(profile.profession || profile.bio),
      weight: 10,
      actionUrl: '/profile',
      actionLabel: 'Add headline'
    },
    {
      id: 'location',
      label: 'Location',
      isComplete: !!profile.location,
      weight: 5,
      actionUrl: '/profile',
      actionLabel: 'Add location'
    },
    {
      id: 'skills',
      label: 'Skills',
      isComplete: !!(profile.skills && profile.skills.length > 0),
      weight: 15,
      actionUrl: '/profile',
      actionLabel: 'Add skills'
    },
    {
      id: 'experience',
      label: 'Work Experience',
      isComplete: counts.experience > 0,
      weight: 15,
      actionUrl: '/profile',
      actionLabel: 'Add experience'
    },
    {
      id: 'education',
      label: 'Education',
      isComplete: counts.education > 0,
      weight: 10,
      actionUrl: '/profile',
      actionLabel: 'Add education'
    },
    {
      id: 'resume',
      label: 'Resume',
      isComplete: counts.resumes > 0,
      weight: 10,
      actionUrl: '/resume',
      actionLabel: 'Upload resume'
    },
    {
      id: 'certificates',
      label: 'Certificates',
      isComplete: counts.certificates > 0,
      weight: 10,
      actionUrl: '/certificates', // Assuming this route exists or we'll direct to profile where it might be
      actionLabel: 'Add certificate'
    },
    {
      id: 'preferences',
      label: 'Account Preferences',
      isComplete: !!(profile.preferences && Object.keys(profile.preferences as object).length > 0),
      weight: 10,
      actionUrl: '/settings/account',
      actionLabel: 'Update preferences'
    }
  ];

  // Calculate percentage
  const totalWeight = criteria.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = criteria.reduce((sum, item) => item.isComplete ? sum + item.weight : sum, 0);
  const percentage = Math.round((completedWeight / totalWeight) * 100);

  const missingItems = criteria.filter(item => !item.isComplete);

  return {
    percentage,
    isComplete: percentage >= 90, // Hide if >= 90%
    items: criteria,
    missingItems,
    isLoading: isLoadingCounts
  };
};
