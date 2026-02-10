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

  // Find the Post item to handle it separately
  const postItemIndex = mainNavItems.findIndex(item => item.variant === 'rainbow');
  const postItem = mainNavItems[postItemIndex];

  // Split items around the Post item
  const leftItems = mainNavItems.slice(0, postItemIndex);
  const rightItems = mainNavItems.slice(postItemIndex + 1);

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/40 lg:hidden transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto relative">
        {/* Left nav items */}
        {leftItems.map((item) => {
          const isActive = location.pathname === item.url
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
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

        {/* Center FAB - Create Post Button */}
        {postItem && (
          <button
            onClick={handleCreatePost}
            className="flex items-center justify-center w-12 h-12 rounded-[14px] shadow-lg transition-all duration-200 ease-out hover:scale-105 hover:shadow-xl active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 30%, #00C6FF 60%, #00E676 100%)'
            }}
            aria-label={postItem.title}
          >
            <postItem.icon className="h-6 w-6 text-white" strokeWidth={2.5} />
          </button>
        )}

        {/* Right nav items */}
        {rightItems.map((item) => {
          const isActive = location.pathname === item.url
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
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
