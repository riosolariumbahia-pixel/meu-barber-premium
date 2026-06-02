import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { CalendarCheck2, Users, Wallet, TrendingUp, ArrowRight } from "lucide-react";
import { getFinanceSummary } from "@/lib/cashflow.functions";
import { listAppointments } from "@/lib/appointments.functions";
import { formatBRL } from "@/lib/format";

const summaryQ = queryOptions({ queryKey: ["finance-summary"], queryFn: () => getFinanceSummary() });

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Barber360" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(summaryQ),
  component: DashboardPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
});

function DashboardPage() {
  const { data: s } = useQuery(summaryQ);
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const { data: todayAppts = [] } = useQuery({ queryKey: ["appointments", { from, to }], queryFn: () => listAppointments({ data: { from, to } }) });

  const kpis = [
    { label: "Agendamentos hoje", value: String(todayAppts.length), icon: CalendarCheck2 },
    { label: "Atendimentos (mês)", value: String(s?.kpis.completedCount ?? 0), icon: Users },
    { label: "Faturamento (mês)", value: formatBRL(s?.kpis.monthRevenue ?? 0), icon: Wallet },
    { label: "Ticket médio", value: formatBRL(s?.kpis.ticket ?? 0), icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">Resumo em tempo real da sua barbearia.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</span>
              <k.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-semibold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Próximos agendamentos hoje</h2>
            <Link to="/app/agenda" className="text-xs text-primary hover:underline">Ver agenda <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          {todayAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem agendamentos para hoje.</p>
          ) : (
            <ul className="divide-y divide-border/40 text-sm">
              {todayAppts.slice(0, 6).map((a: any) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">{new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {a.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{a.service_name} · {a.barber_name ?? "—"}</div>
                  </div>
                  <div className="font-semibold">{formatBRL(a.price)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="mb-3 font-semibold">Top barbeiros do mês</h2>
          {s?.byBarber?.length ? (
            <ul className="divide-y divide-border/40 text-sm">
              {s.byBarber.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2">
                  <div className="font-medium">{b.name}</div>
                  <div className="text-right">
                    <div className="font-semibold">{formatBRL(b.revenue)}</div>
                    <div className="text-xs text-muted-foreground">{b.count} atendimentos</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Finalize atendimentos para ver o ranking.</p>}
        </div>
      </div>
    </div>
  );
}