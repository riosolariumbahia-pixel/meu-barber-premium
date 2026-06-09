import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Moon, Sun, LogOut, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/tenant.functions";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ctxQuery = queryOptions({
  queryKey: ["app", "context"],
  queryFn: () => getMyContext(),
});

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Barber360" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  loader: async ({ context }) => {
    const ctx = await context.queryClient.ensureQueryData(ctxQuery);
    if (!ctx?.currentTenant) throw redirect({ to: "/onboarding" });
    return ctx;
  },
  component: AppShell,
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h2 className="text-lg font-semibold">Não foi possível carregar o painel</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

function AppShell() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(ctxQuery);
  const { theme, toggle } = useTheme();
  const tenant = data.currentTenant as
    | { name: string; subscription_status: string; trial_ends_at: string | null }
    | null;

  async function onLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (!tenant) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar tenantName={tenant.name} />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur md:px-6">
            <SidebarTrigger />
            <div className="flex-1" />
            {tenant.subscription_status === "trial" && (
              <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
                Período de teste ativo
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {(data.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden md:inline text-sm">{data.profile?.full_name ?? "Usuário"}</span>
                  <ChevronsUpDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{tenant.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}