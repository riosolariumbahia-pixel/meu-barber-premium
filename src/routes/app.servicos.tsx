import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listServices, upsertService, deleteService } from "@/lib/services.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { DataEmpty } from "@/components/data-empty";

const q = queryOptions({ queryKey: ["services"], queryFn: () => listServices() });
const CATS = [
  { value: "corte", label: "Corte" },
  { value: "barba", label: "Barba" },
  { value: "sobrancelha", label: "Sobrancelha" },
  { value: "pigmentacao", label: "Pigmentação" },
  { value: "combo", label: "Combo" },
  { value: "outro", label: "Outro" },
];

export const Route = createFileRoute("/app/servicos")({
  head: () => ({ meta: [{ title: "Serviços — Barber360" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: ServicesPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
});

function ServicesPage() {
  const { data: services = [] } = useQuery(q);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const del = useMutation({
    mutationFn: (id: string) => deleteService({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); toast.success("Serviço removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Serviços</h1>
          <p className="text-sm text-muted-foreground">Catálogo de serviços com duração e preço.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" /> Novo serviço</Button>
      </header>

      {services.length === 0 ? (
        <DataEmpty icon={Sparkles} title="Sem serviços" description="Cadastre seus serviços (corte, barba, combos) para usar na agenda." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-right">Duração</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s: any) => (
                <tr key={s.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{s.category}</td>
                  <td className="px-4 py-3 text-right">{s.duration_minutes} min</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatBRL(s.price)}</td>
                  <td className="px-4 py-3"><Badge variant={s.is_active ? "default" : "outline"}>{s.is_active ? "Ativo" : "Inativo"}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover ${s.name}?`)) del.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ServiceDialog open={open} onOpenChange={setOpen} service={editing} />
    </div>
  );
}

function ServiceDialog({ open, onOpenChange, service }: { open: boolean; onOpenChange: (v: boolean) => void; service: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ name: "", category: "corte", duration_minutes: 30, price: 0, is_active: true });
  useMemo(() => {
    if (open) setForm({
      name: service?.name ?? "",
      category: service?.category ?? "corte",
      duration_minutes: Number(service?.duration_minutes ?? 30),
      price: Number(service?.price ?? 0),
      is_active: service?.is_active ?? true,
    });
  }, [open, service]);
  const save = useMutation({
    mutationFn: () => upsertService({ data: { ...form, id: service?.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); toast.success("Serviço salvo"); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Nome*</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Duração (min)</Label><Input type="number" min={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
          <div className="sm:col-span-2"><Label>Preço (R$)</Label><Input type="number" step="0.01" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Ativo</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
