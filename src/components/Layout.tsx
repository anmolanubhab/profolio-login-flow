import { ReactNode } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import NavBar from "./NavBar"
import BottomNavigation from "./BottomNavigation"
import { User } from "@supabase/supabase-js"
import { useScrollDirection } from "@/hooks/use-scroll-direction"

interface LayoutProps {
  children: ReactNode
  user?: User | null
  onSignOut?: () => void
}

function LayoutContent({ children, user, onSignOut }: LayoutProps) {
  const { showHeader, showBottomNav } = useScrollDirection(15);

  return (
    <>
      {/* Fixed top navbar */}
      <NavBar user={user} onSignOut={onSignOut} visible={showHeader} />

      {/* Sidebar (desktop) */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Main content */}
      <div 
        className="layout content flex-1 min-w-0 transition-all duration-300 ease-out"
      >
        <main className="feed pb-24 w-full max-w-full">
          {children}
        </main>
      </div>

      {/* Bottom navigation - only visible on mobile */}
      <div className="lg:hidden">
        <BottomNavigation visible={showBottomNav} />
      </div>
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