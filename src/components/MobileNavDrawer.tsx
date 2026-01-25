import { 
  Home, 
  Users, 
  Bell, 
  Briefcase, 
  Award, 
  FileText, 
  User,
  MessageCircle,
  Building2,
  Menu,
  X
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const mainItems = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Network", url: "/network", icon: Users },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Companies", url: "/companies", icon: Building2 },
]

const profileItems = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Connect", url: "/connect", icon: MessageCircle },
  { title: "Certificates", url: "/certificates", icon: Award },
  { title: "Resume", url: "/resume", icon: FileText },
]

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const isActive = (url: string) => location.pathname === url

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden h-9 w-9"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[80vw] max-w-[320px] p-0">
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">P</span>
              </div>
              <SheetTitle className="text-xl font-bold">Profolio</SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col py-4">
          {/* Main Navigation */}
          <div className="px-3 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3">
              Main Navigation
            </span>
          </div>
          <nav className="flex flex-col gap-1 px-3">
            {mainItems.map((item) => (
              <SheetClose asChild key={item.title}>
                <NavLink
                  to={item.url}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive(item.url)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </NavLink>
              </SheetClose>
            ))}
          </nav>

          <Separator className="my-4" />

          {/* Profile & Career */}
          <div className="px-3 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3">
              Profile & Career
            </span>
          </div>
          <nav className="flex flex-col gap-1 px-3">
            {profileItems.map((item) => (
              <SheetClose asChild key={item.title}>
                <NavLink
                  to={item.url}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive(item.url)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
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
