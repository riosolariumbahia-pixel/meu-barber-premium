import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { getLoyaltyRanking, updateLoyaltyConfig } from "@/lib/loyalty.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";

const q = queryOptions({ queryKey: ["loyalty"], queryFn: () => getLoyaltyRanking() });

export const Route = createFileRoute("/app/fidelidade")({
  head: () => ({ meta: [{ title: "Fidelidade — Barber360" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: LoyaltyPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
});

const TIER_COLOR: Record<string, string> = {
  bronze: "bg-amber-700/15 text-amber-700",
  silver: "bg-slate-400/15 text-slate-500",
  gold: "bg-yellow-500/15 text-yellow-600",
  platinum: "bg-primary/15 text-primary",
};

function LoyaltyPage() {
  const { data } = useQuery(q);
  const qc = useQueryClient();
  const [cb, setCb] = useState(0);
  const [pp, setPp] = useState(0);
  useMemo(() => {
    if (data?.config) { setCb(Number(data.config.cashback_percent ?? 0)); setPp(Number(data.config.points_per_real ?? 0)); }
  }, [data?.config]);
  const save = useMutation({
    mutationFn: () => updateLoyaltyConfig({ data: { cashback_percent: cb, points_per_real: pp } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Configuração salva"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fidelidade</h1>
        <p className="text-sm text-muted-foreground">Pontos, cashback e clube VIP.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-5 lg:col-span-1">
          <h2 className="font-semibold">Regras do programa</h2>
          <div className="mt-4 space-y-3">
            <div><Label>Cashback (%)</Label><Input type="number" min={0} max={50} step="0.5" value={cb} onChange={(e) => setCb(Number(e.target.value))} /></div>
            <div><Label>Pontos por R$ gasto</Label><Input type="number" min={0} max={10} step="0.1" value={pp} onChange={(e) => setPp(Number(e.target.value))} /></div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">Salvar regras</Button>
            <p className="text-xs text-muted-foreground">Tiers VIP automáticos por gasto acumulado: Bronze · Prata (R$500) · Ouro (R$2.000) · Platina (R$5.000).</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Ranking de clientes</h2>
          {data?.rows?.length ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-2 text-left">#</th><th className="py-2 text-left">Cliente</th><th className="py-2 text-left">Tier</th><th className="py-2 text-right">Pontos</th><th className="py-2 text-right">Cashback</th><th className="py-2 text-right">Total gasto</th></tr></thead>
              <tbody>
                {data.rows.slice(0, 30).map((c, i) => (
                  <tr key={c.id} className="border-t border-border/40">
                    <td className="py-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="py-2"><Badge className={`capitalize ${TIER_COLOR[c.tier]}`} variant="outline">{c.tier}</Badge></td>
                    <td className="py-2 text-right">{c.fidelity_points}</td>
                    <td className="py-2 text-right">{formatBRL(c.cashback_balance)}</td>
                    <td className="py-2 text-right font-semibold">{formatBRL(c.total_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid place-items-center py-10 text-center text-muted-foreground"><Gift className="h-8 w-8" /><p className="mt-2 text-sm">Sem clientes ranqueados ainda.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}