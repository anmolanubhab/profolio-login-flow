
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInDays, parseISO } from 'date-fns';

export interface Job {
  id: string;
  title: string;
  company_name: string;
  company_id?: string;
  description: string;
  requirements: string;
  location: string;
  employment_type: string;
  remote_option: string;
  apply_link: string;
  salary_min: number;
  salary_max: number;
  currency: string;
  posted_at: string;
  posted_by: string;
  status: string;
  experience_level?: string; // Added via migration
  company?: {
    name: string;
    logo_url: string;
  };
  score?: number;
  matchReasons?: string[];
}

interface JobPreferences {
  roles: string[];
  locations: string[];
  job_type: string[];
  experience_level: string;
}

export const useJobFeed = () => {
  const { user } = useAuth();

  const { data: preferences, isLoading: loadingPrefs } = useQuery({
    queryKey: ['job-preferences', user?.id],
    queryFn: async ({ signal }) => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .abortSignal(signal)
        .single();

      if (error) {
        if (error.code === 'ABORTED') return null;
        throw error;
      }
      return (data?.preferences as any)?.job_preferences as JobPreferences | undefined;
    },
    enabled: !!user?.id,
  });

  const { data: jobs, isLoading: loadingJobs } = useQuery({
    queryKey: ['jobs-feed'],
    queryFn: async ({ signal }) => {
      // Fetch active jobs with company details
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          company:companies(name, logo_url)
        `)
        .eq('status', 'active')
        .order('posted_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return [];
        throw error;
      }
      return data as Job[];
    },
  });

  const scoredJobs = jobs?.map(job => {
    if (!preferences) return { ...job, score: 0, matchReasons: [] };

    let score = 0;
    const matchReasons: string[] = [];

    // 1. Role Match (+10)
    if (preferences.roles?.length > 0) {
      const roleMatch = preferences.roles.some(role => 
        job.title.toLowerCase().includes(role.toLowerCase()) || 
        job.description?.toLowerCase().includes(role.toLowerCase())
      );
      if (roleMatch) {
        score += 10;
        matchReasons.push('Role match');
      }
    }

    // 2. Location Match (+5)
    if (preferences.locations?.length > 0) {
      const locMatch = preferences.locations.some(loc => 
        job.location?.toLowerCase().includes(loc.toLowerCase())
      );
      if (locMatch) {
        score += 5;
        matchReasons.push('Location match');
      }
    }

    // 3. Job Type Match (+3)
    if (preferences.job_type?.length > 0) {
      const typeMatch = preferences.job_type.some(type => {
        const t = type.toLowerCase();
        // Handle "Remote" specifically as it might be in remote_option
        if (t === 'remote' && (job.remote_option === 'remote' || job.remote_option === 'hybrid')) return true;
        // Handle standard types
        if (job.employment_type?.toLowerCase() === t) return true;
        return false;
      });
      if (typeMatch) {
        score += 3;
        matchReasons.push('Type match');
      }
    }

    // 4. Experience Level Match (+3)
    if (preferences.experience_level && job.experience_level) {
      if (preferences.experience_level === job.experience_level) {
        score += 3;
        matchReasons.push('Experience match');
      }
    }

    // 5. Recency Boost
    if (job.posted_at) {
      const daysOld = differenceInDays(new Date(), parseISO(job.posted_at));
      if (daysOld <= 2) {
        score += 5;
        matchReasons.push('New post');
      } else if (daysOld <= 7) {
        score += 3;
      } else if (daysOld <= 14) {
        score += 1;
      }
    }

    return { ...job, score, matchReasons };
  })
  .filter(job => job.score > 0 || !preferences) // Show all if no prefs, otherwise filter by score > 0? 
  // Requirement says "Filter jobs using user preferences". 
  // If user has preferences, we probably only want to show matches.
  // But if matches are few, maybe show others with lower score?
  // Let's stick to showing sorted list, maybe filtering out 0 score if preferences exist.
  .sort((a, b) => (b.score || 0) - (a.score || 0));

  // If user has preferences but no jobs match, we might want to return empty list to trigger "No jobs match" state.
  const finalJobs = preferences ? scoredJobs?.filter(j => (j.score || 0) > 0) : jobs;

  return {
    jobs: finalJobs,
    isLoading: loadingPrefs || loadingJobs,
    hasPreferences: !!preferences && (
      (preferences.roles?.length > 0) || 
      (preferences.locations?.length > 0) ||
      (preferences.job_type?.length > 0)
    )
  };
};
