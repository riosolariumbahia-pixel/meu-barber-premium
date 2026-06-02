import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Plus, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { listCashFlow, upsertCashFlow, deleteCashFlow, getFinanceSummary } from "@/lib/cashflow.functions";
import { generateMonthlyReport } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/format";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const summaryQ = queryOptions({ queryKey: ["finance-summary"], queryFn: () => getFinanceSummary() });

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Barber360" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(summaryQ),
  component: FinancePage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
});

function FinancePage() {
  const { data: summary } = useQuery(summaryQ);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const { data: flows = [] } = useQuery({
    queryKey: ["cashflow", monthStart],
    queryFn: () => listCashFlow({ data: { from: monthStart, to: next } }),
  });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const del = useMutation({
    mutationFn: (id: string) => deleteCashFlow({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Lançamento removido"); },
  });
  const ai = useMutation({
    mutationFn: () => generateMonthlyReport({
      data: {
        revenue: summary?.kpis.monthRevenue ?? 0,
        expense: summary?.kpis.expense30 ?? 0,
        ticket: summary?.kpis.ticket ?? 0,
        topBarber: summary?.byBarber?.[0]?.name,
        topService: summary?.byService?.[0]?.name,
      },
    }),
    onSuccess: (r) => { setAiText(r.content); setAiOpen(true); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Receitas, despesas, comissões e indicadores do mês.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => ai.mutate()} disabled={ai.isPending}><Sparkles className="mr-1 h-4 w-4" />{ai.isPending ? "Gerando..." : "Relatório IA"}</Button>
          <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Lançamento</Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receita (mês)" value={formatBRL(summary?.kpis.monthRevenue ?? 0)} icon={TrendingUp} tone="text-emerald-500" />
        <Kpi label="Despesas (30d)" value={formatBRL(summary?.kpis.expense30 ?? 0)} icon={TrendingDown} tone="text-destructive" />
        <Kpi label="Lucro (30d)" value={formatBRL(summary?.kpis.profit30 ?? 0)} icon={Wallet} tone="text-primary" />
        <Kpi label="Ticket médio" value={formatBRL(summary?.kpis.ticket ?? 0)} icon={TrendingUp} tone="text-primary" />
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h2 className="mb-3 font-semibold">Receita x Despesa (30 dias)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary?.series ?? []}>
              <defs>
                <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
              <Area type="monotone" dataKey="income" stroke="hsl(var(--primary))" fill="url(#gi)" name="Receita" />
              <Area type="monotone" dataKey="expense" stroke="hsl(var(--destructive))" fill="url(#ge)" name="Despesa" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="mb-3 font-semibold">Comissões por barbeiro (mês)</h2>
          {summary?.byBarber?.length ? (
            <ul className="divide-y divide-border/40 text-sm">
              {summary.byBarber.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2">
                  <div><div className="font-medium">{b.name}</div><div className="text-xs text-muted-foreground">{b.count} atendimentos · {formatBRL(b.revenue)}</div></div>
                  <div className="font-semibold text-primary">{formatBRL(b.commission)}</div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Sem atendimentos finalizados ainda.</p>}
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="mb-3 font-semibold">Top serviços</h2>
          {summary?.byService?.length ? (
            <ul className="divide-y divide-border/40 text-sm">
              {summary.byService.map((s) => (
                <li key={s.name} className="flex items-center justify-between py-2">
                  <div><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.count} vendas</div></div>
                  <div className="font-semibold">{formatBRL(s.revenue)}</div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between p-4"><h2 className="font-semibold">Lançamentos do mês</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-2 text-left">Data</th><th className="px-4 py-2 text-left">Descrição</th><th className="px-4 py-2 text-left">Categoria</th><th className="px-4 py-2 text-right">Valor</th><th /></tr>
          </thead>
          <tbody>
            {flows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Sem lançamentos.</td></tr>
            ) : flows.map((f: any) => (
              <tr key={f.id} className="border-t border-border/40">
                <td className="px-4 py-2 text-muted-foreground">{new Date(f.occurred_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-2 font-medium">{f.description}</td>
                <td className="px-4 py-2 text-muted-foreground">{f.category ?? "—"}</td>
                <td className={`px-4 py-2 text-right font-semibold ${f.type === "income" ? "text-emerald-500" : "text-destructive"}`}>{f.type === "income" ? "+" : "-"} {formatBRL(f.amount)}</td>
                <td className="px-4 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover lançamento?")) del.mutate(f.id); }}>Excluir</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CashFlowDialog open={open} onOpenChange={setOpen} />
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Relatório do mês (IA)</DialogTitle></DialogHeader>
          <pre className="max-h-[60vh] whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm">{aiText}</pre>
          <DialogFooter><Button onClick={() => setAiOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span><Icon className={`h-4 w-4 ${tone}`} /></div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function CashFlowDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ type: "income", amount: 0, description: "", category: "" });
  useMemo(() => { if (open) setForm({ type: "income", amount: 0, description: "", category: "" }); }, [open]);
  const save = useMutation({
    mutationFn: () => upsertCashFlow({ data: form }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Lançamento criado"); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Tabs value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <TabsList className="w-full"><TabsTrigger className="flex-1" value="income">Receita</TabsTrigger><TabsTrigger className="flex-1" value="expense">Despesa</TabsTrigger></TabsList>
            </Tabs>
          </div>
          <div className="sm:col-span-2"><Label>Descrição*</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Valor (R$)*</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
          <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="aluguel, produtos..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.description || !form.amount}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
