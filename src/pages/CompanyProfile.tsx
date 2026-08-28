import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PostCard from '@/components/PostCard';
import HiringPipeline from '@/components/jobs/HiringPipeline';
import { CompanyTeamManager } from '@/components/jobs/CompanyTeamManager';
import { CompanyDialog } from '@/components/jobs/CompanyDialog';
import { ReactionType } from '@/components/ReactionBar';
import { PollData, buildPollSummary, buildReactionSummary } from '@/lib/postAggregation';
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
  Rss,
  Plus,
  Check,
  MessageSquare,
  MoreHorizontal,
  Link as LinkIcon,
  Pencil,
  ChevronRight,
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  description: string | null;
  tagline: string | null;
  industry: string | null;
  location: string | null;
  headquarters: string | null;
  website: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  employee_count: string | null;
  founded_year: number | null;
  culture: string | null;
  values: string[] | null;
  specialties: string[] | null;
  owner_id: string | null;
}

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

interface CompanyPost {
  id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  document_url: string | null;
  document_name: string | null;
  carousel_urls: string[] | null;
  post_type: string;
  created_at: string;
  cta_enabled: boolean | null;
  cta_label: string | null;
  cta_url: string | null;
  cta_open_new_tab: boolean | null;
  post_reactions: { id: string; user_id: string; reaction_type: ReactionType }[];
  polls: PollData | null;
}

const TAB_TRIGGER =
  'rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 font-semibold text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

export default function CompanyProfile() {
  const { companyId } = useParams<{ companyId: string }>();
  const [searchParams] = useSearchParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const [posts, setPosts] = useState<CompanyPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const [tab, setTab] = useState('home');

  const isOwner = !!company && !!currentUserProfileId && company.owner_id === currentUserProfileId;

  useEffect(() => {
    if (companyId) {
      fetchCompanyData();
      fetchCompanyPosts();
      fetchFollowState();
      fetchAdminState();
    }
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, [companyId]);

  const fetchAdminState = async () => {
    if (!companyId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('is_company_admin', {
        _user_id: user.id,
        _company_id: companyId,
      });
      if (error) throw error;
      setIsTeamAdmin(!!data);
      if (data && searchParams.get('manageTeam') === '1') {
        setShowTeamManager(true);
      }
    } catch (error) {
      console.error('Error checking company admin state:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (companyError) throw companyError;
      setCompany(companyData as Company | null);

      if (companyData) {
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, title, location, employment_type, salary_min, salary_max, currency, posted_at')
          .eq('company_id', companyId)
          .eq('status', 'open')
          .order('posted_at', { ascending: false });

        if (jobsError) throw jobsError;
        setJobs(jobsData || []);
      }
    } catch (error) {
      console.error('Error fetching company data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowState = async () => {
    if (!companyId) return;
    try {
      const { count } = await supabase
        .from('company_followers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      setFollowerCount(count || 0);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!profile) return;
      setCurrentUserProfileId(profile.id);

      const { data: existing } = await supabase
        .from('company_followers')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', profile.id)
        .maybeSingle();
      setIsFollowing(!!existing);
    } catch (error) {
      console.error('Error fetching follow state:', error);
    }
  };

  const handleToggleFollow = async () => {
    if (!companyId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to follow companies.', variant: 'destructive' });
      return;
    }

    setFollowLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!profile) return;

      if (isFollowing) {
        await supabase
          .from('company_followers')
          .delete()
          .eq('company_id', companyId)
          .eq('user_id', profile.id);
        setIsFollowing(false);
        setFollowerCount((prev) => Math.max(0, prev - 1));
      } else {
        await supabase.from('company_followers').insert({ company_id: companyId, user_id: profile.id });
        setIsFollowing(true);
        setFollowerCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({ title: 'Error', description: 'Could not update follow status. Please try again.', variant: 'destructive' });
    } finally {
      setFollowLoading(false);
    }
  };

  const fetchCompanyPosts = async () => {
    if (!companyId) return;
    setPostsLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, content, image_url, video_url, document_url, document_name, carousel_urls, post_type, created_at,
          cta_enabled, cta_label, cta_url, cta_open_new_tab,
          post_reactions ( id, user_id, reaction_type ),
          polls (
            id,
            question,
            poll_options ( id, option_text, position ),
            poll_votes ( id, option_id, user_id )
          )
        `)
        .eq('company_id', companyId)
        .eq('posted_as', 'company')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts((data as unknown as CompanyPost[]) || []);
    } catch (error) {
      console.error('Error fetching company posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  const handleReact = async (postId: string, type: ReactionType | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
      if (!profile) return;

      if (type === null) {
        await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', profile.id);
      } else {
        await supabase.from('post_reactions').upsert(
          { post_id: postId, user_id: profile.id, reaction_type: type },
          { onConflict: 'post_id,user_id' }
        );
      }

      fetchCompanyPosts();
    } catch (error) {
      console.error('Error updating reaction:', error);
      toast({ title: 'Error', description: 'Could not update your reaction. Please try again.', variant: 'destructive' });
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
      if (!profile) return;

      const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: profile.id });
      if (error && error.code !== '23505') throw error;

      fetchCompanyPosts();
    } catch (error) {
      console.error('Error casting vote:', error);
      toast({ title: 'Error', description: 'Could not cast your vote. Please try again.', variant: 'destructive' });
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copied', description: 'Company page link copied to your clipboard.' });
    } catch {
      toast({ title: 'Could not copy', description: window.location.href });
    }
  };

  const formatSalary = (min: number | null, max: number | null, currency: string | null) => {
    if (!min && !max) return null;
    const curr = currency || 'USD';
    if (min && max) return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`;
    if (min) return `${curr} ${min.toLocaleString()}+`;
    return `Up to ${curr} ${max?.toLocaleString()}`;
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <Layout user={currentUser} onSignOut={handleSignOut}>
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
      <Layout user={currentUser} onSignOut={handleSignOut}>
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

  const hqOrLocation = company.headquarters || company.location;
  const metaParts = [company.industry, hqOrLocation].filter(Boolean) as string[];

  const overviewText = company.description || company.tagline || '';

  const renderPost = (post: CompanyPost) => (
    <PostCard
      key={post.id}
      id={post.id}
      user={{ id: company.id, name: company.name, avatar: company.logo_url || undefined }}
      profileLink={`/company/${company.id}`}
      content={post.content}
      image={post.image_url || undefined}
      timestamp={post.created_at}
      postType={post.post_type}
      videoUrl={post.video_url || undefined}
      documentUrl={post.document_url || undefined}
      documentName={post.document_name || undefined}
      carouselUrls={post.carousel_urls || undefined}
      poll={buildPollSummary(post.polls, currentUserProfileId)}
      onVote={(optionId) => post.polls && handleVote(post.polls.id, optionId)}
      reactionSummary={buildReactionSummary(post.post_reactions || [], currentUserProfileId)}
      onReact={(type) => handleReact(post.id, type)}
      onDelete={() => handleDeletePost(post.id)}
      cta={
        post.cta_enabled && post.cta_label && post.cta_url
          ? { label: post.cta_label, url: post.cta_url, openNewTab: post.cta_open_new_tab }
          : null
      }
      companyId={company.id}
    />
  );

  const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="py-3">
      <dt className="text-sm font-semibold text-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-muted-foreground">{children}</dd>
    </div>
  );

  return (
    <Layout user={currentUser} onSignOut={handleSignOut}>
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-4">
        {/* ===== Header card: cover + logo + identity + actions ===== */}
        <Card className="overflow-hidden">
          {/* Cover */}
          <div className="h-32 sm:h-44 w-full bg-gradient-to-r from-primary/25 via-primary/10 to-accent/20">
            {company.cover_image_url && (
              <img src={company.cover_image_url} alt="" className="h-full w-full object-cover" />
            )}
          </div>

          <CardContent className="px-6 pb-6">
            {/* Logo overlapping cover */}
            <div className="-mt-12 mb-3 h-24 w-24 rounded-xl border-2 border-background bg-background shadow-sm overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
                {company.tagline && (
                  <p className="mt-0.5 text-foreground/80">{company.tagline}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  {metaParts.join(' · ')}
                  {metaParts.length > 0 && ' · '}
                  {followerCount.toLocaleString()} {followerCount === 1 ? 'follower' : 'followers'}
                </p>
                {company.employee_count && (
                  <p className="text-sm text-muted-foreground">{company.employee_count} employees</p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                onClick={handleToggleFollow}
                disabled={followLoading}
                variant={isFollowing ? 'outline' : 'default'}
              >
                {isFollowing ? (
                  <>
                    <Check className="mr-1.5 h-4 w-4" /> Following
                  </>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-4 w-4" /> Follow
                  </>
                )}
              </Button>

              <Button variant="outline" onClick={() => navigate('/connect')}>
                <MessageSquare className="mr-1.5 h-4 w-4" /> Message
              </Button>

              {isOwner && (
                <Button variant="outline" onClick={() => setShowEditDialog(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit page
                </Button>
              )}

              {isTeamAdmin && (
                <Button variant="outline" onClick={() => setShowTeamManager((prev) => !prev)}>
                  <Users className="mr-1.5 h-4 w-4" />
                  {showTeamManager ? 'Hide Team' : 'Manage Team'}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {company.website && (
                    <DropdownMenuItem asChild>
                      <a href={company.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="mr-2 h-4 w-4" /> Visit website
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <LinkIcon className="mr-2 h-4 w-4" /> Copy link
                  </DropdownMenuItem>
                  {isOwner && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/companies')}>
                        <Building2 className="mr-2 h-4 w-4" /> My Companies
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>

          {/* Tab bar */}
          <div className="border-t border-border px-6">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-auto gap-6 rounded-none bg-transparent p-0">
                <TabsTrigger value="home" className={TAB_TRIGGER}>Home</TabsTrigger>
                <TabsTrigger value="about" className={TAB_TRIGGER}>About</TabsTrigger>
                <TabsTrigger value="posts" className={TAB_TRIGGER}>
                  Posts{posts.length > 0 ? ` (${posts.length})` : ''}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Card>

        {/* Team management -- owner/admin only */}
        {isTeamAdmin && showTeamManager && <CompanyTeamManager companyId={company.id} />}

        {/* ===== Tab content ===== */}
        <Tabs value={tab} onValueChange={setTab}>
          {/* ---------- HOME ---------- */}
          <TabsContent value="home" className="mt-0 space-y-4">
            {overviewText && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{overviewText}</p>
                  <Button
                    variant="link"
                    className="mt-1 h-auto p-0 text-sm"
                    onClick={() => setTab('about')}
                  >
                    Show all details <ChevronRight className="ml-0.5 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Rss className="h-5 w-5 text-primary" /> Recent updates
                </CardTitle>
                {posts.length > 2 && (
                  <Button variant="link" className="h-auto p-0 text-sm" onClick={() => setTab('posts')}>
                    See all posts
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {postsLoading ? (
                  <div className="space-y-3 p-6">
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground">
                    <Rss className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>No updates yet.</p>
                    <p className="text-sm">Follow {company.name} to see their posts in your feed.</p>
                  </div>
                ) : (
                  <div className="feed">{posts.slice(0, 2).map(renderPost)}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Briefcase className="h-5 w-5 text-primary" /> Open positions ({jobs.length})
                </CardTitle>
                {jobs.length > 0 && (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => navigate(`/jobs?company=${company.id}`)}
                  >
                    View all jobs
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">
                    <p>No open positions at the moment.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobs.slice(0, 4).map((job) => (
                      <Link
                        key={job.id}
                        to={`/jobs?job=${job.id}`}
                        className="block rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-accent/50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-medium text-foreground">{job.title}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              {job.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
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
                          <div className="shrink-0 text-right text-sm">
                            {formatSalary(job.salary_min, job.salary_max, job.currency) && (
                              <p className="font-medium text-foreground">
                                {formatSalary(job.salary_min, job.salary_max, job.currency)}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">Posted {formatDate(job.posted_at)}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------- ABOUT ---------- */}
          <TabsContent value="about" className="mt-0 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {company.description ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{company.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No overview provided yet.</p>
                )}

                <Separator className="my-2" />
                <dl className="divide-y divide-border">
                  {company.website && (
                    <DetailRow label="Website">
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {company.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </DetailRow>
                  )}
                  {company.industry && <DetailRow label="Industry">{company.industry}</DetailRow>}
                  {company.employee_count && (
                    <DetailRow label="Company size">{company.employee_count} employees</DetailRow>
                  )}
                  {company.headquarters && <DetailRow label="Headquarters">{company.headquarters}</DetailRow>}
                  {company.founded_year && <DetailRow label="Founded">{company.founded_year}</DetailRow>}
                  {company.specialties && company.specialties.length > 0 && (
                    <DetailRow label="Specialties">
                      <div className="flex flex-wrap gap-1.5">
                        {company.specialties.map((s, i) => (
                          <Badge key={i} variant="secondary" className="font-normal">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </DetailRow>
                  )}
                </dl>
              </CardContent>
            </Card>

            {(company.headquarters || company.location) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Locations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary</p>
                    <p className="mt-1 text-sm text-foreground">{company.headquarters || company.location}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        company.headquarters || company.location || ''
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5" /> Get directions
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

            {(company.culture || (company.values && company.values.length > 0)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-primary" /> Culture &amp; Values
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {company.culture && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 font-medium text-foreground">
                        <Target className="h-4 w-4" /> Our Culture
                      </h3>
                      <p className="whitespace-pre-wrap text-muted-foreground">{company.culture}</p>
                    </div>
                  )}
                  {company.values && company.values.length > 0 && (
                    <div>
                      <h3 className="mb-3 font-medium text-foreground">Our Values</h3>
                      <div className="flex flex-wrap gap-2">
                        {company.values.map((value, index) => (
                          <Badge key={index} variant="outline" className="px-3 py-1 text-sm">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ---------- POSTS ---------- */}
          <TabsContent value="posts" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rss className="h-5 w-5 text-primary" /> Updates
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {postsLoading ? (
                  <div className="space-y-3 p-6">
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground">
                    <Rss className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>No updates yet.</p>
                    <p className="text-sm">Follow {company.name} to see their posts in your feed.</p>
                  </div>
                ) : (
                  <div className="feed">{posts.map(renderPost)}</div>
                )}
              </CardContent>
            </Card>

            {jobs.length > 0 && (
              <HiringPipeline companyId={company.id} jobs={jobs.map((j) => ({ id: j.id, title: j.title }))} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {isOwner && currentUserProfileId && (
        <CompanyDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          profileId={currentUserProfileId}
          editCompany={company as any}
          onCompanyCreated={() => {
            setShowEditDialog(false);
            fetchCompanyData();
          }}
        />
      )}
    </Layout>
  );
}
