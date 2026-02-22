import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { mainNavItems } from "@/config/navigationConfig"

interface BottomNavigationProps {
  visible?: boolean;
}

export default function BottomNavigation({ visible = true }: BottomNavigationProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleCreatePost = () => {
    navigate('/add-post')
  }
  
  const hoverBgClassFor = (title: string) => {
    if (title === 'Home') {
      return "group-hover:bg-[linear-gradient(90deg,#ff4d4d,#ff9900,#ffee00,#00cc66,#3399ff,#9933ff)]"
    }
    if (title === 'Connections') {
      return "group-hover:bg-[linear-gradient(90deg,#ff66cc,#9933ff,#3399ff,#00cc99,#66cc33,#ffcc00)]"
    }
    if (title === 'Jobs') {
      return "group-hover:bg-[linear-gradient(90deg,#3399ff,#66ddff,#00cc99,#66cc33,#ffcc00,#ff9900)]"
    }
    if (title === 'Notifications') {
      return "group-hover:bg-[linear-gradient(90deg,#ff4d4d,#ff66cc,#9933ff,#ff9900,#ffee00,#ffcc00)]"
    }
    return "group-hover:bg-[linear-gradient(90deg,#ff4d4d,#ff9900,#ffee00,#00cc66,#3399ff,#9933ff)]"
  }
  const hoverTextClassFor = (title: string) => {
    if (title === 'Home') {
      return "group-hover:bg-[linear-gradient(90deg,#ff4d4d,#ff9900,#ffee00,#00cc66,#3399ff,#9933ff)]"
    }
    if (title === 'Connections') {
      return "group-hover:bg-[linear-gradient(90deg,#ff66cc,#9933ff,#3399ff,#00cc99,#66cc33,#ffcc00)]"
    }
    if (title === 'Jobs') {
      return "group-hover:bg-[linear-gradient(90deg,#3399ff,#66ddff,#00cc99,#66cc33,#ffcc00,#ff9900)]"
    }
    if (title === 'Notifications') {
      return "group-hover:bg-[linear-gradient(90deg,#ff4d4d,#ff66cc,#9933ff,#ff9900,#ffee00,#ffcc00)]"
    }
    return "group-hover:bg-[linear-gradient(90deg,#ff4d4d,#ff9900,#ffee00,#00cc66,#3399ff,#9933ff)]"
  }

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/40 lg:hidden transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="grid grid-cols-5 h-16 px-1 w-full relative">
        {mainNavItems.map((item) => {
          if (item.variant === 'rainbow') {
            return (
              <div key={item.url} className="flex items-center justify-center">
                <button
                  onClick={handleCreatePost}
                  className="flex items-center justify-center w-12 h-12 rounded-[14px] shadow-lg transition-all duration-200 ease-out hover:scale-105 hover:shadow-xl active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 30%, #00C6FF 60%, #00E676 100%)'
                  }}
                  aria-label={item.title}
                >
                  <item.icon className="h-6 w-6 text-white" strokeWidth={2.5} />
                </button>
              </div>
            );
          }

          const isActive = location.pathname === item.url
          const hoverBg = hoverBgClassFor(item.title)
          const hoverText = hoverTextClassFor(item.title)
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "group flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200 ease-out",
                isActive
                  ? "text-foreground scale-[0.98]"
                  : "text-muted-foreground hover:text-foreground hover:scale-[1.02]"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center transition-all",
                  isActive
                    ? "w-12 h-12 rounded-[14px] bg-card shadow-sm"
                    : `h-9 w-9 rounded-xl bg-transparent ring-1 ring-white/30 shadow-sm group-hover:ring-2 group-hover:scale-105 ${hoverBg}`
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-primary" : "text-gray-600 group-hover:text-white"
                  )}
                  strokeWidth={isActive ? 2.4 : 2}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-white" : `text-current ${hoverText} group-hover:bg-clip-text group-hover:text-transparent`
                )}
              >
                {item.title}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
