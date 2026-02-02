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
  X,
  LogOut,
  Settings
} from "lucide-react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
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

const menuItems = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Connect", url: "/connect", icon: MessageCircle },
  { title: "Certificates", url: "/certificates", icon: Award },
  { title: "Resume", url: "/resume", icon: FileText },
  { title: "Companies", url: "/companies", icon: Building2 },
]

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const isActive = (url: string) => location.pathname === url

  const handleSignOut = async () => {
    try {
      await signOut()
      setOpen(false)
      navigate('/')
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

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
      <SheetContent side="left" className="w-[80vw] max-w-[320px] p-0 flex flex-col h-full">
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

        <div className="flex flex-col py-4 flex-1 overflow-y-auto">
          {/* Menu Items */}
          <div className="px-3 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3">
              Menu
            </span>
          </div>
          <nav className="flex flex-col gap-1 px-3">
            {menuItems.map((item) => (
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

          <Separator className="my-4 mx-3 w-auto" />

          <nav className="flex flex-col gap-1 px-3">
            <SheetClose asChild>
              <NavLink
                to="/settings"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive("/settings")
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </NavLink>
            </SheetClose>
          </nav>
        </div>

        {user && (
          <div className="p-4 border-t border-border mt-auto bg-background/50 backdrop-blur-sm">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 px-3 py-2.5 h-auto font-medium"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              <span>Log Out</span>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
