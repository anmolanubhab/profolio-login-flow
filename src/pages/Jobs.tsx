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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Building, DollarSign, Briefcase, Plus, MoreVertical, Edit, Trash2, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Layout } from '@/components/Layout';
import { PostJobDialog } from '@/components/jobs/PostJobDialog';
import { JobFilters, JobFiltersState } from '@/components/jobs/JobFilters';

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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<JobFiltersState>({
    search: '',
    companyId: '',
    location: '',
    employmentType: '',
  });
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showPostJobDialog, setShowPostJobDialog] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [resumes, setResumes] = useState<{ id: string; title: string }[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
      
      // FIXED: Get profile ID for job posting
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

  useEffect(() => {
    if (user) {
      fetchJobs();
      fetchApplications();
      fetchResumes();
    }
  }, [user]);

  useEffect(() => {
    let filtered = [...jobs];

    // Search filter
    if (filters.search.trim()) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(job => {
        const companyName = job.company_name || job.company?.name || '';
        return (
          job.title.toLowerCase().includes(query) ||
          companyName.toLowerCase().includes(query) ||
          job.location?.toLowerCase().includes(query) ||
          job.description?.toLowerCase().includes(query)
        );
      });
    }

    // Company filter
    if (filters.companyId) {
      filtered = filtered.filter(job => job.company_id === filters.companyId);
    }

    // Location filter
    if (filters.location) {
      filtered = filtered.filter(job => job.location === filters.location);
    }

    // Employment type filter
    if (filters.employmentType) {
      filtered = filtered.filter(job => 
        job.employment_type?.toLowerCase() === filters.employmentType.toLowerCase()
      );
    }

    setFilteredJobs(filtered);
  }, [filters, jobs]);

  const fetchJobs = async () => {
    try {
      // FIXED: Fetch jobs with optional company relation
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          company:companies(name, logo_url)
        `)
        .eq('status', 'open')
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
      setFilteredJobs(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      if (!user) return;

      // The candidate's own applications now live in hiring_applications --
      // the same table the recruiter's Hiring Pipeline reads/writes -- so an
      // application made here is immediately visible to the recruiter and to
      // My Applications, instead of the old disconnected `applications` table.
      const { data, error } = await supabase
        .from('hiring_applications')
        .select('job_id')
        .eq('candidate_user_id', user.id);

      if (error) throw error;
      setAppliedJobs(new Set(data?.map(app => app.job_id) || []));
    } catch (error: any) {
      console.error('Error fetching applications:', error);
    }
  };

  const fetchResumes = async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from('resumes')
        .select('id, title')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setResumes(data || []);
      if (data && data.length > 0) setSelectedResumeId(data[0].id);
    } catch (error: any) {
      console.error('Error fetching resumes:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleApply = async () => {
    if (!selectedJob || !user) return;

    try {
      setApplying(true);

      // apply_to_job() is the single authoritative write path for applying --
      // it inserts into hiring_applications (+ a 'created' hiring_application_events
      // row) under RLS/RPC rules shared with the recruiter pipeline, instead
      // of inserting into the legacy `applications` table directly.
      const { error } = await supabase.rpc('apply_to_job', {
        p_job_id: selectedJob.id,
        p_resume_id: selectedResumeId || undefined,
        p_cover_note: coverLetter.trim() || undefined,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Application submitted successfully!',
      });

      setAppliedJobs(prev => new Set([...prev, selectedJob.id]));
      setShowApplyDialog(false);
      setCoverLetter('');
      setSelectedJob(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setApplying(false);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInDays = Math.floor((now.getTime() - postTime.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const formatSalary = (job: Job) => {
    if (!job.salary_min || !job.salary_max) return null;
    const currency = job.currency || 'USD';
    return `${currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
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

      fetchJobs();
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

  const isJobOwner = (job: Job) => {
    return job.posted_by === profileId;
  };

  if (loading) {
    return (
      <Layout user={user!} onSignOut={handleSignOut}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user!} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Find Your Next Opportunity</h1>
            <p className="text-muted-foreground">Discover jobs that match your skills and interests</p>
          </div>
          {/* FIXED: Added Post Job button */}
          <Button 
            onClick={() => setShowPostJobDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Post a Job
          </Button>
        </div>

        <Card className="mb-6 bg-gradient-card shadow-card border-0">
          <CardContent className="pt-6">
            <JobFilters
              filters={filters}
              onFiltersChange={setFilters}
              locations={jobs.map(job => job.location).filter(Boolean)}
            />
          </CardContent>
        </Card>

        {filteredJobs.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card shadow-card border-0">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {filters.search || filters.companyId || filters.location || filters.employmentType 
                ? 'No jobs found matching your filters.' 
                : 'No job openings available at the moment.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.map((job) => {
              const hasApplied = appliedJobs.has(job.id);
              return (
                <Card key={job.id} className="bg-gradient-card shadow-card border-0 hover:shadow-elegant transition-smooth">
                  <CardContent className="p-6">
                     <div className="space-y-4">
                       <div className="flex items-start gap-4">
                         {job.company?.logo_url && (
                           <img 
                             src={job.company.logo_url} 
                             alt={job.company?.name || job.company_name}
                             className="h-12 w-12 rounded object-cover"
                           />
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-foreground">{job.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Building className="h-4 w-4" />
                              <span>{job.company_name || job.company?.name}</span>
                            </div>
                          </div>
                         <div className="flex items-center gap-2">
                           <Badge variant={hasApplied ? "secondary" : "outline"}>
                             {hasApplied ? 'Applied' : job.employment_type}
                           </Badge>
                           {isJobOwner(job) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{job.location}</span>
                        </div>
                        {job.remote_option && (
                          <Badge variant="secondary" className="text-xs">
                            {job.remote_option}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatTimeAgo(job.posted_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        {formatSalary(job) && (
                          <div className="flex items-center gap-1 text-primary font-medium">
                            <DollarSign className="h-4 w-4" />
                            <span>{formatSalary(job)}</span>
                          </div>
                        )}
                        <div className="flex gap-2 ml-auto">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedJob(job);
                            }}
                          >
                            View Details
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => {
                              setSelectedJob(job);
                              setShowApplyDialog(true);
                            }}
                            disabled={hasApplied}
                          >
                            {hasApplied ? 'Applied' : 'Apply Now'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
                        <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
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
                <label className="text-sm font-medium">Cover Letter (Optional)</label>
                <Textarea
                  placeholder="Tell the employer why you're a great fit for this position..."
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={6}
                  className="mt-2"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
                  Cancel
                </Button>
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
                       {/* FIXED: Show company_name or fallback */}
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
                fetchJobs();
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