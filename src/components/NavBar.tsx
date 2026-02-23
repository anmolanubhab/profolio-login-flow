import { MobileNavDrawer } from './MobileNavDrawer';
import { SearchBar } from './SearchBar';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Home, Users, Briefcase, MessageCircle, Plus } from 'lucide-react';

import { NotificationCenter } from "@/components/notifications/NotificationCenter";

interface NavBarProps {
  user?: any;
  onSignOut?: () => void;
  visible?: boolean;
}

const NavBar = ({ visible = true, user }: NavBarProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  
  // Use profile from AuthContext (single source of truth)
  const avatarUrl = profile?.avatar_url

  return (
    <>
      <nav 
        className="fixed top-0 left-0 right-0 z-50 bg-transparent border-b border-white/20"
      >
        {/* DESKTOP LAYOUT (lg and above) - Facebook-style top nav */}
        <header className="hidden lg:flex sticky top-0 z-50 bg-transparent h-16">
          <div className="w-full px-6 flex items-center">
            {/* LEFT: Logo + Search */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex items-center h-16 cursor-pointer focus:outline-none"
              >
                <div className="hidden lg:block">
                  <img
                    src="/logo-rainbow.png"
                    alt="Profolio"
                    className="h-10 object-contain hover:scale-105 transition-transform duration-200"
                  />
                </div>
              </button>
              <div className="w-72 max-w-xs">
                <SearchBar />
              </div>
            </div>

            {/* CENTER: Nav Icons with rainbow active indicator */}
            <div className="flex-1 flex justify-center gap-10 text-gray-600">
              <NavLink
                to="/dashboard"
                className="relative flex flex-col items-center justify-center h-16 px-4 cursor-pointer transition-all duration-300 ease-in-out hover:bg-gray-100 rounded-lg"
              >
                {({ isActive }) => (
                  <>
                    <Home className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className="mt-1 text-[11px] font-medium bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] bg-clip-text text-transparent">
                      Home
                    </span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" />
                    )}
                  </>
                )}
              </NavLink>

              <NavLink
                to="/network"
                className="relative flex flex-col items-center justify-center h-16 px-4 cursor-pointer transition-all duration-300 ease-in-out hover:bg-gray-100 rounded-lg"
              >
                {({ isActive }) => (
                  <>
                    <Users className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className="mt-1 text-[11px] font-medium bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] bg-clip-text text-transparent">
                      My Network
                    </span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" />
                    )}
                  </>
                )}
              </NavLink>

              <NavLink
                to="/jobs"
                className="relative flex flex-col items-center justify-center h-16 px-4 cursor-pointer transition-all duration-300 ease-in-out hover:bg-gray-100 rounded-lg"
              >
                {() => {
                  const isActive = location.pathname.startsWith('/jobs') && !location.pathname.startsWith('/jobs/messages');
                  return (
                    <>
                      <Briefcase className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className="mt-1 text-[11px] font-medium bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] bg-clip-text text-transparent">
                        Jobs
                      </span>
                      {isActive && (
                        <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" />
                      )}
                    </>
                  );
                }}
              </NavLink>

              <NavLink
                to="/jobs/messages"
                title="Job specific conversations"
                className="relative flex flex-col items-center justify-center h-16 px-4 cursor-pointer transition-all duration-300 ease-in-out hover:bg-gray-100 rounded-lg"
              >
                {({ isActive }) => (
                  <>
                    <MessageCircle className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className="mt-1 text-[11px] font-medium bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] bg-clip-text text-transparent">
                      Job Chat
                    </span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" />
                    )}
                  </>
                )}
              </NavLink>
            </div>

            {/* RIGHT: Post button + Me avatar */}
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/add-post')}
                className="hidden lg:inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-semibold text-white shadow-md hover:shadow-lg active:scale-95 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 30%, #00C6FF 60%, #00E676 100%)'
                }}
              >
                <Plus className="h-4 w-4" />
                <span>Post</span>
              </button>
              <NavLink
                to="/profile"
                className="relative flex items-center justify-center h-16 px-4 cursor-pointer transition-all duration-300 ease-in-out hover:bg-gray-100 rounded-lg"
              >
                {({ isActive }) => (
                  <>
                    <Avatar className="h-12 w-12 border border-border/60">
                      <AvatarImage src={avatarUrl || user?.user_metadata?.avatar_url} referrerPolicy="no-referrer" />
                      <AvatarFallback className="text-[10px]">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" />
                    )}
                  </>
                )}
              </NavLink>
            </div>
          </div>
        </header>

        {/* MOBILE LAYOUT (lg:hidden) - Single Row: [Menu] [Profile] [Logo] [Notif] [Search] */}
        <div className="lg:hidden w-full h-16 px-3 flex items-center gap-2">
          {/* Left: Menu & Profile & Brand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <MobileNavDrawer />
            <Avatar className="h-8 w-8 cursor-pointer border border-border/50" onClick={() => navigate('/profile')}>
              <AvatarImage src={avatarUrl || user?.user_metadata?.avatar_url} referrerPolicy="no-referrer" />
              <AvatarFallback className="text-xs">{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <h1 className="brand-font text-[24px] leading-none text-foreground select-none ml-1">
              Profolio
            </h1>
          </div>

          {/* Right: Search Only (Notifications removed) */}
          <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
            <div className="flex-1 min-w-0 max-w-[200px]">
              <SearchBar />
            </div>
          </div>
        </div>
      </nav>
      
      {/* Spacer to push content down (Mobile: 64px, Desktop: 80px) */}
      <div className="h-16 lg:h-20" />
    </>
  );
};

export default NavBar;
