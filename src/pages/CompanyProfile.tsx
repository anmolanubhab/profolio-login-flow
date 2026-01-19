import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
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
  FileText
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
}

export default function CompanyProfile() {
  const { companyId } = useParams<{ companyId: string }>();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  
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
    if (companyId) {
      fetchJobs();
    }
  }, [companyId]);

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, location, employment_type, salary_min, salary_max, currency, posted_at')
        .eq('company_id', companyId)
        .eq('status', 'open')
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoadingJobs(false);
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
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-16 px-4 text-center">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Company Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The company you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/jobs">Browse Jobs</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        {/* Company Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="w-24 h-24 rounded-xl object-cover border-2 border-border"
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center border-2 border-border">
                  <Building2 className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
                    {company.industry && (
                      <Badge variant="secondary" className="mt-2">
                        {company.industry}
                      </Badge>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
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
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invite Team
                        </Button>
                        <Button 
                          onClick={() => setPostDialogOpen(true)}
                          className="bg-primary hover:bg-primary/90"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Post
                        </Button>
                      </>
                    )}
                    {company.website && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={company.website} target="_blank" rel="noopener noreferrer">
                          <Globe className="w-4 h-4 mr-2" />
                          Website
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
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
              <>
                <Separator className="my-6" />
                <div>
                  <h2 className="font-semibold text-foreground mb-2">About</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">{company.description}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Content */}
        <Tabs defaultValue="posts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Posts</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">About</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              <span className="hidden sm:inline">Jobs ({jobs.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts">
            <CompanyPostsFeed companyId={companyId!} companyName={company.name} />
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about">
            {(company.culture || (company.values && company.values.length > 0)) ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-primary" />
                    Culture & Values
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {company.culture && (
                    <div>
                      <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Our Culture
                      </h3>
                      <p className="text-muted-foreground whitespace-pre-wrap">{company.culture}</p>
                    </div>
                  )}
                  
                  {company.values && company.values.length > 0 && (
                    <div>
                      <h3 className="font-medium text-foreground mb-3">Our Values</h3>
                      <div className="flex flex-wrap gap-2">
                        {company.values.map((value, index) => (
                          <Badge key={index} variant="outline" className="text-sm py-1 px-3">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Heart className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No culture information available yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team">
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
          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Open Positions ({jobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingJobs ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No open positions at the moment.</p>
                    <p className="text-sm">Check back later for new opportunities!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <Link
                        key={job.id}
                        to={`/jobs?job=${job.id}`}
                        className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate">{job.title}</h3>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                              {job.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {job.location}
                                </span>
                              )}
                              {job.employment_type && (
                                <Badge variant="secondary" className="text-xs">
                                  {job.employment_type}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm shrink-0">
                            {formatSalary(job.salary_min, job.salary_max, job.currency) && (
                              <p className="font-medium text-foreground">
                                {formatSalary(job.salary_min, job.salary_max, job.currency)}
                              </p>
                            )}
                            <p className="text-muted-foreground text-xs mt-1">
                              Posted {formatDate(job.posted_at)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Company Insights (Admin only) */}
        {isAdmin && companyId && (
          <CompanyInsights companyId={companyId} companyName={company.name} />
        )}
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
        onInvite={inviteEmployee}
      />
    </Layout>
  );
}