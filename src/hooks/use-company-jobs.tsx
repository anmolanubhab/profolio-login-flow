import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Job {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  status: string;
  posted_at: string;
  company_id: string | null;
  company_name: string | null;
  posted_by: string | null;
  requirements: string | null;
  remote_option: string | null;
  apply_link: string | null;
  companies?: {
    name: string;
    logo_url?: string;
  };
}

interface Applicant {
  id: string;
  job_id: string;
  user_id: string;
  cover_letter: string | null;
  resume_id: string | null;
  status: 'applied' | 'shortlisted' | 'interview' | 'offered' | 'rejected' | 'withdrawn';
  applied_at: string;
  profile?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    profession: string | null;
    full_name: string | null;
    email: string | null;
    bio: string | null;
    location: string | null;
  };
}

export function useCompanyJobs(companyId?: string) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', companyId)
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching company jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const getProfileId = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (data) setProfileId(data.id);
    };
    getProfileId();
  }, [user]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const closeJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'closed' })
        .eq('id', jobId);

      if (error) throw error;
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'closed' } : j));
      return { success: true };
    } catch (error: any) {
      console.error('Error closing job:', error);
      return { success: false, error: error.message };
    }
  };

  const reopenJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'open' })
        .eq('id', jobId);

      if (error) throw error;
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'open' } : j));
      return { success: true };
    } catch (error: any) {
      console.error('Error reopening job:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== jobId));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting job:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    jobs,
    isLoading,
    profileId,
    closeJob,
    reopenJob,
    deleteJob,
    refetch: fetchJobs
  };
}

export function useJobApplicants(jobId?: string) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchApplicants = useCallback(async () => {
    if (!jobId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .order('applied_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(a => a.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, profession, full_name, email, bio, location')
          .in('id', userIds);

        const applicantsWithProfiles: Applicant[] = data.map(app => ({
          ...app,
          status: app.status as Applicant['status'],
          profile: profiles?.find(p => p.id === app.user_id)
        }));

        setApplicants(applicantsWithProfiles);
      } else {
        setApplicants([]);
      }
    } catch (error) {
      console.error('Error fetching applicants:', error);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchApplicants();

    const handleFocus = () => {
      fetchApplicants();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchApplicants]);

  const updateApplicationStatus = async (
    applicationId: string, 
    newStatus: Applicant['status'],
    applicantProfileId?: string,
    jobTitle?: string
  ) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) throw error;

      // Create notification for the applicant
      if (applicantProfileId && (newStatus === 'shortlisted' || newStatus === 'rejected' || newStatus === 'interview' || newStatus === 'offered')) {
        const notificationType = newStatus === 'shortlisted' ? 'application_shortlisted' 
          : newStatus === 'rejected' ? 'application_rejected'
          : newStatus === 'interview' ? 'application_interview'
          : 'application_offered';

        await supabase.from('notifications').insert({
          user_id: applicantProfileId,
          type: notificationType,
          payload: {
            job_title: jobTitle || 'Job',
            status: newStatus,
            message: `Your application has been ${newStatus === 'shortlisted' ? 'shortlisted' : newStatus}`
          }
        });
      }

      setApplicants(prev => prev.map(a => 
        a.id === applicationId ? { ...a, status: newStatus } : a
      ));
      return { success: true };
    } catch (error: any) {
      console.error('Error updating application status:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    applicants,
    isLoading,
    updateApplicationStatus,
    refetch: fetchApplicants
  };
}

export function useUserApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<(Applicant & { job?: Job })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', profile.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const jobIds = data.map(a => a.job_id);
        const { data: jobs } = await supabase
          .from('jobs')
          .select(`
            *,
            companies:company_id (name, logo_url)
          `)
          .in('id', jobIds);

        const applicationsWithJobs = data.map(app => ({
          ...app,
          status: app.status as Applicant['status'],
          job: jobs?.find(j => j.id === app.job_id)
        }));

        setApplications(applicationsWithJobs);
      } else {
        setApplications([]);
      }
    } catch (error) {
      console.error('Error fetching user applications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchApplications();

    const handleFocus = () => {
      fetchApplications();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchApplications]);

  const withdrawApplication = async (applicationId: string) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: 'withdrawn' })
        .eq('id', applicationId);

      if (error) throw error;
      setApplications(prev => prev.filter(a => a.id !== applicationId));
      return { success: true };
    } catch (error: any) {
      console.error('Error withdrawing application:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    applications,
    isLoading,
    withdrawApplication,
    refetch: fetchApplications
  };
}
