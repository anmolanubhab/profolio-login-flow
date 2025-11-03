import { Bell, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SearchBar } from './SearchBar';

interface NavBarProps {
  user?: {
    email?: string;
    avatar?: string;
  };
  onSignOut?: () => void;
}

const NavBar = ({ user, onSignOut }: NavBarProps) => {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Left: Brand + Sidebar trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          <SidebarTrigger className="hidden md:inline-flex" />
          <div className="nav-brand cursor-pointer" onClick={() => (window.location.href = '/dashboard')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center">
              <span className="text-[13px] font-bold">P</span>
            </div>
            <span>Profolio</span>
          </div>
        </div>

        {/* Middle: Search */}
        <div className="nav-search hidden sm:block">
          <SearchBar />
        </div>

        {/* Right: Actions */}
        <div className="nav-actions">
          <button
            className="menu-button hidden sm:inline-flex"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
          </button>

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
              <DropdownMenuItem onClick={() => (window.location.href = '/profile')}>
                Profile & Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => (window.location.href = '/dashboard')}>
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