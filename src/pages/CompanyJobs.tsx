import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PostJobDialog } from '@/components/jobs/PostJobDialog';
import { JobApplicantsDialog } from '@/components/jobs/JobApplicantsDialog';
import {
  Briefcase,
  MapPin,
  DollarSign,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Building2,
  Users,
} from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';

interface Job {
  id: string;
  title: string;
  location: string;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  status: string;
  posted_at: string;
  company_id: string;
  company_name: string;
  description: string;
  requirements: string;
  remote_option: string;
  apply_link: string | null;
}

export default function CompanyJobs() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showPostJobDialog, setShowPostJobDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [viewingApplicantsJob, setViewingApplicantsJob] = useState<{ id: string; title: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user && companyId) {
      checkPermissionAndFetchData();
    }
  }, [user, companyId]);

  const checkPermissionAndFetchData = async () => {
    try {
      if (!user) return;

      // Get profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        navigate('/');
        return;
      }

      setProfileId(profile.id);

      // Check if user is owner or admin of the company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('name, owner_id')
        .eq('id', companyId)
        .single();

      if (companyError || !company) {
        navigate('/companies');
        return;
      }

      setCompanyName(company.name);

      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', profile.id)
        .single();

      const isOwner = company.owner_id === profile.id;
      const isMemberAdmin = member && (member.role === 'super_admin' || member.role === 'content_admin');

      if (!isOwner && !isMemberAdmin) {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to manage jobs for this company.',
          variant: 'destructive',
        });
        navigate('/companies');
        return;
      }

      setIsAdmin(true);
      fetchJobs();

    } catch (error) {
      console.error('Error checking permissions:', error);
      navigate('/companies');
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', companyId)
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load jobs.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!deletingJobId) return;

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', deletingJobId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Job deleted successfully.',
      });

      setJobs(jobs.filter(job => job.id !== deletingJobId));
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

  const formatSalary = (min: number | null, max: number | null, currency: string) => {
    if (!min && !max) return null;
    const curr = currency || 'USD';
    if (min && max) return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`;
    if (min) return `${curr} ${min.toLocaleString()}+`;
    return `Up to ${curr} ${max?.toLocaleString()}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto py-8 px-4">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Button 
              variant="ghost" 
              className="mb-2 pl-0 hover:bg-transparent hover:text-primary"
              onClick={() => navigate('/companies')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Companies
            </Button>
            <h1 className="text-3xl font-bold text-[#1D2226] flex items-center gap-2">
              <Building2 className="w-8 h-8 text-primary" />
              Jobs at {companyName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your job postings and applications
            </p>
          </div>
          <Button 
            onClick={() => setShowPostJobDialog(true)}
            className="bg-[#0A66C2] hover:bg-[#084c97]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Post New Job
          </Button>
        </div>

        {jobs.length === 0 ? (
          <Card className="border-2 border-dashed border-[#E5E7EB]">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Briefcase className="w-16 h-16 text-[#5E6B7E] mb-4" />
              <h3 className="text-xl font-semibold text-[#1D2226] mb-2">No jobs posted yet</h3>
              <p className="text-[#5E6B7E] mb-6 max-w-md">
                Start hiring by posting your first job opening for {companyName}
              </p>
              <Button
                onClick={() => setShowPostJobDialog(true)}
                className="bg-[#0A66C2] hover:bg-[#084c97] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Post Your First Job
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between md:justify-start gap-4">
                        <h3 className="text-xl font-semibold text-[#1D2226] hover:text-primary transition-colors cursor-pointer" onClick={() => setEditingJob(job)}>
                          {job.title}
                        </h3>
                        <Badge variant={job.status === 'open' ? 'default' : 'secondary'}>
                          {job.status === 'open' ? 'Active' : 'Closed'}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.location} ({job.remote_option})
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          {job.employment_type}
                        </div>
                        {formatSalary(job.salary_min, job.salary_max, job.currency) && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {formatSalary(job.salary_min, job.salary_max, job.currency)}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Posted {formatDate(job.posted_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 mt-4 md:mt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 md:flex-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('View applicants clicked', job.id);
                          toast({ title: 'Opening applicants view...' });
                          setViewingApplicantsJob({ id: job.id, title: job.title });
                        }}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        View Applicants
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingJob(job);
                          setShowPostJobDialog(true);
                        }}
                        className="flex-1 md:flex-none"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingJobId(job.id)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 flex-1 md:flex-none"
                      >
                        <Trash2 className="w-4 h-4 mr-2 md:mr-0" />
                        <span className="md:hidden">Delete</span>
                      </Button>
                    </div>
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
            onJobPosted={() => {
              fetchJobs();
              setEditingJob(null);
            }}
            editJob={editingJob}
            initialCompanyId={companyId}
          />
        )}

        {/* View Applicants Dialog */}
        {viewingApplicantsJob && (
          <JobApplicantsDialog
            key={viewingApplicantsJob.id}
            open={!!viewingApplicantsJob}
            onOpenChange={(open) => {
              if (!open) setViewingApplicantsJob(null);
            }}
            jobId={viewingApplicantsJob.id}
            jobTitle={viewingApplicantsJob.title}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingJobId} onOpenChange={() => setDeletingJobId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job Post</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this job posting? This action cannot be undone and will remove the job from all listings.
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
    </Layout>
  );
}