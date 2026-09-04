import { ReactNode } from "react"
import NavBar from "./NavBar"
import BottomNavigation from "./BottomNavigation"
import { User } from "@supabase/supabase-js"
import { MobileScrollDirectionProvider } from "@/hooks/use-mobile-scroll-direction"
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat"

interface LayoutProps {
  children: ReactNode
  user?: User | null
  onSignOut?: () => void
  // Pages that build their own multi-column layout (e.g. the 3-column feed)
  // need the full viewport width, not the single-column ".layout" max-width
  // wrapper -- they opt out and manage their own max-width/columns.
  fullWidth?: boolean
}

export function Layout({ children, user, onSignOut, fullWidth }: LayoutProps) {
  usePresenceHeartbeat();
  return (
    <MobileScrollDirectionProvider>
      {/* Fixed top navbar -- carries all primary navigation now (desktop
          icon tabs + mobile drawer trigger), replacing the old collapsible
          side rail so every page gets its full content width back. On mobile
          it auto-hides on scroll-down (see use-mobile-scroll-direction). */}
      <NavBar user={user} onSignOut={onSignOut} />

      {/* Main content -- no overflow-x-hidden on this wrapper (or on
          #root, see index.css): a non-viewport ancestor with overflow set
          to anything but visible becomes its own scroll-containment
          context, which breaks position:sticky for every descendant (e.g.
          the dashboard's sticky left/right rails). html/body's own
          overflow-x-hidden already guards the real viewport against
          horizontal scroll; width/max-width here is enough on this level. */}
      <div className={fullWidth ? "content w-full max-w-full" : "layout content w-full max-w-full"}>
        {/* Bottom padding clears the floating mobile bar (h-16 = 4rem) AND the
            system inset it sits above, so the last item is never trapped
            behind either -- while everything above still scrolls edge-to-edge
            behind them. Matched to the bar's own footprint (4rem, see
            BottomNavigation's h-16 row) plus a small 0.5rem breathing gap --
            anything larger leaves a dead strip of plain page background
            exposed above the bar once the feed reaches the end of its
            scroll range, since the bar can only ever cover its own height. */}
        <main className="feed w-full max-w-full pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-8">
          {children}
        </main>
      </div>

      {/* Bottom navigation - only visible on mobile; auto-hides on scroll-down */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </MobileScrollDirectionProvider>
  )
}
