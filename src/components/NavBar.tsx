import { MobileNavDrawer } from './MobileNavDrawer';
import { SearchBar } from './SearchBar';
import { useSidebar } from "@/components/ui/sidebar"

interface NavBarProps {
  user?: any;
  onSignOut?: () => void;
  visible?: boolean;
}

const NavBar = ({ visible = true }: NavBarProps) => {
  const { state } = useSidebar()
  const offset = state === "collapsed" ? "3.5rem" : "16rem"

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

        {/* MOBILE LAYOUT (lg:hidden) - Two Rows */}
        <div className="lg:hidden w-full max-w-md mx-auto flex flex-col pb-2">
          {/* Row 1: App Title (Instagram Style) */}
          <div className="h-11 flex items-center justify-center relative">
            <h1 className="text-[28px] leading-none text-foreground select-none pt-2" style={{ fontFamily: '"Grand Hotel", cursive' }}>
              Profolio
            </h1>
          </div>

          {/* Row 2: Action Bar */}
          <div className="flex items-center px-3 gap-3">
            {/* Left: Hamburger menu */}
            <div className="-ml-2">
              <MobileNavDrawer />
            </div>

            {/* Center/Right: Search */}
            <div className="flex-1">
              <SearchBar />
            </div>
          </div>
        </div>
      </nav>
      
      {/* Spacer to push content down (Mobile: 90px, Desktop: 64px/4rem) */}
      <div className="h-[90px] lg:h-16" />
    </>
  );
};

export default NavBar;
