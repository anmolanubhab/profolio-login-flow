import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/use-company';
import { useAuth } from '@/contexts/AuthContext';
import { CompanyInsights } from '@/components/company/CompanyInsights';
import { CompanyPostDialog } from '@/components/company/CompanyPostDialog';
import { CompanyMembersCard } from '@/components/company/CompanyMembersCard';
import { CompanyPostsFeed } from '@/components/company/CompanyPostsFeed';
import { FollowCompanyButton } from '@/components/company/FollowCompanyButton';
import { InviteEmployeeDialog } from '@/components/company/InviteEmployeeDialog';
import { PostJobDialog } from '@/components/jobs/PostJobDialog';
import { JobApplicantsDialog } from '@/components/jobs/JobApplicantsDialog';
import { useToast } from '@/hooks/use-toast';
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
import { 
  Building2, 
  MapPin, 
  Globe, 
  Users, 
  Calendar, 
  Briefcase,
  ExternalLink,
  Heart,
  Target,
  Plus,
  UserPlus,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  RefreshCw,
  BarChart2
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  posted_at: string;
  status: string;
  description: string;
  requirements: string;
  remote_option: string;
  apply_link: string;
  company_name: string;
  applications: { count: number }[];
}

export default function CompanyProfile() {
  const { companyId } = useParams<{ companyId: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isValidUuid = (id?: string) =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

  // Determine default tab based on URL path
  const defaultTab = location.pathname.endsWith('/jobs') ? 'jobs' : 'posts';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [postJobDialogOpen, setPostJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [applicantsDialogOpen, setApplicantsDialogOpen] = useState(false);
  const [selectedJobForApplicants, setSelectedJobForApplicants] = useState<Job | null>(null);
  
  const {
    company,
    members,
    isLoading,
    isAdmin,
    isFollowing,
    followerCount,
    profileId,
    followCompany,
    unfollowCompany,
    inviteEmployee,
    removeMember,
    updateMemberRole,
    refetchMembers
  } = useCompany(companyId);

  useEffect(() => {
    if (companyId && isValidUuid(companyId) && !isLoading) {
      const controller = new AbortController();
      fetchJobs(controller.signal);
      return () => controller.abort();
    }
  }, [companyId, isAdmin, isLoading]);

  const fetchJobs = async (signal?: AbortSignal) => {
    if (!companyId || !isValidUuid(companyId)) return;
    
    setLoadingJobs(true);
    try {
      let query = supabase
        .from('jobs')
        .select(`
          id, title, location, employment_type, salary_min, salary_max, currency, posted_at, status,
          description, requirements, remote_option, apply_link, company_name,
          applications(count)
        `)
        .eq('company_id', companyId)
        .order('posted_at', { ascending: false });

      // Add abort signal if provided
      if (signal) {
        query = query.abortSignal(signal);
      }

      // If not admin, only show open jobs
      if (!isAdmin) {
        query = query.eq('status', 'open');
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === 'ABORTED' || (error as any).name === 'AbortError') return;
        throw error;
      }
      
      // Transform data to match Job interface (Supabase returns count as array of objects)
      const transformedJobs = (data || []).map((job: any) => ({
        ...job,
        applications: job.applications || []
      }));
      
      setJobs(transformedJobs);
    } catch (error) {
      if ((error as any).name === 'AbortError' || (error as any).code === 'ABORTED') return;
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobToDelete);

      if (error) throw error;

      toast({
        title: "Job deleted",
        description: "The job position has been removed.",
      });

      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: "Failed to delete job. Please try again.",
        variant: "destructive",
      });
    } finally {
      setJobToDelete(null);
    }
  };

  const handleToggleStatus = async (job: Job) => {
    const newStatus = job.status === 'open' ? 'closed' : 'open';
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', job.id);

      if (error) throw error;

      toast({
        title: `Job ${newStatus}`,
        description: `The job is now ${newStatus}.`,
      });

      fetchJobs();
    } catch (error) {
      console.error('Error updating job status:', error);
      toast({
        title: "Error",
        description: "Failed to update job status.",
        variant: "destructive",
      });
    }
  };

  const handleRepost = async (job: Job) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ 
          posted_at: new Date().toISOString(),
          status: 'open'
        })
        .eq('id', job.id);

      if (error) throw error;

      toast({
        title: "Job Reposted",
        description: "The job has been moved to the top of the feed.",
      });

      fetchJobs();
    } catch (error) {
      console.error('Error reposting job:', error);
      toast({
        title: "Error",
        description: "Failed to repost job.",
        variant: "destructive",
      });
    }
  };

  const formatSalary = (min: number | null, max: number | null, currency: string | null) => {
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

  if (isLoading) {
    return (
      <Layout>
        <div className="w-full bg-white pb-20 min-h-screen">
          <div className="max-w-4xl mx-auto py-8 px-0 sm:px-4 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="w-full bg-white pb-20 min-h-screen">
          <div className="max-w-4xl mx-auto py-16 px-0 sm:px-4 text-center">
            <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Company Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The company you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild>
              <Link to="/jobs">Browse Jobs</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full bg-white pb-20 min-h-screen">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-4xl mx-auto pt-4 pb-10 px-6 relative">
            <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between gap-6 md:gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-3 tracking-tight">
                  Company Profile
                </h1>
                <p className="text-[#5E6B7E] text-base md:text-xl font-medium max-w-2xl mx-auto md:mx-0">
                  {company.name} • {company.industry || 'Professional Network'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto py-8 px-0 sm:px-4 space-y-4 sm:space-y-6">
          {/* Company Header */}
          <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
            <div className="h-36 w-full relative shrink-0">
              {(() => {
                const values: string[] = company.values || [];
                const getMeta = (key: string) => {
                  const token = values.find((v) => v.startsWith(`__meta_${key}:`));
                  if (!token) return undefined;
                  return token.substring(token.indexOf(':') + 1);
                };
                const bannerUrl = getMeta('banner_url');
                const bannerStyle = getMeta('banner_style');
                let bannerGradient = "from-[#0077B5] via-[#833AB4] to-[#E1306C]";
                if (bannerStyle === "blue-teal") bannerGradient = "from-sky-400 via-cyan-500 to-teal-500";
                if (bannerStyle === "violet-purple") bannerGradient = "from-violet-500 via-purple-500 to-indigo-500";
                if (bannerStyle === "amber-orange") bannerGradient = "from-amber-400 via-orange-400 to-red-400";
                if (bannerStyle === "rose-pink") bannerGradient = "from-rose-400 via-pink-500 to-fuchsia-500";
                return bannerUrl ? (
                  <div className="w-full h-full flex items-center justify-center bg-white">
                    <img src={bannerUrl} alt={`${company.name} banner`} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className={`w-full h-full bg-gradient-to-r ${bannerGradient}`} />
                );
              })()}
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
            </div>
            <CardContent className="px-4 py-6 sm:px-8 sm:pb-8">
              <div className="flex flex-col sm:flex-row gap-6">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="w-24 h-24 rounded-xl object-cover border border-gray-100"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
                    <Building2 className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                      {company.industry && (
                        <Badge variant="secondary" className="mt-2 bg-gray-100 text-gray-700 hover:bg-gray-200 border-0">
                          {company.industry}
                        </Badge>
                      )}
                      <p className="text-sm text-gray-500 mt-2">
                        {followerCount} followers • {members.length} team member{members.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {user && !isAdmin && (
                        <FollowCompanyButton
                          isFollowing={isFollowing}
                          onFollow={followCompany}
                          onUnfollow={unfollowCompany}
                        />
                      )}
                      {isAdmin && (
                        <>
                          <Button 
                            variant="outline"
                            onClick={() => setInviteDialogOpen(true)}
                            size="sm"
                            className="rounded-full border-gray-200"
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Invite Team
                          </Button>
                          <Button 
                            onClick={() => setPostDialogOpen(true)}
                            className="bg-primary hover:bg-primary/90 text-white rounded-full shadow-sm"
                            size="sm"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Post
                          </Button>
                          <Button 
                            onClick={() => setPostJobDialogOpen(true)}
                            variant="outline"
                            size="sm"
                            className="rounded-full border-gray-200"
                          >
                            <Briefcase className="w-4 h-4 mr-2" />
                            Post a Job
                          </Button>
                        </>
                      )}
                      {company.website && (
                        <Button variant="outline" size="sm" asChild className="rounded-full border-gray-200">
                          <a href={company.website} target="_blank" rel="noopener noreferrer">
                            <Globe className="w-4 h-4 mr-2" />
                            Website
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
                    {company.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{company.location}</span>
                      </div>
                    )}
                    {company.employee_count && (
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{company.employee_count} employees</span>
                      </div>
                    )}
                    {company.founded_year && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Founded {company.founded_year}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {company.description && (
                <div className="mt-8 pt-8 border-t border-gray-50">
                  <h2 className="font-semibold text-gray-900 mb-2">About</h2>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{company.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs for Content */}
          <div className="px-0 sm:px-0">
            <Tabs defaultValue={defaultTab} className="space-y-4">
              <div className="px-4 sm:px-0">
                <TabsList className="grid w-full grid-cols-4 bg-gray-100/50 p-1 rounded-2xl">
                  <TabsTrigger value="posts" className="flex items-center gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Posts</span>
                  </TabsTrigger>
                  <TabsTrigger value="about" className="flex items-center gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Heart className="w-4 h-4" />
                    <span className="hidden sm:inline">About</span>
                  </TabsTrigger>
                  <TabsTrigger value="team" className="flex items-center gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Team</span>
                  </TabsTrigger>
                  <TabsTrigger value="jobs" className="flex items-center gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Briefcase className="w-4 h-4" />
                    <span className="hidden sm:inline">Jobs ({jobs.length})</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Posts Tab */}
              <TabsContent value="posts" className="mt-4 focus-visible:outline-none">
                <CompanyPostsFeed companyId={companyId!} companyName={company.name} />
              </TabsContent>

              {/* About Tab */}
              <TabsContent value="about" className="space-y-4 sm:space-y-6 mt-4 focus-visible:outline-none">
                {isAdmin && companyId && (
                  <CompanyInsights companyId={companyId} companyName={company.name} />
                )}
                {(company.culture || (company.values && company.values.length > 0)) ? (
                  <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
                    <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4 border-b border-gray-50">
                      <CardTitle className="flex items-center gap-2 text-gray-900">
                        <Heart className="w-5 h-5 text-primary" />
                        Culture & Values
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 py-6 sm:px-8 sm:pb-8 space-y-6">
                      {company.culture && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <Target className="w-4 h-4 text-gray-500" />
                            Our Culture
                          </h3>
                          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{company.culture}</p>
                        </div>
                      )}
                      
                      {company.values && company.values.filter(v => !v.startsWith('__meta_')).length > 0 && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Our Values</h3>
                          <div className="flex flex-wrap gap-2">
                            {company.values.filter(v => !v.startsWith('__meta_')).map((value, index) => (
                              <Badge key={index} variant="outline" className="text-sm py-1.5 px-4 bg-gray-50/50 border-gray-100 text-gray-700">
                                {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
                    <CardContent className="px-4 py-12 sm:px-8 sm:pb-8 text-center">
                      <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">No culture information available yet.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Team Tab */}
              <TabsContent value="team" className="mt-4 focus-visible:outline-none">
                <CompanyMembersCard
                  members={members}
                  isAdmin={isAdmin}
                  ownerId={company.owner_id}
                  onRemoveMember={removeMember}
                  onUpdateRole={updateMemberRole}
                  currentUserId={profileId || undefined}
                />
              </TabsContent>

              {/* Jobs Tab */}
              <TabsContent value="jobs" className="mt-4 focus-visible:outline-none">
                <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
                  <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4 border-b border-gray-50">
                    <CardTitle className="flex items-center gap-2 text-gray-900">
                      <Briefcase className="w-5 h-5 text-primary" />
                      {isAdmin ? 'Manage Jobs' : `Open Positions (${jobs.length})`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 py-6 sm:px-8 sm:pb-8">
                    {loadingJobs ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                        ))}
                      </div>
                    ) : jobs.length > 0 ? (
                      <div className="space-y-4">
                        {jobs.map((job) => (
                          <div
                            key={job.id}
                            className="flex flex-col sm:flex-row gap-4 p-5 rounded-2xl border border-gray-100 hover:border-primary/20 hover:bg-primary/[0.02] transition-all duration-300 group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Link to={`/jobs?job=${job.id}`} className="font-bold text-gray-900 hover:text-primary hover:underline transition-colors text-lg">
                                      {job.title}
                                    </Link>
                                    {isAdmin && (
                                      <Badge variant={job.status === 'open' ? 'default' : 'secondary'} className={cn(
                                        "capitalize rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                        job.status === 'open' ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                                      )}>
                                        {job.status}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                                    {job.location && (
                                      <span className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                        {job.location}
                                      </span>
                                    )}
                                    {job.employment_type && (
                                      <span className="flex items-center gap-1.5">
                                        <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                                        {job.employment_type}
                                      </span>
                                    )}
                                    {isAdmin && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="p-0 h-auto font-semibold text-primary hover:text-primary/80 hover:bg-transparent"
                                        onClick={() => {
                                          setSelectedJobForApplicants(job);
                                          setApplicantsDialogOpen(true);
                                        }}
                                      >
                                        <Users className="w-4 h-4 mr-1.5" />
                                        {job.applications[0]?.count || 0} Applicants
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                
                                {isAdmin && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <MoreHorizontal className="w-4 h-4 text-gray-500" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl shadow-lg border-gray-100">
                                      <DropdownMenuItem 
                                        className="rounded-lg py-2 cursor-pointer"
                                        onClick={() => {
                                          setSelectedJobForApplicants(job);
                                          setApplicantsDialogOpen(true);
                                        }}
                                      >
                                        <Users className="w-4 h-4 mr-2 text-gray-500" />
                                        View Applicants
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild className="rounded-lg py-2 cursor-pointer">
                                        <Link to={`/jobs/${job.id}/insights`} className="w-full flex items-center">
                                          <BarChart2 className="w-4 h-4 mr-2 text-gray-500" />
                                          View Insights
                                        </Link>
                                      </DropdownMenuItem>
                                      <div className="h-px bg-gray-50 my-1" />
                                      <DropdownMenuItem 
                                        className="rounded-lg py-2 cursor-pointer"
                                        onClick={() => {
                                          setEditingJob(job);
                                          setPostJobDialogOpen(true);
                                        }}
                                      >
                                        <Pencil className="w-4 h-4 mr-2 text-gray-500" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="rounded-lg py-2 cursor-pointer"
                                        onClick={() => handleToggleStatus(job)}
                                      >
                                        {job.status === 'open' ? (
                                          <>
                                            <Archive className="w-4 h-4 mr-2 text-gray-500" />
                                            Close Job
                                          </>
                                        ) : (
                                          <>
                                            <RotateCcw className="w-4 h-4 mr-2 text-gray-500" />
                                            Reopen Job
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="rounded-lg py-2 cursor-pointer"
                                        onClick={() => handleRepost(job)}
                                      >
                                        <RefreshCw className="w-4 h-4 mr-2 text-gray-500" />
                                        Repost
                                      </DropdownMenuItem>
                                      <div className="h-px bg-gray-50 my-1" />
                                      <DropdownMenuItem 
                                        className="text-destructive focus:text-destructive focus:bg-destructive/5 rounded-lg py-2 cursor-pointer font-medium"
                                        onClick={() => setJobToDelete(job.id)}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-100 rounded-[2rem] bg-gray-50/30">
                        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4">
                          <Briefcase className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No jobs posted yet</h3>
                        <p className="text-gray-500 max-w-[260px] mx-auto">
                          This company hasn't listed any open positions at the moment.
                        </p>
                      </div>
                    )} 
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Company Post Dialog */}
      {company && (
        <CompanyPostDialog
          open={postDialogOpen}
          onOpenChange={setPostDialogOpen}
          companies={[{
            company_id: company.id,
            company: {
              id: company.id,
              name: company.name,
              logo_url: company.logo_url
            }
          }]}
        />
      )}

      {/* Invite Employee Dialog */}
      <InviteEmployeeDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        companyName={company?.name || ''}
        onInvite={async (email, role) => {
          const res = await inviteEmployee(email, role);
          if (res.success) {
            return { success: true, token: String((res as any).token ?? '') };
          }
          return { success: false, error: typeof (res as any).error === 'string' ? (res as any).error : 'Invitation failed' };
        }}
      />

      {/* Post Job Dialog */}
      {profileId && (
        <PostJobDialog
          open={postJobDialogOpen}
          onOpenChange={(open) => {
            setPostJobDialogOpen(open);
            if (!open) setEditingJob(null);
          }}
          profileId={profileId}
          editJob={editingJob}
          onJobPosted={() => {
            fetchJobs();
            setPostJobDialogOpen(false);
            setEditingJob(null);
          }}
        />
      )}

      <AlertDialog open={!!jobToDelete} onOpenChange={(open) => !open && setJobToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the job posting and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteJob} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <JobApplicantsDialog 
        jobId={selectedJobForApplicants?.id || null}
        jobTitle={selectedJobForApplicants?.title || ''}
        open={applicantsDialogOpen}
        onOpenChange={setApplicantsDialogOpen}
      />
    </Layout>
  );
}
