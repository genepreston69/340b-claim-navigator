import { LayoutDashboard, FileText, Receipt, Scale, Settings, Activity, Upload, BarChart3, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, adminOnly: false },
  { title: "Scripts", url: "/scripts", icon: FileText, adminOnly: true },
  { title: "Claims", url: "/claims", icon: Receipt, adminOnly: true },
  { title: "Adjudication", url: "/adjudication", icon: Scale, adminOnly: true },
  { title: "Reports", url: "/reports", icon: BarChart3, adminOnly: true },
  { title: "Data Import", url: "/data-import", icon: Upload, adminOnly: true },
  { title: "Users", url: "/users", icon: Users, adminOnly: true },
  { title: "Settings", url: "/settings", icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { isAdmin } = useAuth();
  const isCollapsed = state === "collapsed";

  const visibleItems = navigationItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Activity className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">340B Claims</span>
              <span className="text-xs text-sidebar-foreground/60">Tracker</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
            {!isCollapsed && "Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/80 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
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
  );
}
