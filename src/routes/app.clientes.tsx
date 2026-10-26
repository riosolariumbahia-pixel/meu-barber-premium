import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Pencil, Trash2, Search, MessageCircle, History } from "lucide-react";
import { toast } from "sonner";
import { listClients, upsertClient, deleteClient, getClientHistory } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatPhone, vipTierFromSpend } from "@/lib/format";
import { buildWhatsAppLink, reminderTemplate } from "@/lib/whatsapp";
import { DataEmpty } from "@/components/data-empty";

const clientsQ = queryOptions({ queryKey: ["clients"], queryFn: () => listClients() });

export const Route = createFileRoute("/app/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Barber360" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(clientsQ),
  component: ClientsPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</div>,
});

function ClientsPage() {
  const { data: clients = [] } = useQuery(clientsQ);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteClient({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Cliente removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c: any) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q));
  }, [clients, search]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">CRM com histórico, gasto e frequência.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Novo cliente
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <DataEmpty icon={Users} title="Nenhum cliente ainda" description="Cadastre seu primeiro cliente para começar a registrar agendamentos." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Telefone</th>
                <th className="px-4 py-3 text-right">Visitas</th>
                <th className="px-4 py-3 text-right">Gasto total</th>
                <th className="px-4 py-3 text-left">VIP</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatPhone(c.phone)}</td>
                  <td className="px-4 py-3 text-right">{c._visits}</td>
                  <td className="px-4 py-3 text-right">{formatBRL(c._total_spent)}</td>
                  <td className="px-4 py-3"><Badge variant="secondary" className="capitalize">{vipTierFromSpend(c._total_spent)}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {c.whatsapp || c.phone ? (
                        <Button size="icon" variant="ghost" asChild title="WhatsApp">
                          <a target="_blank" rel="noreferrer" href={buildWhatsAppLink(c.whatsapp || c.phone, `Olá, ${c.name}! 👋`)}>
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : null}
                      <Button size="icon" variant="ghost" onClick={() => setHistoryId(c.id)} title="Histórico">
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover ${c.name}?`)) del.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientDialog open={open} onOpenChange={setOpen} client={editing} />
      <ClientHistoryDrawer clientId={historyId} onClose={() => setHistoryId(null)} />
    </div>
  );
}

function ClientDialog({ open, onOpenChange, client }: { open: boolean; onOpenChange: (v: boolean) => void; client: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(() => ({ name: "", phone: "", whatsapp: "", email: "", birth_date: "", notes: "" }));
  useMemo(() => {
    if (open) setForm({
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      whatsapp: client?.whatsapp ?? "",
      email: client?.email ?? "",
      birth_date: client?.birth_date ?? "",
      notes: client?.notes ?? "",
    });
  }, [open, client]);

  const save = useMutation({
    mutationFn: () => upsertClient({ data: { ...form, id: client?.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Cliente salvo"); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Cadastre dados de contato e preferências.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Nome*</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" /></div>
          <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Nascimento</Label><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Notas</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientHistoryDrawer({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const { data = [] } = useQuery({
    queryKey: ["client-history", clientId],
    queryFn: () => getClientHistory({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });
  return (
    <Drawer open={!!clientId} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Histórico de atendimentos</DrawerTitle></DrawerHeader>
        <div className="max-h-[60vh] overflow-auto p-4">
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atendimento registrado.</p>
          ) : (
            <ul className="space-y-2">
              {data.map((a: any) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3 text-sm">
                  <div>
                    <div className="font-medium">{a.service_name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(a.starts_at).toLocaleString("pt-BR")} · {a.barber_name ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatBRL(a.price)}</div>
                    <Badge variant="outline" className="mt-1 text-[10px] uppercase">{a.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
