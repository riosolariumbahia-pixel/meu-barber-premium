import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck2, Users, Wallet, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Barber360" }] }),
  component: DashboardPage,
});

const kpis = [
  { label: "Agendamentos hoje", value: "—", icon: CalendarCheck2, hint: "Conecte agenda na Fase 2" },
  { label: "Clientes ativos", value: "—", icon: Users, hint: "Cadastre na Fase 2" },
  { label: "Faturamento (mês)", value: "R$ —", icon: Wallet, hint: "Disponível na Fase 3" },
  { label: "Ticket médio", value: "R$ —", icon: TrendingUp, hint: "Disponível na Fase 3" },
];

function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vindo ao Barber360. Sua barbearia foi criada com sucesso.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</span>
              <k.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-semibold">{k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.hint}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="font-semibold">Próximos passos</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal pl-5">
          <li>Cadastre seus barbeiros e serviços (Fase 2).</li>
          <li>Importe ou cadastre seus clientes.</li>
          <li>Comece a registrar agendamentos na agenda.</li>
          <li>Acompanhe seu financeiro, comissões e fidelidade.</li>
        </ol>
      </div>
    </div>
  );
}