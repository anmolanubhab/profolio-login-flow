import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyJobs } from '@/hooks/use-company-jobs';
import { useToast } from '@/hooks/use-toast';
import { PostJobDialog } from './PostJobDialog';
import { JobApplicantsDialog } from './JobApplicantsDialog';
import { 
  Briefcase, Plus, MapPin, DollarSign, Users, MoreVertical, 
  Edit, Trash2, Eye, EyeOff, Calendar, RefreshCw, AlertCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from 'date-fns';

interface CompanyJobsManagerProps {
  companyId: string;
  companyName: string;
  isOwner?: boolean; // Whether current user is company owner/admin
}

export const CompanyJobsManager = ({ companyId, companyName, isOwner = false }: CompanyJobsManagerProps) => {
  const { jobs, isLoading, profileId, closeJob, reopenJob, deleteJob, refetch } = useCompanyJobs(companyId);
  const { toast } = useToast();
  
  const [showPostJobDialog, setShowPostJobDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [viewingApplicantsJob, setViewingApplicantsJob] = useState<{ id: string; title: string } | null>(null);

  // Check if user can manage a specific job
  const canManageJob = (job: any): boolean => {
    return isOwner || job.posted_by === profileId;
  };

  const handleCloseJob = async (jobId: string) => {
    const result = await closeJob(jobId);
    if (result.success) {
      toast({ title: 'Job closed', description: 'This job is no longer accepting applications' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleReopenJob = async (jobId: string) => {
    const result = await reopenJob(jobId);
    if (result.success) {
      toast({ title: 'Job reopened', description: 'This job is now accepting applications' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleDeleteJob = async () => {
    if (!deletingJobId) return;
    const result = await deleteJob(deletingJobId);
    if (result.success) {
      toast({ title: 'Job deleted', description: 'The job posting has been removed' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setDeletingJobId(null);
  };

  const formatSalary = (min?: number | null, max?: number | null, currency?: string | null) => {
    if (!min && !max) return null;
    const curr = currency || 'USD';
    if (min && max) return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`;
    if (min) return `${curr} ${min.toLocaleString()}+`;
    return `Up to ${curr} ${max?.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Job Postings
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} posted by {companyName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh jobs">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isOwner && (
            <Button onClick={() => setShowPostJobDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Post New Job
            </Button>
          )}
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No jobs posted yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isOwner 
              ? "Start hiring by posting your first job opening" 
              : "This company hasn't posted any jobs yet"}
          </p>
          {isOwner && (
            <Button onClick={() => setShowPostJobDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Post Your First Job
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="border hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{job.title}</h3>
                          <Badge 
                            variant={
                              job.status === 'open' ? 'default' : 
                              job.status === 'draft' ? 'outline' : 
                              'secondary'
                            }
                          >
                            {job.status === 'open' ? 'Active' : 
                             job.status === 'draft' ? 'Draft' : 
                             'Closed'}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                          {job.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {job.location}
                            </div>
                          )}
                          {job.employment_type && (
                            <Badge variant="outline" className="text-xs">
                              {job.employment_type}
                            </Badge>
                          )}
                          {formatSalary(job.salary_min, job.salary_max, job.currency) && (
                            <div className="flex items-center gap-1 text-primary font-medium">
                              <DollarSign className="h-3.5 w-3.5" />
                              {formatSalary(job.salary_min, job.salary_max, job.currency)}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Posted {formatDistanceToNow(new Date(job.posted_at), { addSuffix: true })}
                          </div>
                        </div>

                        {job.description && (
                          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                            {job.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {canManageJob(job) && (
                      <div className="flex items-center gap-2 mt-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1.5"
                          onClick={() => setViewingApplicantsJob({ id: job.id, title: job.title })}
                        >
                          <Users className="h-4 w-4" />
                          View Applicants
                          {job.stats && job.stats.total > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {job.stats.total}
                            </Badge>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {canManageJob(job) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingJob(job);
                          setShowPostJobDialog(true);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Job
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setViewingApplicantsJob({ id: job.id, title: job.title })}>
                          <Users className="h-4 w-4 mr-2" />
                          View Applicants
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {job.status === 'open' ? (
                          <DropdownMenuItem onClick={() => handleCloseJob(job.id)}>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Close Job
                          </DropdownMenuItem>
                        ) : job.status === 'draft' ? (
                          <DropdownMenuItem onClick={() => handleReopenJob(job.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Publish Job
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleReopenJob(job.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Repost Job
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeletingJobId(job.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Job
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Post/Edit Job Dialog */}
      {profileId && (
        <PostJobDialog
          open={showPostJobDialog}
          onOpenChange={(open) => {
            setShowPostJobDialog(open);
            if (!open) setEditingJob(null);
          }}
          profileId={profileId}
          editJob={editingJob}
          onJobPosted={() => {
            refetch();
            setEditingJob(null);
          }}
        />
      )}

      {/* View Applicants Dialog */}
      {viewingApplicantsJob && (
        <JobApplicantsDialog
          open={!!viewingApplicantsJob}
          onOpenChange={(open) => !open && setViewingApplicantsJob(null)}
          jobId={viewingApplicantsJob.id}
          jobTitle={viewingApplicantsJob.title}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingJobId} onOpenChange={() => setDeletingJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Posting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job posting? All applications for this job will also be removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteJob}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
