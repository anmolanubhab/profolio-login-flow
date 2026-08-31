import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Home, ClipboardList, FilePlus2, FileText, Award, Bookmark, Users2, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useProfileStrength } from '@/hooks/useProfileStrength';

interface SummaryProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  profession: string | null;
  location: string | null;
}

interface ProfileSummaryCardProps {
  // Which /dashboard view is currently active (feed/applications/drafts),
  // so this sidebar can highlight itself in sync -- the two components
  // share the same URL-driven state rather than duplicating it.
  activeTab?: 'feed' | 'applications' | 'drafts';
  // My Drafts is a company-recruiter concern; only show it once the user
  // actually owns a company, matching the RLS/UI gating already used on
  // Dashboard's job-posting flow.
  hasCompany?: boolean;
}

interface NavItem {
  label: string;
  icon: typeof Home;
  onClick: () => void;
  isActive: boolean;
}

// The desktop feed's left column: a compact professional-identity card
// (cover + overlapping avatar, headline, location, one honest real metric)
// plus this app's own primary navigation for personal/workspace sections --
// Social Feed, My Applications, My Drafts, Resume Builder, Certificate
// Vault, Saved Items, and Groups. Jobs deliberately isn't repeated here; it
// already has its own top-nav entry at /jobs.
export function ProfileSummaryCard({ activeTab = 'feed', hasCompany = false }: ProfileSummaryCardProps) {
  const [profile, setProfile] = useState<SummaryProfile | null>(null);
  const [viewCount, setViewCount] = useState<number | null>(null);
  const [ids, setIds] = useState<{ profileId: string; authUserId: string } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Same centralized engine as the profile-page widget -> one consistent number.
  const { data: strength } = useProfileStrength({
    profileId: ids?.profileId,
    authUserId: ids?.authUserId,
  });
  const completion = strength?.score ?? 0;

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, cover_url, profession, location, bio, phone, linkedin_url')
        .eq('user_id', user.id)
        .single();

      if (!p) return;
      setProfile(p);
      setIds({ profileId: p.id, authUserId: user.id });

      const { count } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('viewed_profile_id', p.id);
      setViewCount(count ?? 0);
    };
    load();
  }, []);

  const onDashboard = location.pathname === '/dashboard';
  const isRoute = (path: string) => location.pathname === path;

  // Social Feed stands alone as its own single-item box; the other three
  // groups (My Activity / Career / Community) each render as an
  // independent card below it, per the sidebar's visual grouping.
  const soloItem: NavItem = { label: 'Social Feed', icon: Home, onClick: () => navigate('/dashboard'), isActive: onDashboard && activeTab === 'feed' };

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'My Activity',
      items: [
        { label: 'My Applications', icon: ClipboardList, onClick: () => navigate('/dashboard?tab=applications'), isActive: onDashboard && activeTab === 'applications' },
        ...(hasCompany
          ? [{ label: 'My Drafts', icon: FilePlus2, onClick: () => navigate('/dashboard?tab=drafts'), isActive: onDashboard && activeTab === 'drafts' }]
          : []),
      ],
    },
    {
      label: 'Career',
      items: [
        { label: 'Resume Builder', icon: FileText, onClick: () => navigate('/resume'), isActive: isRoute('/resume') },
        { label: 'Certificate Vault', icon: Award, onClick: () => navigate('/certificates'), isActive: isRoute('/certificates') },
        { label: 'Job Preferences', icon: Settings2, onClick: () => navigate('/settings/visibility'), isActive: isRoute('/settings/visibility') },
      ],
    },
    {
      label: 'Community',
      items: [
        { label: 'Saved Items', icon: Bookmark, onClick: () => navigate('/saved-posts'), isActive: isRoute('/saved-posts') },
        { label: 'Groups', icon: Users2, onClick: () => navigate('/groups'), isActive: isRoute('/groups') },
      ],
    },
  ];

  const renderNavButton = (item: NavItem) => (
    <button
      key={item.label}
      onClick={item.onClick}
      aria-current={item.isActive ? 'page' : undefined}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium transition-colors rounded-md mx-0',
        item.isActive
          ? 'text-primary bg-primary/10'
          : 'text-foreground hover:bg-secondary'
      )}
    >
      <item.icon className={cn('h-4 w-4 shrink-0', item.isActive ? 'text-primary' : 'text-muted-foreground')} />
      <span className="truncate">{item.label}</span>
    </button>
  );

  if (!profile) {
    return (
      <div className="card-stack">
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden animate-pulse">
          <div className="h-14 bg-muted" />
          <div className="p-4 -mt-8">
            <div className="h-16 w-16 rounded-full bg-muted border-4 border-card" />
            <div className="h-4 w-32 bg-muted rounded mt-3" />
            <div className="h-3 w-24 bg-muted rounded mt-2" />
          </div>
        </div>
      </div>
    );
  }

  const initial = profile.display_name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="card-stack">
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <button
          onClick={() => navigate('/profile')}
          className="block w-full text-left"
          aria-label="View your profile"
        >
          <div
            className="h-14 w-full"
            style={
              profile.cover_url
                ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: 'linear-gradient(135deg, hsl(211 100% 40%), hsl(211 100% 55%))' }
            }
          />
          <div className="px-4 pb-3 -mt-8">
            <Avatar className="h-16 w-16 border-4 border-card shadow-sm">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">{initial}</AvatarFallback>
            </Avatar>
            <div className="mt-2.5">
              <div className="font-semibold text-[15px] leading-tight text-foreground hover:underline">
                {profile.display_name || 'Your name'}
              </div>
              {profile.profession && (
                <div className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">{profile.profession}</div>
              )}
              {profile.location && (
                <div className="text-[12px] text-muted-foreground mt-0.5">{profile.location}</div>
              )}
            </div>
          </div>
        </button>

        <div className="border-t px-4 py-2.5 flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">Profile views</span>
          <span className="text-[12px] font-semibold text-primary">{viewCount ?? '—'}</span>
        </div>

        {completion < 100 && (
          <div className="border-t px-4 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] text-muted-foreground">Profile strength</span>
              <span className="text-[12px] font-medium text-foreground">{completion}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${completion}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Social Feed: its own single-item box, separate from the grouped
          nav cards below -- matches the sidebar's visual hierarchy. */}
      <nav className="rounded-xl border border-border bg-card shadow-card overflow-hidden py-1.5">
        {renderNavButton(soloItem)}
      </nav>

      {/* My Activity / Career / Community: each its own independent card
          (rounded corners, border, consistent padding/heading style) --
          not one continuous panel with dividers. */}
      {groups.map((group) => (
        <nav key={group.label} className="rounded-xl border border-border bg-card shadow-card overflow-hidden py-1.5">
          <div className="px-4 pt-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            {group.label}
          </div>
          {group.items.map(renderNavButton)}
        </nav>
      ))}
    </div>
  );
}

export default ProfileSummaryCard;
