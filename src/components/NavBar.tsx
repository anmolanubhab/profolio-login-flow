import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, Briefcase, MessageCircle, Bell, User as UserIcon, Building2, Users2, CalendarDays, ChevronDown, ClipboardList, FilePlus2, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchBar } from './SearchBar';
import { NotificationBell } from './NotificationBell';
import { MobileNavDrawer } from './MobileNavDrawer';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface NavBarProps {
  user?: {
    email?: string;
    avatar?: string;
  };
  onSignOut?: () => void;
}

// Primary destinations, shown as icon+label tabs in the center of the
// desktop top bar -- mirrors a professional-network nav pattern (persistent,
// always-visible primary sections) rather than the old collapsible side
// rail, which hid navigation behind a toggle and ate horizontal space from
// every page's content column.
const primaryNav = [
  { title: 'Home', url: '/dashboard', icon: Home },
  { title: 'My Network', url: '/network', icon: Users },
  { title: 'Jobs', url: '/jobs', icon: Briefcase },
  { title: 'Messaging', url: '/connect', icon: MessageCircle },
];

const NavBar = ({ user, onSignOut }: NavBarProps) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [hasCompany, setHasCompany] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUserId(authUser.id);

      // My Drafts (in the Me menu below) is a company-recruiter concern --
      // same gating as the sidebar's own "My Drafts" link on desktop.
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', authUser.id).single();
      if (!profile) return;
      const { data: company } = await supabase.from('companies').select('id').eq('owner_id', profile.id).maybeSingle();
      setHasCompany(!!company);
    };
    fetchUserId();
  }, []);

  return (
    <nav className="navbar w-full max-w-full overflow-x-hidden">
      <div className="navbar-inner w-full max-w-full overflow-hidden !max-w-none xl:!max-w-[1280px] gap-1 sm:gap-3">
        {/* Left: brand + search */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <MobileNavDrawer />
          <div className="nav-brand cursor-pointer shrink-0" onClick={() => navigate('/dashboard')}>
            <div className="w-9 h-9 rounded bg-primary text-primary-foreground grid place-items-center font-bold text-base">
              P
            </div>
            <span className="hidden sm:inline">Profolio</span>
          </div>
          <div className="nav-search hidden md:block w-64 lg:w-72">
            <SearchBar />
          </div>
        </div>

        {/* Center: primary icon tabs (desktop only) */}
        <div className="hidden lg:flex items-stretch h-full">
          {primaryNav.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 px-4 h-full min-w-[64px] text-[11px] font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" strokeWidth={2} />
              <span className="whitespace-nowrap">{item.title}</span>
            </NavLink>
          ))}
        </div>

        {/* Right: business tools, notifications, profile */}
        <div className="nav-actions ml-auto shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden xl:flex items-center gap-1 rounded-md px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Building2 className="h-5 w-5" strokeWidth={2} />
                <span className="flex items-center gap-0.5">For Business <ChevronDown className="h-3 w-3" /></span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dropdown-menu w-52">
              <DropdownMenuItem onClick={() => navigate('/companies')}>
                <Building2 className="h-4 w-4 mr-2" /> Companies
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/groups')}>
                <Users2 className="h-4 w-4 mr-2" /> Groups
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/events')}>
                <CalendarDays className="h-4 w-4 mr-2" /> Events
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/companies/new')}>
                <Plus className="h-4 w-4 mr-2" /> Create a company page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {userId && <NotificationBell userId={userId} />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-secondary transition-colors" aria-label="Open profile menu">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-3.5 w-3.5" />}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
                  Me <ChevronDown className="h-3 w-3" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dropdown-menu w-60">
              <div className="px-3 py-2 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{user?.email || 'Guest'}</div>
                  <div className="text-xs text-muted-foreground">Signed in</div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>View Profile</DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* On mobile the desktop sidebar (Dashboard's ProfileSummaryCard)
                  is hidden, so these two are only reachable from here on
                  small screens -- desktop users have both, which is fine,
                  the dropdown just isn't the primary path there. */}
              <DropdownMenuItem onClick={() => navigate('/dashboard?tab=applications')}>
                <ClipboardList className="h-4 w-4 mr-2" /> My Applications
              </DropdownMenuItem>
              {hasCompany && (
                <DropdownMenuItem onClick={() => navigate('/dashboard?tab=drafts')}>
                  <FilePlus2 className="h-4 w-4 mr-2" /> My Drafts
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate('/certificates')}>Certificate Vault</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/resume')}>Resume Builder</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/saved-posts')}>Saved Posts</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
