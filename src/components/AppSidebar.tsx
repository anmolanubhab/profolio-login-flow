import { navigationConfig } from "@/config/navigationConfig"
import { NavLink } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const { state, isMobile } = useSidebar()
  const { toast } = useToast()
  const isCollapsed = state === "collapsed"

  const getNavCls = ({ isActive, isRainbow }: { isActive: boolean, isRainbow?: boolean }) => {
    if (isRainbow) {
      return cn(
        "flex items-center gap-2 p-2 rounded-md transition-all duration-200 hover:scale-[1.02] active:scale-95 text-white font-medium shadow-md",
        isCollapsed ? "justify-center" : "justify-start px-3"
      );
    }
    return isActive
      ? "sidebar-item active"
      : "sidebar-item"
  }

  return (
    <Sidebar 
      className={isCollapsed ? "w-14" : "w-64"} 
      collapsible="icon"
      variant={isMobile ? "inset" : "sidebar"}
    >
      <SidebarHeader className="p-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">P</span>
            </div>
            <h1 className="text-xl font-bold text-sidebar-foreground">Profolio</h1>
          </div>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-sm">P</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationConfig.map((item) => {
                const isRainbow = item.variant === 'rainbow';
                
                return (
                  <SidebarMenuItem key={item.title} className={isRainbow ? "mb-2 mt-2" : ""}>
                    <SidebarMenuButton 
                      asChild 
                      tooltip={isCollapsed ? item.title : undefined}
                      className={isRainbow ? "hover:bg-transparent hover:text-white" : ""}
                    >
                      <NavLink 
                        to={item.url} 
                        className={({ isActive }) => getNavCls({ isActive, isRainbow })}
                        style={isRainbow ? {
                          background: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 30%, #00C6FF 60%, #00E676 100%)'
                        } : undefined}
                      >
                        <item.icon className={cn("h-4 w-4", isRainbow && "h-5 w-5")} strokeWidth={isRainbow ? 2.5 : 2} />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
