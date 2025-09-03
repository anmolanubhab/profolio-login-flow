import { ReactNode } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
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
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top navigation bar */}
          <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
            <div className="flex items-center gap-2 px-4 py-3">
              {/* Sidebar trigger - only visible on desktop when sidebar is present */}
              <div className="hidden md:block">
                <SidebarTrigger className="text-sidebar-foreground" />
              </div>
              
              {/* Mobile logo and navigation */}
              <div className="md:hidden flex-1">
                <NavBar user={user} onSignOut={onSignOut} />
              </div>
              
              {/* Desktop search and profile */}
              <div className="hidden md:flex flex-1 justify-end items-center gap-3">
                <NavBar user={user} onSignOut={onSignOut} />
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
            {children}
          </main>

          {/* Bottom navigation - only visible on mobile */}
          <div className="md:hidden">
            <BottomNavigation />
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}