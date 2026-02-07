
import { JobCard } from './JobCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { useJobFeed } from '@/hooks/useJobFeed';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { JobFiltersState } from './JobFilters';

interface JobsFeedProps {
  onApply?: (job: any) => void;
  onViewDetails: (job: any) => void;
  onEdit?: (job: any) => void;
  onDelete?: (jobId: string) => void;
  onToggleSave?: (jobId: string) => void;
  appliedJobIds?: Set<string>;
  savedJobIds?: Set<string>;
  readOnly?: boolean;
  filters?: JobFiltersState;
  userProfileId?: string;
  jobs?: any[]; // Allow overriding jobs source (e.g. for Saved Jobs page)
}

export const JobsFeed = ({ 
  onApply, 
  onViewDetails, 
  onEdit,
  onDelete,
  onToggleSave,
  appliedJobIds = new Set(), 
  savedJobIds = new Set(),
  readOnly = false, 
  filters,
  userProfileId,
  jobs: explicitJobs
}: JobsFeedProps) => {
  const { jobs: feedJobs, isLoading, hasPreferences } = useJobFeed();
  
  // Use explicit jobs if provided (e.g. for Saved Jobs page), otherwise use feed jobs
  const jobs = explicitJobs || feedJobs;

  // Apply manual filters on top of the personalized feed
  const filteredJobs = jobs?.filter(job => {
    if (!filters) return true;

    const matchesSearch = !filters.search || 
      job.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      job.company_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      job.description?.toLowerCase().includes(filters.search.toLowerCase());

    const matchesCompany = !filters.companyId || job.company_id === filters.companyId;
    
    const matchesLocation = !filters.location || 
      (filters.location === 'Remote' ? job.remote_option === 'remote' : job.location?.includes(filters.location));

    const matchesType = !filters.employmentType || job.employment_type === filters.employmentType;

    return matchesSearch && matchesCompany && matchesLocation && matchesType;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!filteredJobs || filteredJobs.length === 0) {
    // Distinguish between "No jobs match preferences" vs "No jobs match manual filters"
    // If filters are active, show "No results found"
    const hasActiveFilters = filters && (filters.search || filters.companyId || filters.location || filters.employmentType);

    if (hasActiveFilters) {
      return (
         <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
             <SearchIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No matches found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Try adjusting your search or filters to find what you're looking for.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
           <AlertCircle className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {hasPreferences ? "No jobs match your preferences" : "No jobs available"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {hasPreferences 
            ? "Try updating your job preferences to see more opportunities." 
            : "Check back later for new opportunities."}
        </p>
        {hasPreferences && (
          <Button asChild variant="outline">
            <Link to="/jobs/preferences" className="gap-2">
              Update Preferences
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredJobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onApply={onApply}
          onViewDetails={onViewDetails}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleSave={onToggleSave}
          isApplied={appliedJobIds.has(job.id)}
          isSaved={savedJobIds.has(job.id)}
          readOnly={readOnly}
          currentUserId={userProfileId}
        />
      ))}
    </div>
  );
};

function SearchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
