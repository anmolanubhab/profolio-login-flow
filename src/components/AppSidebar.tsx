import { navigationConfig } from "@/config/navigationConfig"
import { NavLink, useLocation } from "react-router-dom"
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
  const location = useLocation()

  const sidebarItems = navigationConfig.filter((item) => 
    !["Home", "Connections", "Jobs", "Profile"].includes(item.title)
  );

  const activityItems = sidebarItems.filter((item) =>
    ["Notifications", "Connect", "Saved Posts"].includes(item.title)
  )

  const profileItems = sidebarItems.filter((item) =>
    ["Resume", "Certificates", "Groups"].includes(item.title)
  )

  const manageItems = sidebarItems.filter((item) =>
    ["Companies", "Settings"].includes(item.title)
  )

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
      className={isCollapsed ? "w-16" : "w-72"} 
      collapsible="icon"
      variant={isMobile ? "inset" : "sidebar"}
    >
      <SidebarHeader className="p-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-sidebar-foreground lg:hidden">Profolio</h1>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {!isCollapsed && activityItems.length > 0 && (
                <p className="px-4 text-sm font-bold uppercase tracking-wider mt-2 mb-2 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] bg-clip-text text-transparent">
                  Activity
                </p>
              )}
              {activityItems.map((item) => {
                const isRainbow = item.variant === 'rainbow'
                const is3D = ["Notifications", "Connect", "Saved Posts"].includes(item.title)
                return (
                  <SidebarMenuItem key={item.title} className={isRainbow ? "mb-2 mt-2" : ""}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.title : undefined}
                      className={isRainbow ? "hover:bg-transparent hover:text-white" : ""}
                    >
                      <NavLink
                        to={item.url}
                        title={item.url === '/connect' ? 'Network & interview conversations' : undefined}
                        className={({ isActive }) => {
                          const isJobsItem = item.url === '/jobs'
                          const effectiveActive = isJobsItem
                            ? isActive && !location.pathname.startsWith('/jobs/messages')
                            : isActive
                          return getNavCls({ isActive: effectiveActive, isRainbow })
                        }}
                        style={isRainbow ? {
                          background: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 30%, #00C6FF 60%, #00E676 100%)'
                        } : undefined}
                      >
                        {is3D ? (
                          <div className="h-[22px] w-[22px] rounded-md bg-gradient-to-br from-[#6A11CB] via-[#2575FC] to-[#00E676] shadow-lg ring-1 ring-white/20 flex items-center justify-center">
                            <item.icon className="h-[14px] w-[14px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" strokeWidth={isRainbow ? 2.5 : 2.5} />
                          </div>
                        ) : (
                          <item.icon className="h-[18px] w-[18px]" strokeWidth={isRainbow ? 2.5 : 2} />
                        )}
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}

              {!isCollapsed && profileItems.length > 0 && (
                <p className="px-4 text-sm font-bold uppercase tracking-wider mt-6 mb-2 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] bg-clip-text text-transparent">
                  Profile
                </p>
              )}
              {profileItems.map((item) => {
                const isRainbow = item.variant === 'rainbow'
                const is3D = ["Certificates", "Resume", "Groups"].includes(item.title)
                return (
                  <SidebarMenuItem key={item.title} className={isRainbow ? "mb-2 mt-2" : ""}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.title : undefined}
                      className={isRainbow ? "hover:bg-transparent hover:text-white" : ""}
                    >
                      <NavLink
                        to={item.url}
                        title={item.url === '/connect' ? 'Network & interview conversations' : undefined}
                        className={({ isActive }) => {
                          const isJobsItem = item.url === '/jobs'
                          const effectiveActive = isJobsItem
                            ? isActive && !location.pathname.startsWith('/jobs/messages')
                            : isActive
                          return getNavCls({ isActive: effectiveActive, isRainbow })
                        }}
                        style={isRainbow ? {
                          background: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 30%, #00C6FF 60%, #00E676 100%)'
                        } : undefined}
                      >
                        {is3D ? (
                          <div className="h-[22px] w-[22px] rounded-md bg-gradient-to-br from-[#6A11CB] via-[#2575FC] to-[#00E676] shadow-lg ring-1 ring-white/20 flex items-center justify-center">
                            <item.icon className="h-[14px] w-[14px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" strokeWidth={isRainbow ? 2.5 : 2.5} />
                          </div>
                        ) : (
                          <item.icon className="h-[18px] w-[18px]" strokeWidth={isRainbow ? 2.5 : 2} />
                        )}
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}

              {!isCollapsed && manageItems.length > 0 && (
                <p className="px-4 text-sm font-bold uppercase tracking-wider mt-6 mb-2 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] bg-clip-text text-transparent">
                  Manage
                </p>
              )}
              {manageItems.map((item) => {
                const isRainbow = item.variant === 'rainbow'
                const is3D = ["Companies", "Settings"].includes(item.title)
                return (
                  <SidebarMenuItem key={item.title} className={isRainbow ? "mb-2 mt-2" : ""}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.title : undefined}
                      className={isRainbow ? "hover:bg-transparent hover:text-white" : ""}
                    >
                      <NavLink
                        to={item.url}
                        title={item.url === '/connect' ? 'Network & interview conversations' : undefined}
                        className={({ isActive }) => {
                          const isJobsItem = item.url === '/jobs'
                          const effectiveActive = isJobsItem
                            ? isActive && !location.pathname.startsWith('/jobs/messages')
                            : isActive
                          return getNavCls({ isActive: effectiveActive, isRainbow })
                        }}
                        style={isRainbow ? {
                          background: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 30%, #00C6FF 60%, #00E676 100%)'
                        } : undefined}
                      >
                        {is3D ? (
                          <div className="h-[22px] w-[22px] rounded-md bg-gradient-to-br from-[#6A11CB] via-[#2575FC] to-[#00E676] shadow-lg ring-1 ring-white/20 flex items-center justify-center">
                            <item.icon className="h-[14px] w-[14px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" strokeWidth={isRainbow ? 2.5 : 2.5} />
                          </div>
                        ) : (
                          <item.icon className="h-[18px] w-[18px]" strokeWidth={isRainbow ? 2.5 : 2} />
                        )}
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
