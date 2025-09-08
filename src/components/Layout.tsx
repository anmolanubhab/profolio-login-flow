import { ReactNode } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import NavBar from "./NavBar"
import BottomNavigation from "./BottomNavigation"
import { User } from "@supabase/supabase-js"

interface LayoutProps {
  children: ReactNode
  user?: User | null
  onSignOut?: () => void
}

export function Layout({ children, user, onSignOut }: LayoutProps) {
  return (
    <SidebarProvider>
      {/* Fixed top navbar */}
      <NavBar user={user} onSignOut={onSignOut} />

      {/* Sidebar (desktop) */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Main content */}
      <div className="layout content">
        <main className="feed pb-24">
          {children}
        </main>
      </div>

      {/* Bottom navigation - only visible on mobile */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </SidebarProvider>
  )
}