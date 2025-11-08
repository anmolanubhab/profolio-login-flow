import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Clock, Building, DollarSign, Search, Briefcase, Plus, MoreVertical, Edit, Trash2 } from 'lucide-react';
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

interface Job {
  id: string;
  title: string;
  company_name: string;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showPostJobDialog, setShowPostJobDialog] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
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
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredJobs(jobs);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = jobs.filter(job => {
        const companyName = job.company_name || job.company?.name || '';
        return (
          job.title.toLowerCase().includes(query) ||
          companyName.toLowerCase().includes(query) ||
          job.location.toLowerCase().includes(query) ||
          job.description.toLowerCase().includes(query)
        );
      });
      setFilteredJobs(filtered);
    }
  }, [searchQuery, jobs]);

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
        .select('job_id')
        .eq('user_id', profile.id);

      if (error) throw error;
      setAppliedJobs(new Set(data?.map(app => app.job_id) || []));
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by job title, company, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-muted focus:border-primary/50"
              />
            </div>
          </CardContent>
        </Card>

        {filteredJobs.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card shadow-card border-0">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No jobs found matching your search.' : 'No job openings available at the moment.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
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