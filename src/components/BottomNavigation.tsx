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

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/40 lg:hidden transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="grid grid-cols-5 h-16 px-1 max-w-lg mx-auto relative">
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
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg transition-colors w-full h-full",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
              <span className="text-[10px] font-medium">{item.title}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
