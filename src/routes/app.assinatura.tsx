import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Crown, Check } from "lucide-react";
import { getTenantSettings } from "@/lib/settings.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const q = queryOptions({ queryKey: ["tenant-settings"], queryFn: () => getTenantSettings() });

export const Route = createFileRoute("/app/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura — Barber360" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: SubscriptionPage,
});

const PLANS = [
  { id: "starter", name: "Starter", price: "R$ 0", desc: "Para começar", features: ["1 barbeiro", "Agenda + clientes", "Financeiro básico"] },
  { id: "pro", name: "Pro", price: "R$ 97/mês", desc: "Mais popular", features: ["Barbeiros ilimitados", "Fidelidade & cashback", "Relatórios IA", "WhatsApp click-to-chat"], featured: true },
  { id: "premium", name: "Premium", price: "R$ 197/mês", desc: "Tudo + automações", features: ["Tudo do Pro", "Multi-unidade", "PIX integrado", "Suporte prioritário"] },
];

function SubscriptionPage() {
  const { data: t } = useQuery(q);
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assinatura</h1>
          <p className="text-sm text-muted-foreground">Plano atual: <span className="font-medium capitalize">{t?.subscription_plan}</span> · Status: <Badge variant="outline" className="capitalize">{t?.subscription_status}</Badge>{t?.trial_ends_at ? ` · Trial até ${new Date(t.trial_ends_at).toLocaleDateString("pt-BR")}` : ""}</p>
        </div>
        <Crown className="h-6 w-6 text-primary" />
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} className={`relative rounded-2xl border bg-card p-6 shadow-sm ${p.featured ? "border-primary ring-1 ring-primary/30" : "border-border/60"}`}>
            {p.featured && <Badge className="absolute -top-3 left-6">Mais popular</Badge>}
            <h2 className="text-lg font-semibold">{p.name}</h2>
            <p className="text-xs text-muted-foreground">{p.desc}</p>
            <div className="mt-3 text-3xl font-bold">{p.price}</div>
            <ul className="mt-4 space-y-2 text-sm">
              {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary" /> {f}</li>)}
            </ul>
            <Button className="mt-6 w-full" variant={p.featured ? "default" : "outline"} disabled>
              {t?.subscription_plan === p.id ? "Plano atual" : "Em breve"}
            </Button>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Cobrança automática chega em breve via Stripe ou PIX recorrente.</p>
    </div>
  );
}