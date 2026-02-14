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
    queryFn: async ({ signal }) => {
      if (!user?.id) return { certificates: 0, resumes: 0, skills: 0, education: 0 };

      const getCount = async (table: string) => {
        try {
          const { count, error } = await supabase
            .from(table as any)
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .abortSignal(signal);
          
          if (error) {
            if (error.code === 'ABORTED') return 0;
            return 0;
          }
          return count || 0;
        } catch (err: any) {
          if (err.name === 'AbortError') return 0;
          return 0;
        }
      };

      // Parallel fetch for counts with error handling
      const [certificates, resumes, skills, education] = await Promise.all([
        getCount('certificates'),
        getCount('resumes'),
        getCount('user_skills'),
        getCount('user_education')
      ]);

      return {
        certificates,
        resumes,
        skills,
        education
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  if (!profile) {
    return {
      percentage: 0,
      isComplete: false,
      items: [],
      missingItems: [],
      isLoading: isLoadingCounts
    };
  }

  // Get experience counts from profile JSON fields
  const experienceCount = Array.isArray(profile.experience) ? profile.experience.length : 0;

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
      isComplete: (counts?.skills || 0) > 0 || !!(profile.skills && profile.skills.length > 0),
      weight: 15,
      actionUrl: '/profile',
      actionLabel: 'Add skills'
    },
    {
      id: 'experience',
      label: 'Work Experience',
      isComplete: experienceCount > 0,
      weight: 15,
      actionUrl: '/profile',
      actionLabel: 'Add experience'
    },
    {
      id: 'education',
      label: 'Education',
      isComplete: (counts?.education || 0) > 0 || (Array.isArray(profile.education) ? profile.education.length : 0) > 0,
      weight: 10,
      actionUrl: '/profile',
      actionLabel: 'Add education'
    },
    {
      id: 'resume',
      label: 'Resume',
      isComplete: (counts?.resumes || 0) > 0,
      weight: 10,
      actionUrl: '/resume',
      actionLabel: 'Upload resume'
    },
    {
      id: 'certificates',
      label: 'Certificates',
      isComplete: (counts?.certificates || 0) > 0,
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
