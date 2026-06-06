import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  Sparkles,
  Wallet,
  Gift,
  Crown,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const main: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, exact: true },
  { title: "Agenda", url: "/app/agenda", icon: CalendarDays },
  { title: "Clientes", url: "/app/clientes", icon: Users },
  { title: "Barbeiros", url: "/app/barbeiros", icon: Scissors },
  { title: "Serviços", url: "/app/servicos", icon: Sparkles },
];

const business: NavItem[] = [
  { title: "Financeiro", url: "/app/financeiro", icon: Wallet },
  { title: "Fidelidade", url: "/app/fidelidade", icon: Gift },
  { title: "Assinatura", url: "/app/assinatura", icon: Crown },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings },
];

export function AppSidebar({ tenantName }: { tenantName?: string }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (url: string, exact?: boolean) =>
    exact ? path === url : path === url || path.startsWith(url + "/");

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/app" onClick={closeOnMobile} className="flex items-center gap-2 px-2 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Scissors className="h-4 w-4" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{tenantName ?? "Barber360"}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Premium SaaS</div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Operação</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                    <Link to={item.url} onClick={closeOnMobile} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Negócio</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {business.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} onClick={closeOnMobile} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
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