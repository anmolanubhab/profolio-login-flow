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
  const [isIncrementingView, setIsIncrementingView] = useState(false);
  const { toast } = useToast();

  // Track viewed jobs in current session to prevent duplicate increments
  const [viewedJobsInSession] = useState(() => new Set<string>());

  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      fetchSavedJobsDetails(controller.signal);
      fetchProfile(controller.signal);
      return () => controller.abort();
    }
  }, [user, savedJobIds]);

  const fetchProfile = async (signal?: AbortSignal) => {
    if (!user) return;
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .abortSignal(signal)
        .maybeSingle();
      
      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }
      if (profile) setProfileId(profile.id);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchSavedJobsDetails = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      if (savedJobIds.size === 0) {
        setSavedJobs([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          company:companies(name, logo_url)
        `)
        .in('id', Array.from(savedJobIds))
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }
      setSavedJobs(data as Job[] || []);
    } catch (error) {
      if ((error as any).name === 'AbortError' || (error as any).code === 'ABORTED') return;
      console.error('Error fetching saved jobs details:', error);
      toast({
        title: "Error loading saved jobs",
        description: "Please try refreshing the page",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Single unified function with proper error handling
  const handleJobInteraction = async (job: Job) => {
    try {
      // Set selected job and show dialog first (immediate feedback)
      setSelectedJob(job);
      setShowApplyDialog(true);

      // Don't increment view for own jobs
      if (job.posted_by === profileId) {
        return;
      }

      // Prevent duplicate view increments in same session
      if (viewedJobsInSession.has(job.id)) {
        return;
      }

      // Prevent race conditions from rapid clicks
      if (isIncrementingView) {
        return;
      }

      setIsIncrementingView(true);

      // Increment view count with error handling
      const { error } = await (supabase as any).rpc('increment_job_view', { 
        job_id: job.id 
      });

      if (error) {
        console.error('Failed to increment job view:', error);
        // Don't show error to user - this is background operation
        // But log it for debugging
      } else {
        // Mark as viewed in this session
        viewedJobsInSession.add(job.id);
      }
    } catch (error) {
      console.error('Error in job interaction:', error);
      // Don't block user flow - just log the error
    } finally {
      setIsIncrementingView(false);
    }
  };

  // ✅ FIXED: Simplified wrapper functions
  const handleApplyClick = (job: Job) => {
    handleJobInteraction(job);
  };

  const handleViewDetails = (job: Job) => {
    handleJobInteraction(job);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="min-h-screen" style={{ background: "radial-gradient(1000px 300px at 0% 0%, #e9d5ff 0%, #fce7f3 40%, #dbeafe 80%)" }}>
        {/* Universal Page Hero Section */}
        <div className="relative w-full bg-gradient-to-r from-indigo-300 via-pink-200 to-blue-200 rounded-b-3xl pt-8 pb-12 px-8 overflow-hidden">
          <div className="max-w-4xl mx-auto relative">
            <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between gap-6 md:gap-8">
              <div className="text-center md:text-left animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <h1 className="text-4xl md:text-6xl font-extrabold text-[#1D2226] mb-4 tracking-tighter">
                  Saved Opportunities
                </h1>
                <p className="text-[#5E6B7E] text-lg md:text-2xl font-medium max-w-2xl mx-auto md:mx-0 leading-relaxed">
                  Your curated list of professional roles and future career moves.
                </p>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-20 -right-32 w-[400px] h-[400px] bg-white/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-16 w-[300px] h-[300px] bg-white/20 rounded-full blur-3xl" />
          </div>
        </div>

        <div className="max-w-4xl mx-auto py-8 px-0 sm:px-4">
          <div className="mb-8 flex items-center gap-4 px-4 sm:px-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/jobs')}
              className="rounded-full hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
          </div>

          {loading || loadingSaved ? (
            <div className="text-center py-20 animate-pulse">
              <div className="h-12 w-12 border-4 border-gray-100 border-t-[#833AB4] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#5E6B7E] font-medium">Retrieving your saved jobs...</p>
            </div>
          ) : savedJobs.length === 0 ? (
            <div className="bg-gray-50/50 rounded-none sm:rounded-[2rem] p-16 text-center border-0 sm:border-2 border-dashed border-gray-200 mx-4 sm:mx-0">
              <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Bookmark className="h-10 w-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No saved jobs yet</h3>
              <p className="text-gray-500 max-w-xs mx-auto mb-8">
                Start exploring opportunities and save the ones that catch your eye.
              </p>
              <Button 
                onClick={() => navigate('/jobs')}
                className="rounded-full px-8 bg-gradient-to-r from-[#0077B5] to-[#833AB4] hover:opacity-90 border-none"
              >
                Browse Jobs
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <JobsFeed
                jobs={savedJobs}
                onApply={handleApplyClick}
                onViewDetails={handleViewDetails}
                onToggleSave={toggleSave}
                appliedJobIds={appliedJobIds}
                savedJobIds={savedJobIds}
                userProfileId={profileId}
              />
            </div>
          )}
        </div>
      </div>

      <ApplyJobDialog 
        job={selectedJob} 
        open={showApplyDialog} 
        onOpenChange={setShowApplyDialog} 
      />
    </Layout>
  );
};

export default SavedJobs;
