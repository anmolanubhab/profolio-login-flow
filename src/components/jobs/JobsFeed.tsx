import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { JobCard } from './JobCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  employment_type: string;
  posted_at: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  companies: {
    name: string;
    logo_url?: string;
  };
}

interface JobsFeedProps {
  onApply: (jobId: string) => void;
  onViewDetails: (jobId: string) => void;
  appliedJobIds: Set<string>;
}

export const JobsFeed = ({ onApply, onViewDetails, appliedJobIds }: JobsFeedProps) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          companies (
            name,
            logo_url
          )
        `)
        .eq('status', 'open')
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No job openings yet</h3>
        <p className="text-sm text-muted-foreground">
          Check back later for new opportunities
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={{
            ...job,
            company: job.companies
          }}
          onApply={onApply}
          onViewDetails={onViewDetails}
          isApplied={appliedJobIds.has(job.id)}
        />
      ))}
    </div>
  );
};
