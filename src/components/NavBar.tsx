import { MobileNavDrawer } from './MobileNavDrawer';
import { SearchBar } from './SearchBar';
import { useSidebar } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useEffect, useState } from 'react'
import { supabase } from "@/integrations/supabase/client"
import { useNavigate } from 'react-router-dom'

interface NavBarProps {
  user?: any;
  onSignOut?: () => void;
  visible?: boolean;
}

const NavBar = ({ visible = true, user }: NavBarProps) => {
  const { state } = useSidebar()
  const offset = state === "collapsed" ? "3.5rem" : "16rem"
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.id) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', user.id)
          .single()
        
        if (data?.avatar_url) {
          setAvatarUrl(data.avatar_url)
        }
      }
      fetchProfile()
    }
  }, [user])

  return (
    <>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Grand+Hotel&display=swap');`}
      </style>
      
      <nav 
        style={{ 
          "--nav-left-offset": offset 
        } as React.CSSProperties}
        className={`fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/40 transition-all duration-300 ease-out lg:left-[var(--nav-left-offset)] lg:w-[calc(100%-var(--nav-left-offset))] ${
          visible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        {/* DESKTOP LAYOUT (lg:flex) - Single Row */}
        <div className="hidden lg:flex items-center justify-center w-full h-16 px-6">
          {/* Search Bar - Inline, centered, balanced width */}
          <div className="w-full max-w-2xl">
            <SearchBar />
          </div>
        </div>

        {/* MOBILE LAYOUT (lg:hidden) - Single Row: [Menu] [Profile] [Logo] [Search] */}
        <div className="lg:hidden w-full h-16 px-3 flex items-center gap-2">
          {/* Left: Menu & Profile */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <MobileNavDrawer />
            <Avatar className="h-8 w-8 cursor-pointer border border-border/50" onClick={() => navigate('/profile')}>
              <AvatarImage src={avatarUrl || user?.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs">{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
          </div>

          {/* Center: Logo */}
          <div className="flex-shrink-0">
             <h1 className="text-[24px] leading-none text-foreground select-none" style={{ fontFamily: '"Grand Hotel", cursive' }}>
              Profolio
            </h1>
          </div>

          {/* Right: Search */}
          <div className="flex-1 min-w-0">
            <SearchBar />
          </div>
        </div>
      </nav>
      
      {/* Spacer to push content down (Mobile: 64px, Desktop: 80px) */}
      <div className="h-16 lg:h-20" />
    </>
  );
};

export default NavBar;
