import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SearchBar } from './SearchBar';
import { MobileNavDrawer } from './MobileNavDrawer';

interface NavBarProps {
  user?: {
    email?: string;
    avatar?: string;
  };
  onSignOut?: () => void;
  visible?: boolean;
}

const NavBar = ({ user, onSignOut, visible = true }: NavBarProps) => {
  const navigate = useNavigate();

  return (
    <nav 
      className={`navbar w-full max-w-full overflow-x-hidden transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="navbar-inner w-full max-w-full overflow-hidden">
        {/* Left: Hamburger menu (mobile) + Brand + Sidebar trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile hamburger menu */}
          <MobileNavDrawer />
          {/* Desktop sidebar trigger */}
          <SidebarTrigger className="hidden lg:inline-flex" />
          <div className="nav-brand cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="w-9 h-9 rounded bg-primary text-primary-foreground grid place-items-center font-bold text-base">
              P
            </div>
            <span className="hidden sm:inline">Profolio</span>
          </div>
        </div>

        {/* Middle: Search */}
        <div className="nav-search hidden sm:block">
          <SearchBar />
        </div>

        {/* Right: Actions */}
        <div className="nav-actions">
          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="avatar" aria-label="Open profile menu">
                <Avatar className="h-full w-full">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {user?.email?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dropdown-menu">
              <div className="px-3 py-2">
                <div className="text-sm font-medium">{user?.email || 'Guest'}</div>
                <div className="text-xs text-muted-foreground">Signed in</div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                Profile & Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;