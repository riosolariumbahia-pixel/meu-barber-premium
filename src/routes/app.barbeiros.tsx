import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Scissors, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listBarbers, upsertBarber, deleteBarber } from "@/lib/barbers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataEmpty } from "@/components/data-empty";

const q = queryOptions({ queryKey: ["barbers"], queryFn: () => listBarbers() });

export const Route = createFileRoute("/app/barbeiros")({
  head: () => ({ meta: [{ title: "Barbeiros — Barber360" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: BarbersPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
});

function BarbersPage() {
  const { data: barbers = [] } = useQuery(q);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: (id: string) => deleteBarber({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["barbers"] }); toast.success("Barbeiro removido"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Barbeiros</h1>
          <p className="text-sm text-muted-foreground">Cadastre seu time e configure comissões.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" /> Novo barbeiro</Button>
      </header>

      {barbers.length === 0 ? (
        <DataEmpty icon={Scissors} title="Sem barbeiros" description="Cadastre seu primeiro profissional para começar a agendar." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((b: any) => (
            <div key={b.id} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 font-semibold text-primary">
                  {b.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="truncate font-semibold">{b.name}</div>
                    {!b.is_active && <Badge variant="outline">Inativo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{b.specialty ?? "Barbeiro"}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><span className="block uppercase tracking-wider">Comissão</span>
                  <span className="text-sm text-foreground">{b.commission_type === "percent" ? `${b.commission_value}%` : `R$ ${Number(b.commission_value).toFixed(2)}`}</span>
                </div>
                <div><span className="block uppercase tracking-wider">Horário</span>
                  <span className="text-sm text-foreground">{b.hours}</span>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remover ${b.name}?`)) del.mutate(b.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BarberDialog open={open} onOpenChange={setOpen} barber={editing} />
    </div>
  );
}

function BarberDialog({ open, onOpenChange, barber }: { open: boolean; onOpenChange: (v: boolean) => void; barber: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ name: "", specialty: "", role: "", avatar_url: "", commission_type: "percent", commission_value: 50, hours: "09:00-18:00", is_active: true });
  useMemo(() => {
    if (open) setForm({
      name: barber?.name ?? "",
      specialty: barber?.specialty ?? "",
      role: barber?.role ?? "",
      avatar_url: barber?.avatar_url ?? "",
      commission_type: barber?.commission_type ?? "percent",
      commission_value: Number(barber?.commission_value ?? 50),
      hours: barber?.hours ?? "09:00-18:00",
      is_active: barber?.is_active ?? true,
    });
  }, [open, barber]);
  const save = useMutation({
    mutationFn: () => upsertBarber({ data: { ...form, id: barber?.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["barbers"] }); toast.success("Barbeiro salvo"); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{barber ? "Editar barbeiro" : "Novo barbeiro"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Nome*</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Especialidade</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
          <div><Label>Função</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
          <div><Label>Horário</Label><Input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="09:00-18:00" /></div>
          <div>
            <Label>Tipo de comissão</Label>
            <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentual (%)</SelectItem>
                <SelectItem value="fixed">Fixa (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Valor da comissão</Label><Input type="number" step="0.01" value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: Number(e.target.value) })} /></div>
          <div className="sm:col-span-2"><Label>URL do avatar</Label><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://..." /></div>
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
