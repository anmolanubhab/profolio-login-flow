import { navigationConfig } from "@/config/navigationConfig"
import { NavLink } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

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
import { Separator } from "@/components/ui/separator"

export function AppSidebar() {
  const { state, isMobile } = useSidebar()
  const { toast } = useToast()
  const isCollapsed = state === "collapsed"

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "sidebar-item active"
      : "sidebar-item"

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
              {navigationConfig.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={({ isActive }) => getNavCls({ isActive })}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
