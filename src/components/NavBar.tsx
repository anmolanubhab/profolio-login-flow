import { MobileNavDrawer } from './MobileNavDrawer';
import { SearchBar } from './SearchBar';
import { useSidebar } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

import { NotificationCenter } from "@/components/notifications/NotificationCenter";

interface NavBarProps {
  user?: any;
  onSignOut?: () => void;
  visible?: boolean;
}

const NavBar = ({ visible = true, user }: NavBarProps) => {
  const { state } = useSidebar()
  const offset = state === "collapsed" ? "3.5rem" : "16rem"
  const navigate = useNavigate()
  const { profile } = useAuth()
  
  // Use profile from AuthContext (single source of truth)
  const avatarUrl = profile?.avatar_url

  return (
    <>
      <nav 
        style={{ 
          "--nav-left-offset": offset 
        } as React.CSSProperties}
        className={`fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/40 transition-all duration-300 ease-out lg:left-[var(--nav-left-offset)] lg:w-[calc(100%-var(--nav-left-offset))] ${
          visible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="hidden lg:block w-full h-16">
          <div className="h-full w-full max-w-6xl mx-auto px-6 flex items-center">
            <div className="w-full max-w-2xl">
              <SearchBar />
            </div>
          </div>
        </div>

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
