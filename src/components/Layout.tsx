import { ReactNode } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import NavBar from "./NavBar"
import BottomNavigation from "./BottomNavigation"
import { User } from "@supabase/supabase-js"
import { useScrollDirection } from "@/hooks/use-scroll-direction"
import { useIsMobile } from "@/hooks/use-mobile"

interface LayoutProps {
  children: ReactNode
  user?: User | null
  onSignOut?: () => void
}

function LayoutContent({ children, user, onSignOut }: LayoutProps) {
  const { showHeader, showBottomNav } = useScrollDirection(15);
  const isMobile = useIsMobile();

  return (
    <>
      {/* Fixed top navbar */}
      <NavBar user={user} onSignOut={onSignOut} visible={showHeader} />

      {/* Sidebar (desktop only) */}
      {!isMobile && (
        <div className="hidden lg:block">
          <AppSidebar />
        </div>
      )}

      {/* Main content */}
      <div className="layout content flex-1 min-w-0 transition-all duration-300 ease-out">
        <main className="feed pb-24 w-full max-w-full">
          {children}
        </main>
      </div>

      {/* Bottom Navigation (mobile only) */}
      {isMobile && <BottomNavigation visible={showBottomNav} />}
    </>
  )
}

export function Layout(props: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent {...props} />
    </SidebarProvider>
  )
}