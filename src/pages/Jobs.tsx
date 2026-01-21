import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Clock, Building, DollarSign, Briefcase, Plus, MoreVertical, Edit, Trash2 } from 'lucide-react';
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

import { JobDetailsDialog } from '@/components/jobs/JobDetailsDialog';

import { statusConfig, ApplicationStatus } from '@/config/applicationStatus';

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

const Jobs = ({ createMode = false }: { createMode?: boolean }) => {
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
  const [appliedJobs, setAppliedJobs] = useState<Map<string, string>>(new Map());
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyIdParam = searchParams.get('companyId');

  useEffect(() => {
    if (createMode) {
      setShowPostJobDialog(true);
    }
  }, [createMode]);

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

      const handleFocus = () => {
        fetchApplications();
      };

      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('applications')
        .select('job_id, status')
        .eq('user_id', profile.id);

      if (error) throw error;
      const jobsMap = new Map<string, string>();
      data?.forEach(app => jobsMap.set(app.job_id, app.status));
      setAppliedJobs(jobsMap);
    } catch (error: any) {
      console.error('Error fetching applications:', error);
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { error } = await supabase
        .from('applications')
        .insert({
          job_id: selectedJob.id,
          user_id: profile.id,
          cover_letter: coverLetter.trim() || null,
          status: 'applied',
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Application submitted successfully!',
      });

      setAppliedJobs(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedJob.id, 'applied');
        return newMap;
      });
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
      <div className="container mx-auto max-w-4xl">
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
          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const hasApplied = appliedJobs.has(job.id);
              const status = appliedJobs.get(job.id);
              const config = status ? statusConfig[status as ApplicationStatus] : null;

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
                           <Badge variant={hasApplied ? "secondary" : "outline"} className={hasApplied && config ? config.color : ''}>
                             {hasApplied ? (
                               <div className="flex items-center gap-1">
                                 {config?.icon && <config.icon className="w-3 h-3" />}
                                 {config ? config.label : (status ? (status.charAt(0).toUpperCase() + status.slice(1)) : 'Applied')}
                               </div>
                             ) : job.employment_type}
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
                            {hasApplied ? (
                              <>
                                {config?.icon && <config.icon className="w-4 h-4 mr-1.5" />}
                                {config ? config.label : (status ? (status.charAt(0).toUpperCase() + status.slice(1)) : 'Applied')}
                              </>
                            ) : 'Apply Now'}
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
        <JobDetailsDialog 
          open={!!selectedJob && !showApplyDialog} 
          onOpenChange={(open) => !open && setSelectedJob(null)}
          jobId={selectedJob?.id || ''}
          isApplied={selectedJob ? appliedJobs.has(selectedJob.id) : false}
          onApply={() => setShowApplyDialog(true)}
          applicationStatus={selectedJob ? appliedJobs.get(selectedJob.id) : undefined}
        />

          {/* Post/Edit Job Dialog */}
          {profileId && (
            <PostJobDialog
              open={showPostJobDialog}
              onOpenChange={(open) => {
                setShowPostJobDialog(open);
                if (!open) {
                  setEditingJob(null);
                  if (createMode) navigate('/jobs');
                }
              }}
              profileId={profileId}
              editJob={editingJob}
              initialCompanyId={companyIdParam || undefined}
              onJobPosted={() => {
                fetchJobs();
                setEditingJob(null);
                if (createMode) navigate('/jobs');
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