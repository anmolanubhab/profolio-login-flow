import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Briefcase, DollarSign, Building2 } from 'lucide-react';

interface JobDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export const JobDetailsDialog = ({ open, onOpenChange, jobId }: JobDetailsDialogProps) => {
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && jobId) {
      fetchJobDetails();
    }
  }, [open, jobId]);

  const fetchJobDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          companies (
            name,
            logo_url,
            location,
            website
          )
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      setJob(data);
    } catch (error) {
      console.error('Error fetching job details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : job ? (
          <>
            <DialogHeader>
              <div className="flex items-start gap-4">
                {job.companies.logo_url ? (
                  <img 
                    src={job.companies.logo_url} 
                    alt={job.companies.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <DialogTitle className="text-2xl">{job.title}</DialogTitle>
                  <DialogDescription className="text-base mt-1">
                    {job.companies.name}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {job.employment_type}
                </Badge>
                {job.remote_option && (
                  <Badge variant="outline">{job.remote_option}</Badge>
                )}
                {job.salary_min && job.salary_max && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {job.currency}{job.salary_min.toLocaleString()} - {job.currency}
                    {job.salary_max.toLocaleString()}
                  </Badge>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Job Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {job.description}
                </p>
              </div>

              {job.requirements && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Requirements</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {job.requirements}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-lg mb-2">About the Company</h3>
                <p className="text-sm text-muted-foreground">
                  {job.companies.name}
                  {job.companies.location && ` • ${job.companies.location}`}
                </p>
                {job.companies.website && (
                  <a 
                    href={job.companies.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Visit website
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          <p>Job not found</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
