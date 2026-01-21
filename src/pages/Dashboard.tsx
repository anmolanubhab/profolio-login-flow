import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import PostInput from '@/components/PostInput';
import Feed from '@/components/Feed';
import Stories from '@/components/Stories';
import { Button } from '@/components/ui/button';
import { PostJobDialog } from '@/components/jobs/PostJobDialog';
import { ApplyJobDialog } from '@/components/jobs/ApplyJobDialog';
import { JobDetailsDialog } from '@/components/jobs/JobDetailsDialog';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedRefresh, setFeedRefresh] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<Map<string, string>>(new Map());
  const [postJobOpen, setPostJobOpen] = useState(false);
  const [applyJobOpen, setApplyJobOpen] = useState(false);
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
            fetchAppliedJobs(session.user.id);
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchUserProfile(session.user.id);
        fetchAppliedJobs(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setProfileId(data.id);

      // Check if user owns a company
      const { data: companyData } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', data.id)
        .maybeSingle();

      if (companyData) {
        setCompanyId(companyData.id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchAppliedJobs = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('job_id, status')
        .eq('user_id', userId);

      if (error) throw error;
      const jobsMap = new Map<string, string>();
      data.forEach(app => jobsMap.set(app.job_id, app.status));
      setAppliedJobs(jobsMap);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const handleFocus = () => {
      fetchAppliedJobs(user.id);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  const handleApply = async (jobId: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to apply for jobs',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      setSelectedJobId(jobId);
      setSelectedJobTitle(data.title);
      setApplyJobOpen(true);
    } catch (error) {
      console.error('Error fetching job:', error);
    }
  };

  const handleViewDetails = (jobId: string) => {
    setSelectedJobId(jobId);
    setJobDetailsOpen(true);
  };

  const handleApplicationSubmitted = () => {
    if (user) {
      fetchAppliedJobs(user.id);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "You have been signed out successfully.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Please log in to access the dashboard.</p>
      </div>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="max-w-2xl mx-auto w-full px-0 sm:px-4 space-y-4">
        <Stories />
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <PostInput
              user={{
                email: user.email,
                avatar: user.user_metadata?.avatar_url
              }}
              onPostCreated={() => setFeedRefresh(prev => prev + 1)}
            />
          </div>
        </div>
        <Feed refresh={feedRefresh} />
      </div>

      {profileId && (
        <PostJobDialog
          open={postJobOpen}
          onOpenChange={setPostJobOpen}
          profileId={profileId}
          onJobPosted={() => {
            setFeedRefresh(prev => prev + 1);
          }}
        />
      )}

      <ApplyJobDialog
        open={applyJobOpen}
        onOpenChange={setApplyJobOpen}
        jobId={selectedJobId}
        jobTitle={selectedJobTitle}
        onApplicationSubmitted={handleApplicationSubmitted}
      />

      <JobDetailsDialog
        open={jobDetailsOpen}
        onOpenChange={setJobDetailsOpen}
        jobId={selectedJobId}
        applicationStatus={appliedJobs.get(selectedJobId)}
      />
    </Layout>
  );
};

export default Dashboard;