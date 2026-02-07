
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { JobsFeed } from '@/components/jobs/JobsFeed';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { useJobFeed, Job } from '@/hooks/useJobFeed';
import { useJobApplication } from '@/hooks/useJobApplication';
import { ApplyJobDialog } from '@/components/jobs/ApplyJobDialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const SavedJobs = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { savedJobIds, toggleSave, isLoading: loadingSaved } = useSavedJobs();
  const { appliedJobIds } = useJobApplication();
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [profileId, setProfileId] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchSavedJobsDetails();
      fetchProfile();
    }
  }, [user, savedJobIds]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (profile) setProfileId(profile.id);
  };

  const fetchSavedJobsDetails = async () => {
    setLoading(true);
    try {
      if (savedJobIds.size === 0) {
        setSavedJobs([]);
        setLoading(false);
        return;
      }

      // Fetch job details for saved IDs
      // We can't use useJobFeed directly efficiently here as it fetches all/recommended
      // So we fetch directly from supabase
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          company:companies(name, logo_url)
        `)
        .in('id', Array.from(savedJobIds));

      if (error) throw error;
      setSavedJobs(data as Job[] || []);
    } catch (error) {
      console.error('Error fetching saved jobs details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = (job: Job) => {
    setSelectedJob(job);
    setShowApplyDialog(true);
    if (job.posted_by !== profileId) {
      supabase.rpc('increment_job_view', { job_id: job.id });
    }
  };

  const handleViewDetails = (job: Job) => {
    setSelectedJob(job);
    setShowApplyDialog(true);
    if (job.posted_by !== profileId) {
      supabase.rpc('increment_job_view', { job_id: job.id });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-5xl py-6 px-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-primary fill-current" />
            <h1 className="text-2xl font-bold">Saved Jobs</h1>
          </div>
        </div>

        {loading || loadingSaved ? (
          <div className="text-center py-12 text-muted-foreground">Loading saved jobs...</div>
        ) : savedJobs.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-muted/30">
            <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No saved jobs</h3>
            <p className="text-muted-foreground mb-6">Jobs you save will appear here.</p>
            <Button onClick={() => navigate('/jobs')}>Browse Jobs</Button>
          </div>
        ) : (
          <JobsFeed
            jobs={savedJobs} // Pass explicit jobs
            onApply={handleApplyClick}
            onViewDetails={handleViewDetails}
            onToggleSave={toggleSave}
            appliedJobIds={appliedJobIds}
            savedJobIds={savedJobIds}
            userProfileId={profileId}
          />
        )}

        <ApplyJobDialog 
          job={selectedJob} 
          open={showApplyDialog} 
          onOpenChange={setShowApplyDialog} 
        />
      </div>
    </Layout>
  );
};

export default SavedJobs;
