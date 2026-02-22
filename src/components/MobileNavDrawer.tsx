import { 
  Menu,
  MapPin,
  ChevronRight
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { secondaryNavItems } from "@/config/navigationConfig"

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { profile } = useAuth()

  const isActive = (url: string) => location.pathname === url
  const gradients = [
    "from-blue-400 to-indigo-600",
    "from-violet-400 to-purple-600",
    "from-sky-400 to-blue-600",
    "from-teal-400 to-emerald-600",
    "from-indigo-400 to-fuchsia-600",
    "from-orange-400 to-rose-500",
    "from-amber-400 to-orange-500",
    "from-pink-400 to-rose-600",
  ]

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Use profile from AuthContext (single source of truth)
  // Fallback to display_name if full_name is missing
  const displayName = profile?.full_name || profile?.display_name || 'User'

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 flex flex-col h-full">
        {/* Profile Header Section - Profolio Style */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 border-b border-border">
          <SheetClose asChild>
            <NavLink to="/profile" className="block">
              <div className="flex items-start gap-3">
                <Avatar className="h-14 w-14 border-2 border-background shadow-md">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate text-base">
                    {displayName}
                  </h3>
                  {profile?.profession && (
                    <p className="text-sm text-muted-foreground truncate">
                      {profile.profession}
                    </p>
                  )}
                  {profile?.location && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{profile.location}</span>
                    </div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            </NavLink>
          </SheetClose>
        </div>

        {/* Menu Items */}
        <div className="flex flex-col py-3 flex-1 overflow-y-auto">
          <nav className="flex flex-col px-2">
            {secondaryNavItems.map((item, idx) => (
              <SheetClose asChild key={item.title}>
                <NavLink
                  to={item.url}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all hover:shadow-md",
                    isActive(item.url)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <div className={cn("h-8 w-8 rounded-md flex items-center justify-center ring-1 ring-white/40 shadow-sm bg-gradient-to-br transition-transform group-hover:scale-105 group-hover:ring-2", gradients[idx % gradients.length])}>
                    <item.icon className="h-4 w-4 flex-shrink-0 text-white" />
                  </div>
                  <span>{item.title}</span>
                </NavLink>
              </SheetClose>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}

