import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Briefcase, DollarSign, Building2, Globe, Clock, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { statusConfig, ApplicationStatus } from '@/config/applicationStatus';

interface JobDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  isApplied?: boolean;
  onApply?: () => void;
  applicationStatus?: string;
}

export const JobDetailsDialog = ({ 
  open, 
  onOpenChange, 
  jobId, 
  isApplied, 
  onApply,
  applicationStatus
}: JobDetailsDialogProps) => {
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
            id,
            name,
            logo_url,
            location,
            website,
            description,
            industry
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

  const formatSalary = () => {
    if (!job?.salary_min && !job?.salary_max) return null;
    const currency = job.currency || 'USD';
    const min = job.salary_min?.toLocaleString();
    const max = job.salary_max?.toLocaleString();
    if (min && max) return `${currency} ${min} - ${max}`;
    if (min) return `${currency} ${min}+`;
    if (max) return `Up to ${currency} ${max}`;
    return null;
  };

  const hasApplied = isApplied || !!applicationStatus;
  const status = applicationStatus as ApplicationStatus | undefined;
  const config = status ? statusConfig[status] : null;
  const displayStatus = config ? config.label : (applicationStatus ? applicationStatus.charAt(0).toUpperCase() + applicationStatus.slice(1) : 'Applied');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : job ? (
          <>
            {/* Header with gradient background */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 border-b">
              <DialogHeader className="text-left">
                <div className="flex items-start gap-4">
                  {job.companies?.logo_url ? (
                    <img 
                      src={job.companies.logo_url} 
                      alt={job.companies?.name || job.company_name}
                      className="w-16 h-16 rounded-xl object-cover ring-2 ring-background shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center ring-2 ring-background shadow-md">
                      <Building2 className="w-8 h-8 text-primary" />
                    </div>
                  )}
                  <div className="flex-1">
                    <DialogTitle className="text-2xl font-bold leading-tight">
                      {job.title}
                    </DialogTitle>
                    {job.companies?.id ? (
                      <Link 
                        to={`/company/${job.companies.id}`}
                        className="text-base text-primary hover:underline font-medium"
                        onClick={() => onOpenChange(false)}
                      >
                        {job.companies?.name || job.company_name}
                      </Link>
                    ) : (
                      <DialogDescription className="text-base font-medium">
                        {job.companies?.name || job.company_name}
                      </DialogDescription>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Posted {formatDistanceToNow(new Date(job.posted_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </DialogHeader>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Quick Info Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="flex items-center gap-1.5 py-1.5 px-3">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1.5 py-1.5 px-3">
                  <Briefcase className="w-4 h-4" />
                  {job.employment_type}
                </Badge>
                {job.remote_option && (
                  <Badge variant="outline" className="py-1.5 px-3">{job.remote_option}</Badge>
                )}
                {formatSalary() && (
                  <Badge className="flex items-center gap-1.5 py-1.5 px-3 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                    <DollarSign className="w-4 h-4" />
                    {formatSalary()}
                  </Badge>
                )}
              </div>

              {/* Apply Button - Prominent CTA */}
              <div className="flex gap-3">
                <Button 
                  size="lg" 
                  className="flex-1"
                  onClick={onApply}
                  disabled={isApplied}
                >
                  {isApplied ? (
                    <>
                      {config?.icon ? <config.icon className="w-5 h-5 mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                      {displayStatus}
                    </>
                  ) : (
                    'Apply Now'
                  )}
                </Button>
                {job.apply_link && (
                  <Button 
                    size="lg" 
                    variant="outline"
                    asChild
                  >
                    <a href={job.apply_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      External Link
                    </a>
                  </Button>
                )}
              </div>

              {isApplied && (
                <div className={`p-3 rounded-lg border flex items-center gap-2 ${config ? config.color : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'}`}>
                  {config?.icon ? <config.icon className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <p className="text-sm font-medium">
                    {config ? config.description : (applicationStatus ? `Status: ${applicationStatus}` : 'Application Submitted')}
                  </p>
                </div>
              )}

              <Separator />

              {/* Job Description */}
              <div>
                <h3 className="font-semibold text-lg mb-3">About this Role</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {job.description}
                </p>
              </div>

              {/* Requirements */}
              {job.requirements && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Requirements</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {job.requirements}
                  </p>
                </div>
              )}

              <Separator />

              {/* About Company */}
              <div>
                <h3 className="font-semibold text-lg mb-3">About the Company</h3>
                <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg border">
                  {job.companies?.logo_url ? (
                    <img 
                      src={job.companies.logo_url} 
                      alt={job.companies?.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{job.companies?.name || job.company_name}</p>
                    {job.companies?.industry && (
                      <p className="text-sm text-muted-foreground">{job.companies.industry}</p>
                    )}
                    {job.companies?.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {job.companies.location}
                      </p>
                    )}
                    {job.companies?.website && (
                      <a 
                        href={job.companies.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
                      >
                        <Globe className="w-3 h-3" />
                        Visit website
                      </a>
                    )}
                  </div>
                  {job.companies?.id && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <Link to={`/company/${job.companies.id}`} onClick={() => onOpenChange(false)}>
                        View Company
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Job not found or no longer available</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
