import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import Feed from '@/components/Feed';
import FloatingCreatePost from '@/components/FloatingCreatePost';
import Stories from '@/components/Stories';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MyApplications } from '@/components/jobs/MyApplications';
import { MyDrafts } from '@/components/jobs/MyDrafts';
import { ProfileSummaryCard } from '@/components/ProfileSummaryCard';
import { FeedRightRail } from '@/components/FeedRightRail';

// Which /dashboard "view" is active is carried in the URL (?tab=...) instead
// of only in component state, so the left-sidebar navigation (a sibling
// component) can link directly to a specific view and highlight itself as
// active -- same route, same TabsContent panels, just addressable.
const VALID_TABS = ['feed', 'applications', 'drafts'] as const;
type DashboardTab = typeof VALID_TABS[number];

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedRefresh, setFeedRefresh] = useState(0);
  const [feedMode, setFeedMode] = useState<'foryou' | 'following'>('foryou');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const tabParam = searchParams.get('tab');
  const activeTab: DashboardTab = (VALID_TABS as readonly string[]).includes(tabParam || '')
    ? (tabParam as DashboardTab)
    : 'feed';

  const handleTabChange = (value: string) => {
    if (value === 'feed') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', value);
    }
    setSearchParams(searchParams, { replace: false });
  };

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
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      {/* Social Feed / My Applications / My Drafts navigate here via the
          left sidebar now (Jobs lives only in the top nav, at /jobs) --
          Tabs is controlled by the ?tab= URL param instead of rendering its
          own trigger row, so the exact same TabsContent panels/components
          stay addressable and highlightable from the sidebar. */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full max-w-[1128px] mx-auto px-3 sm:px-4">
        {/* Professional 3-column workspace: profile summary (left, persists
            across tabs) / feed & job tools (center) / insights & suggestions
            (right, persists across tabs) -- collapses to a single column
            below lg, and the right column additionally drops below xl since
            it needs more room than a plain 3-way split leaves at that size.
            Flexbox, not CSS Grid: a grid item's sticky containing block is
            the grid AREA (spanning the full row height across all three
            columns). position:sticky is on the flex ITEM itself (the
            <aside>), not on a nested wrapper div inside it -- isolated,
            minimal reproductions (cleared page, no app CSS) proved sticky
            works correctly as a direct flex-item child in this rendering
            engine but silently fails to stick one level deeper, regardless
            of tag name or any ancestor overflow/transform/filter/contain
            property (all checked and clean). Since aside itself is a flex
            item, `space-y-4` (which needs to apply to >1 child) is
            replicated by wrapping ProfileSummaryCard's own children instead
            -- it only ever renders one child here, so this is a no-op
            simplification, not a behavior change. */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <aside className="hidden lg:block lg:w-[240px] lg:shrink-0 sticky top-[calc(var(--nav-height)+1rem)]">
            <ProfileSummaryCard activeTab={activeTab} hasCompany={!!companyId} />
          </aside>

          <div className="min-w-0 w-full flex-1">
          <TabsContent value="feed" className="card-stack mt-0">
            <Stories />

            <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-full w-fit">
              <button
                onClick={() => setFeedMode('foryou')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  feedMode === 'foryou'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                For You
              </button>
              <button
                onClick={() => setFeedMode('following')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  feedMode === 'following'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Following
              </button>
            </div>

            <Feed refresh={feedRefresh} mode={feedMode} />
          </TabsContent>

          <TabsContent value="applications" className="mt-0">
            <div className="mb-4">
              <h2 className="text-2xl font-bold">My Applications</h2>
              <p className="text-sm text-muted-foreground">Track your job applications</p>
            </div>
            <MyApplications />
          </TabsContent>

          {companyId && (
            <TabsContent value="drafts" className="mt-0">
              <div className="mb-4">
                <h2 className="text-2xl font-bold">My Drafts</h2>
                <p className="text-sm text-muted-foreground">Manage your draft job postings</p>
              </div>
              <MyDrafts companyId={companyId} onPublish={() => setFeedRefresh(prev => prev + 1)} />
            </TabsContent>
          )}
          </div>

          <aside className="hidden xl:block xl:w-[300px] xl:shrink-0 sticky top-[calc(var(--nav-height)+1rem)]">
            <FeedRightRail />
          </aside>
        </div>
      </Tabs>

      <FloatingCreatePost />
    </Layout>
  );
};

export default Dashboard;