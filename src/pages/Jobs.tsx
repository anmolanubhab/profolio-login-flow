import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign } from 'lucide-react';
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
import { Layout } from '@/components/Layout';
import { PostJobDialog } from '@/components/jobs/PostJobDialog';
import { JobFilters, JobFiltersState } from '@/components/jobs/JobFilters';
import { JobsFeed } from '@/components/jobs/JobsFeed';
import { useJobFeed, Job } from '@/hooks/useJobFeed';
import { ApplyJobDialog } from '@/components/jobs/ApplyJobDialog';
import { useJobApplication } from '@/hooks/useJobApplication';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';

const Jobs = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string>('');
  const [filters, setFilters] = useState<JobFiltersState>({
    search: '',
    companyId: '',
    location: '',
    employmentType: '',
  });
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showPostJobDialog, setShowPostJobDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { savedJobIds, toggleSave } = useSavedJobs();
  const { appliedJobIds } = useJobApplication();
  
  // Use hook to get jobs for filters
  const { jobs } = useJobFeed();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (profile) {
        setProfileId(profile.id);
      }
    };
    getUser();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleApplyClick = (job: any) => {
    setSelectedJob(job);
    setShowApplyDialog(true);
    // Also increment view on apply intent
    if (job.posted_by !== profileId) {
      supabase.rpc('increment_job_view', { job_id: job.id });
    }
  };

  const handleViewDetails = (job: any) => {
    setSelectedJob(job);
    if (job.posted_by !== profileId) {
      supabase.rpc('increment_job_view', { job_id: job.id });
    }
  };

  const handleEditJob = (job: any) => {
    setEditingJob(job);
    setShowPostJobDialog(true);
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Job deleted successfully!',
      });

      queryClient.invalidateQueries({ queryKey: ['jobs-feed'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingJobId(null);
    }
  };

  const formatSalary = (job: Job) => {
    if (!job.salary_min || !job.salary_max) return null;
    const currency = job.currency || 'USD';
    return `${currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
  };

  if (!user) {
    return null; 
  }

  const uniqueLocations = Array.from(new Set(jobs?.map(job => job.location).filter(Boolean) || [])) as string[];

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Find Your Next Opportunity</h1>
            <p className="text-muted-foreground">Discover jobs that match your skills and interests</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate('/jobs/saved')}>
              <Bookmark className="h-4 w-4" />
              Saved Jobs
            </Button>
            <Button variant="outline" onClick={() => navigate('/jobs/preferences')}>
              Job Preferences
            </Button>
            <Button variant="outline" onClick={() => navigate('/jobs/my-jobs')}>
              My Posted Jobs
            </Button>
            <Button onClick={() => setShowPostJobDialog(true)}>
              Post a Job
            </Button>
          </div>
        </div>

        <Card className="mb-6 bg-gradient-card shadow-card border-0">
          <CardContent className="pt-6">
            <JobFilters
              filters={filters}
              onFiltersChange={setFilters}
              locations={uniqueLocations}
            />
          </CardContent>
        </Card>

        <JobsFeed 
          onApply={handleApplyClick}
          onViewDetails={handleViewDetails}
          onEdit={handleEditJob}
          onDelete={setDeletingJobId}
          onToggleSave={toggleSave}
          appliedJobIds={appliedJobIds}
          savedJobIds={savedJobIds}
          readOnly={false}
          filters={filters}
          userProfileId={profileId}
        />

        {/* Apply Dialog */}
        <ApplyJobDialog 
          job={selectedJob} 
          open={showApplyDialog} 
          onOpenChange={setShowApplyDialog} 
        />

        {/* Job Details Dialog */}
        <Dialog open={!!selectedJob && !showApplyDialog} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            {selectedJob && (
              <div className="space-y-6">
                 <div>
                   <div className="flex items-start gap-4 mb-4">
                     {selectedJob.company?.logo_url && (
                       <img 
                         src={selectedJob.company.logo_url} 
                         alt={selectedJob.company?.name || selectedJob.company_name}
                         className="h-16 w-16 rounded object-cover"
                       />
                     )}
                     <div className="flex-1">
                       <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                       <p className="text-lg text-muted-foreground">{selectedJob.company_name || selectedJob.company?.name}</p>
                     </div>
                   </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge>{selectedJob.employment_type}</Badge>
                    {selectedJob.remote_option && <Badge variant="secondary">{selectedJob.remote_option}</Badge>}
                    <Badge variant="outline">{selectedJob.location}</Badge>
                  </div>

                  {formatSalary(selectedJob) && (
                    <div className="flex items-center gap-2 text-primary font-semibold mb-4">
                      <DollarSign className="h-5 w-5" />
                      <span>{formatSalary(selectedJob)}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">Job Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedJob.description}</p>
                </div>

                {selectedJob.requirements && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Requirements</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">{selectedJob.requirements}</p>
                  </div>
                )}

                 <div className="flex gap-2 pt-4 border-t">
                   {selectedJob.apply_link ? (
                     <Button 
                       className="flex-1"
                       onClick={() => {
                         if (selectedJob.apply_link.includes('@')) {
                           window.location.href = `mailto:${selectedJob.apply_link}`;
                         } else {
                           window.open(selectedJob.apply_link, '_blank');
                         }
                       }}
                     >
                       Apply Now
                     </Button>
                   ) : (
                     <Button 
                       className="flex-1"
                       onClick={() => setShowApplyDialog(true)}
                       disabled={appliedJobs.has(selectedJob.id)}
                     >
                       {appliedJobs.has(selectedJob.id) ? 'Already Applied' : 'Apply for this Job'}
                     </Button>
                   )}
                 </div>
               </div>
             )}
           </DialogContent>
         </Dialog>

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
                queryClient.invalidateQueries({ queryKey: ['jobs-feed'] });
                setEditingJob(null);
              }}
            />
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deletingJobId} onOpenChange={() => setDeletingJobId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Job Post</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this job posting? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => deletingJobId && handleDeleteJob(deletingJobId)}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
       </div>
     </Layout>
   );
 };
 
 export default Jobs;