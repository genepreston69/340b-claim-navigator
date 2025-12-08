import { LayoutDashboard, FileText, Receipt, Scale, Settings, Upload, BarChart3, Users, Pill, Stethoscope, Building2, FileWarning } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
const navigationItems = [{
  title: "Dashboard",
  url: "/",
  icon: LayoutDashboard,
  adminOnly: false
}, {
  title: "Scripts",
  url: "/scripts",
  icon: FileText,
  adminOnly: true
}, {
  title: "Claims",
  url: "/claims",
  icon: Receipt,
  adminOnly: true
}, {
  title: "Adjudication",
  url: "/adjudication",
  icon: Scale,
  adminOnly: true
}, {
  title: "Data Import",
  url: "/data-import",
  icon: Upload,
  adminOnly: true
}];
const analyticsItems = [{
  title: "Financial Reports",
  url: "/reports",
  icon: BarChart3
}, {
  title: "Rx Adherence",
  url: "/prescription-adherence",
  icon: Pill
}, {
  title: "Physician Rates",
  url: "/physician-capture-rates",
  icon: Stethoscope
}, {
  title: "Drug-Pharmacy",
  url: "/drug-pharmacy-comparison",
  icon: Building2
}, {
  title: "Contract Status",
  url: "/contract-compliance",
  icon: FileWarning
}];
const adminItems = [{
  title: "Users",
  url: "/users",
  icon: Users,
  adminOnly: true
}, {
  title: "Settings",
  url: "/settings",
  icon: Settings,
  adminOnly: true
}];
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const {
    isAdmin,
    hasAnalyticsAccess
  } = useAuth();
  const isCollapsed = state === "collapsed";
  const visibleNavItems = navigationItems.filter(item => !item.adminOnly || isAdmin);
  const visibleAnalyticsItems = hasAnalyticsAccess ? analyticsItems : [];
  const visibleAdminItems = adminItems.filter(item => !item.adminOnly || isAdmin);
  const renderNavItem = (item: typeof navigationItems[0]) => <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild tooltip={item.title}>
        <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/80 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
          <item.icon className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>;
  return <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        {!isCollapsed && <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">340B Claims</span>
            <span className="text-xs text-sidebar-foreground/60">
        </span>
          </div>}
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
            {!isCollapsed && "Main"}
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu>
              {visibleNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Analytics Section */}
        {visibleAnalyticsItems.length > 0 && <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {!isCollapsed && "Analytics"}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-2">
              <SidebarMenu>
                {visibleAnalyticsItems.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}

        {/* Admin Section */}
        {visibleAdminItems.length > 0 && <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {!isCollapsed && "Admin"}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-2">
              <SidebarMenu>
                {visibleAdminItems.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
      </SidebarContent>
    </Sidebar>;
}