import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { MapPin, DollarSign, Briefcase, Plus, FileText, Settings2 } from 'lucide-react';
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
import { ProfileSummaryCard } from '@/components/ProfileSummaryCard';
import { PostJobDialog } from '@/components/jobs/PostJobDialog';
import { JobFilters, JobFiltersState } from '@/components/jobs/JobFilters';
import { JobCard } from '@/components/jobs/JobCard';
import { JobSearchHeader } from '@/components/jobs/JobSearchHeader';
import { JobInsightsRail } from '@/components/jobs/JobInsightsRail';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { Skeleton } from '@/components/ui/skeleton';
import { RecommendedJobsSection } from '@/components/jobs/RecommendedJobsSection';
import { JobPreferencesDialog, JobPreferencesValues } from '@/components/jobs/JobPreferencesDialog';
import { useJobRecommendations, type RecommendedJob } from '@/hooks/useJobRecommendations';

interface Job {
  id: string;
  title: string;
  company_name: string;
  company_id?: string;
  description: string;
  requirements: string;
  location: string;
  employment_type: string;
  remote_option: string;
  apply_link: string;
  salary_min: number;
  salary_max: number;
  currency: string;
  posted_at: string;
  posted_by: string;
  status: string;
  company?: {
    name: string;
    logo_url: string;
  };
}

const Jobs = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string>('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState({ keyword: '', location: '' });
  const [filters, setFilters] = useState<JobFiltersState>({
    search: '',
    companyId: '',
    location: '',
    employmentType: '',
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showPostJobDialog, setShowPostJobDialog] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [resumes, setResumes] = useState<{ id: string; title: string; content: { type?: string } | null }[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  const [preferences, setPreferences] = useState<JobPreferencesValues>({
    open_to_roles: null, preferred_locations: null, preferred_work_modes: null, job_type: null,
    preferred_industries: null, salary_min_expected: null, salary_max_expected: null, salary_currency: null,
    open_to_work: false, actively_looking: false,
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { savedJobIds, toggleSave } = useSavedJobs();
  const {
    loading: recLoading, refreshing: recRefreshing, jobs: recommendedJobs,
    hasPreferenceSignal, error: recError, refresh: refreshRecommendations,
  } = useJobRecommendations(user?.id ?? null);

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
        .select('id, open_to_roles, preferred_locations, job_type, preferred_work_modes, preferred_industries, salary_min_expected, salary_max_expected, salary_currency, open_to_work, actively_looking')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setProfileId(profile.id);
        setPreferences({
          open_to_roles: profile.open_to_roles,
          preferred_locations: profile.preferred_locations,
          preferred_work_modes: profile.preferred_work_modes,
          job_type: profile.job_type,
          preferred_industries: profile.preferred_industries,
          salary_min_expected: profile.salary_min_expected,
          salary_max_expected: profile.salary_max_expected,
          salary_currency: profile.salary_currency,
          open_to_work: profile.open_to_work ?? false,
          actively_looking: profile.actively_looking ?? false,
        });

        // "Post a Job" / For Business entry only makes sense if this person
        // actually owns or administers a company -- same gating Dashboard
        // already uses for My Drafts.
        const { data: ownedCompany } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_id', profile.id)
          .maybeSingle();
        if (ownedCompany) setCompanyId(ownedCompany.id);
      }
    };
    getUser();
  }, [navigate]);

  // `?post=1` -- the mobile Create sheet deep-links here to open the existing
  // Post-a-Job dialog. Wait until we know the user owns a company (same gate as
  // the on-page "Post a Job" buttons), then consume the param.
  useEffect(() => {
    if (searchParams.get('post') !== '1' || !companyId) return;
    setShowPostJobDialog(true);
    const next = new URLSearchParams(searchParams);
    next.delete('post');
    setSearchParams(next, { replace: true });
  }, [searchParams, companyId, setSearchParams]);

  useEffect(() => {
    if (user) {
      fetchJobs();
      fetchApplications();
      fetchResumes();
    }
  }, [user]);

  // `?job=<id>` -- new_job notifications deep-link here (see getNotificationLink
  // in lib/notifications.ts). Opens the same existing job-details dialog the
  // regular "View Details" button uses; no separate job-details page.
  useEffect(() => {
    const jobId = searchParams.get('job');
    if (!jobId || jobs.length === 0) return;
    const target = jobs.find((j) => j.id === jobId);
    if (target) setSelectedJob(target);
    const next = new URLSearchParams(searchParams);
    next.delete('job');
    setSearchParams(next, { replace: true });
  }, [searchParams, jobs, setSearchParams]);

  const fetchJobs = async () => {
    try {
      setLoadError(null);
      const { data, error } = await supabase
        .from('jobs')
        .select(`*, company:companies(name, logo_url)`)
        .eq('status', 'open')
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error: any) {
      setLoadError(error.message || 'Something went wrong loading jobs.');
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from('hiring_applications')
        .select('job_id')
        .eq('candidate_user_id', user.id);

      if (error) throw error;
      setAppliedJobs(new Set(data?.map((app) => app.job_id) || []));
    } catch (error: any) {
      console.error('Error fetching applications:', error);
    }
  };

  const fetchResumes = async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from('resumes')
        .select('id, title, content')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setResumes((data || []) as { id: string; title: string; content: { type?: string } | null }[]);
      if (data && data.length > 0) setSelectedResumeId(data[0].id);
    } catch (error: any) {
      console.error('Error fetching resumes:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    const keyword = (search.keyword || filters.search).toLowerCase().trim();
    const location = (search.location || filters.location).toLowerCase().trim();

    if (keyword) {
      result = result.filter((job) => {
        const companyName = job.company_name || job.company?.name || '';
        return (
          job.title.toLowerCase().includes(keyword) ||
          companyName.toLowerCase().includes(keyword) ||
          job.description?.toLowerCase().includes(keyword)
        );
      });
    }
    if (location) {
      result = result.filter((job) => job.location?.toLowerCase().includes(location));
    }
    if (filters.companyId) {
      result = result.filter((job) => job.company_id === filters.companyId);
    }
    if (filters.employmentType) {
      result = result.filter((job) => job.employment_type?.toLowerCase() === filters.employmentType.toLowerCase());
    }
    return result;
  }, [jobs, search, filters]);

  /** Adapts a RecommendedJob (from useJobRecommendations) into the local Job shape used by the existing selectedJob/apply-dialog flow -- no new dialog needed, reuses what's already there. */
  const toJob = (rj: RecommendedJob): Job => ({
    id: rj.id,
    title: rj.title,
    company_name: rj.company_name || '',
    company_id: rj.company_id || undefined,
    description: rj.description,
    requirements: '',
    location: rj.location,
    employment_type: rj.employment_type,
    remote_option: rj.remote_option,
    apply_link: '',
    salary_min: rj.salary_min || 0,
    salary_max: rj.salary_max || 0,
    currency: rj.currency || '',
    posted_at: rj.posted_at,
    posted_by: '',
    status: 'open',
    company: rj.company || undefined,
  });

  const handleApply = async () => {
    if (!selectedJob || !user) return;
    try {
      setApplying(true);
      const { error } = await supabase.rpc('apply_to_job', {
        p_job_id: selectedJob.id,
        p_resume_id: selectedResumeId || undefined,
        p_cover_note: coverLetter.trim() || undefined,
      });
      if (error) throw error;

      toast({ title: 'Application submitted', description: `${selectedJob.title} at ${selectedJob.company_name || selectedJob.company?.name}` });
      setAppliedJobs((prev) => new Set([...prev, selectedJob.id]));
      setShowApplyDialog(false);
      setCoverLetter('');
      setSelectedJob(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const formatSalary = (job: Job) => {
    if (!job.salary_min || !job.salary_max) return null;
    const currency = job.currency || 'USD';
    return `${currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', jobId);
      if (error) throw error;
      toast({ title: 'Job deleted' });
      fetchJobs();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingJobId(null);
    }
  };

  const isJobOwner = (job: Job) => job.posted_by === profileId;

  const renderJobCard = (job: Job, matchLabel?: string) => (
    <JobCard
      key={job.id}
      job={job}
      isApplied={appliedJobs.has(job.id)}
      isSaved={savedJobIds.has(job.id)}
      onToggleSave={toggleSave}
      matchLabel={matchLabel}
      onViewDetails={() => setSelectedJob(job)}
      onApply={() => { setSelectedJob(job); setShowApplyDialog(true); }}
    />
  );

  if (loading) {
    return (
      <Layout user={user!} onSignOut={handleSignOut} fullWidth>
        <div className="w-full max-w-[1128px] mx-auto px-3 sm:px-4 py-6 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user!} onSignOut={handleSignOut} fullWidth>
      <div className="w-full max-w-[1128px] mx-auto px-3 sm:px-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <aside className="hidden lg:block lg:w-[240px] lg:shrink-0 sticky top-[calc(var(--nav-height)+1rem)]">
            <ProfileSummaryCard hasCompany={!!companyId} />
            <div className="mt-4 space-y-2">
              {companyId && (
                <Button className="w-full" variant="outline" onClick={() => setShowPostJobDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Post a Job
                </Button>
              )}
              <Button className="w-full" variant="outline" onClick={() => setShowPreferencesDialog(true)}>
                <Settings2 className="h-4 w-4 mr-2" />
                Job Preferences
              </Button>
            </div>
          </aside>

          <div className="min-w-0 w-full flex-1 space-y-4 py-4">
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <div>
                <h1 className="text-xl font-bold text-foreground">Find Your Next Opportunity</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowPreferencesDialog(true)}>
                  <Settings2 className="h-4 w-4" />
                </Button>
                {companyId && (
                  <Button size="sm" onClick={() => setShowPostJobDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Post
                  </Button>
                )}
              </div>
            </div>
            <h1 className="hidden lg:block text-2xl font-bold text-foreground">Find Your Next Opportunity</h1>

            <JobSearchHeader
              keyword={search.keyword}
              location={search.location}
              onSearch={(keyword, location) => setSearch({ keyword, location })}
            />

            <Card className="bg-gradient-card shadow-card border-0">
              <CardContent className="pt-6">
                <JobFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  locations={jobs.map((job) => job.location).filter(Boolean)}
                />
              </CardContent>
            </Card>

            {loadError ? (
              <Card className="p-10 text-center bg-gradient-card shadow-card border-0">
                <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
                <Button onClick={fetchJobs}>Try Again</Button>
              </Card>
            ) : (
              <>
                {user && (
                  <RecommendedJobsSection
                    userId={user.id}
                    loading={recLoading}
                    refreshing={recRefreshing}
                    jobs={recommendedJobs}
                    hasPreferenceSignal={hasPreferenceSignal}
                    error={recError}
                    onRefresh={refreshRecommendations}
                    appliedJobIds={appliedJobs}
                    savedJobIds={savedJobIds}
                    onToggleSave={toggleSave}
                    onViewDetails={(rj) => setSelectedJob(toJob(rj))}
                    onApply={(rj) => { setSelectedJob(toJob(rj)); setShowApplyDialog(true); }}
                    onOpenPreferences={() => setShowPreferencesDialog(true)}
                  />
                )}

                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">
                    {filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'} found
                  </h2>
                  {filteredJobs.length === 0 ? (
                    <Card className="p-12 text-center bg-gradient-card shadow-card border-0">
                      <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="font-medium text-foreground mb-1">No jobs found</p>
                      <p className="text-sm text-muted-foreground">Try another title, skill, or location.</p>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                      {filteredJobs.map((job) => renderJobCard(job))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <aside className="hidden xl:block xl:w-[300px] xl:shrink-0 sticky top-[calc(var(--nav-height)+1rem)] py-4">
            <JobInsightsRail />
          </aside>
        </div>
      </div>

      {user && (
        <JobPreferencesDialog
          open={showPreferencesDialog}
          onOpenChange={setShowPreferencesDialog}
          profileUserId={user.id}
          initialValues={preferences}
          onSaved={(values) => {
            setPreferences(values);
            // Re-run the server-side batch scorer + reload the cache so
            // "Recommended for You" reflects the new preferences immediately
            // instead of waiting for the next unrelated page load.
            refreshRecommendations();
          }}
        />
      )}

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply for {selectedJob?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Resume</label>
              {resumes.length > 0 ? (
                <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a resume" />
                  </SelectTrigger>
                  <SelectContent>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title} {r.content?.type === 'pdf' ? '(PDF)' : '(Structured)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  No resume yet.{' '}
                  <Link to="/resume" className="text-primary hover:underline">Build one</Link>
                  {' '}(optional — you can still apply without it)
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Cover Note (Optional)</label>
              <Textarea
                placeholder="Tell the employer why you're a great fit for this position..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={6}
                className="mt-2"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowApplyDialog(false)}>Cancel</Button>
              <Button onClick={handleApply} disabled={applying}>
                {applying ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                  {isJobOwner(selectedJob) && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingJob(selectedJob); setShowPostJobDialog(true); }}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeletingJobId(selectedJob.id)}>Delete</Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge>{selectedJob.employment_type}</Badge>
                  {selectedJob.remote_option && <Badge variant="secondary">{selectedJob.remote_option}</Badge>}
                  <Badge variant="outline" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{selectedJob.location}
                  </Badge>
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

              <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-background">
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
                    {appliedJobs.has(selectedJob.id) ? 'Applied' : 'Apply'}
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
            fetchJobs();
            setEditingJob(null);
            setSelectedJob(null);
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
    </Layout>
  );
};

export default Jobs;
