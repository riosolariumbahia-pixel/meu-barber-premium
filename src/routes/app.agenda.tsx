import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight, MessageCircle, Zap, Share2, Bell, CalendarDays, CalendarRange, Calendar as CalIcon } from "lucide-react";
import { toast } from "sonner";
import { listAppointments, createAppointment, setAppointmentStatus, deleteAppointment, createWalkIn, listPendingReminders, markReminderSent, getAgendaKpis, listMonthCounts } from "@/lib/appointments.functions";
import { listClients } from "@/lib/clients.functions";
import { listBarbers } from "@/lib/barbers.functions";
import { listServices } from "@/lib/services.functions";
import { getTenantSettings } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { formatBRL } from "@/lib/format";
import { buildWhatsAppLink, reminderTemplate } from "@/lib/whatsapp";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Barber360" }] }),
  component: AgendaPage,
});

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado", confirmed: "Confirmado", serving: "Em atendimento",
  completed: "Finalizado", cancelled: "Cancelado", noshow: "Não compareceu",
};
const STATUS_TONE: Record<string, string> = {
  scheduled: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  confirmed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  serving: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  completed: "bg-primary/15 text-primary",
  cancelled: "bg-muted text-muted-foreground line-through",
  noshow: "bg-destructive/15 text-destructive",
};

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmtDate(d: Date) { return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 1); }
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function monthLabel(d: Date) { return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); }

function AgendaPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [anchor, setAnchor] = useState<Date>(startOfDay(new Date()));
  const [open, setOpen] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);

  const from =
    view === "day" ? anchor :
    view === "week" ? addDays(anchor, -anchor.getDay()) :
    startOfMonth(anchor);
  const to =
    view === "day" ? addDays(from, 1) :
    view === "week" ? addDays(from, 7) :
    endOfMonth(anchor);

  const range = { from: from.toISOString(), to: to.toISOString() };

  const { data: appts = [] } = useQuery({
    queryKey: ["appointments", range],
    queryFn: () => listAppointments({ data: range }),
  });
  const { data: kpis } = useQuery({
    queryKey: ["agenda-kpis", ymd(anchor)],
    queryFn: () => getAgendaKpis({ data: { day: ymd(anchor) } }),
    refetchInterval: 60_000,
  });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => listClients() });
  const { data: barbers = [] } = useQuery({ queryKey: ["barbers"], queryFn: () => listBarbers() });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => listServices() });
  const { data: tenant } = useQuery({ queryKey: ["tenant-settings"], queryFn: () => getTenantSettings() });
  const { data: reminders = [] } = useQuery({
    queryKey: ["pending-reminders"],
    queryFn: () => listPendingReminders(),
    refetchInterval: 60_000,
  });
  const tenantName = tenant?.name ?? "Barbearia";

  const sendReminder = useMutation({
    mutationFn: (id: string) => markReminderSent({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-reminders"] }),
  });

  function copyPublicLink() {
    if (!tenant?.slug) return toast.error("Salve o nome da barbearia primeiro");
    const url = `${window.location.origin}/b/${tenant.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link de agendamento copiado!");
  }

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: any }) => setAppointmentStatus({ data: vars }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Status atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteAppointment({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Agendamento removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const days =
    view === "day" ? [from] :
    view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(from, i)) :
    [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {view === "month" ? monthLabel(anchor) : view === "day" ? fmtDate(from) : `${fmtDate(from)} — ${fmtDate(addDays(to, -1))}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="month"><CalIcon className="mr-1 h-3.5 w-3.5" />Mês</TabsTrigger>
              <TabsTrigger value="week"><CalendarRange className="mr-1 h-3.5 w-3.5" />Semana</TabsTrigger>
              <TabsTrigger value="day"><CalendarDays className="mr-1 h-3.5 w-3.5" />Dia</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center rounded-md border border-border">
            <Button size="icon" variant="ghost" onClick={() => {
              if (view === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
              else setAnchor(addDays(anchor, view === "day" ? -1 : -7));
            }}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setAnchor(startOfDay(new Date()))}>Hoje</Button>
            <Button size="icon" variant="ghost" onClick={() => {
              if (view === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
              else setAnchor(addDays(anchor, view === "day" ? 1 : 7));
            }}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" onClick={copyPublicLink}><Share2 className="mr-1 h-4 w-4" /> Link público</Button>
          <Button variant="secondary" onClick={() => setWalkOpen(true)}><Zap className="mr-1 h-4 w-4" /> Avulso</Button>
          <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Novo</Button>
        </div>
      </header>

      <KpiStrip kpis={kpis} />

      {reminders.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <Bell className="h-4 w-4" /> {reminders.length} lembrete(s) pronto(s) para envio
          </div>
          <ul className="space-y-1">
            {reminders.slice(0, 5).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Atendimento em ~1h</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" asChild>
                    <a href={r.wa_link} target="_blank" rel="noreferrer" onClick={() => sendReminder.mutate(r.id)}>
                      <MessageCircle className="mr-1 h-3.5 w-3.5" />Enviar WhatsApp
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => sendReminder.mutate(r.id)}>Marcar enviado</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={view === "day" ? "" : "grid grid-cols-1 gap-3 md:grid-cols-7"}>
        {view === "month" ? (
          <MonthGrid anchor={anchor} appts={appts as any[]} onPickDay={(d) => { setAnchor(d); setView("day"); }} />
        ) : days.map((d) => {
          const list = (appts as any[]).filter((a) => {
            const s = new Date(a.starts_at);
            return s >= d && s < addDays(d, 1);
          }).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          return (
            <div key={d.toISOString()} className="rounded-xl border border-border/60 bg-card p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fmtDate(d)}</div>
              {list.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Sem agendamentos</div>
              ) : (
                <ul className="space-y-2">
                  {list.map((a) => (
                    <li key={a.id} className="rounded-lg border border-border/40 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {a.customer_name}</div>
                          <div className="truncate text-xs text-muted-foreground">{a.service_name} · {a.barber_name ?? "—"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold">{formatBRL(a.price)}</div>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase ${STATUS_TONE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-1">
                        {a.customer_phone && (
                          <Button size="sm" variant="ghost" asChild>
                            <a target="_blank" rel="noreferrer" href={buildWhatsAppLink(a.customer_phone, reminderTemplate({ customerName: a.customer_name, serviceName: a.service_name, startsAt: a.starts_at, tenantName }))}>
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Status</Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {Object.entries(STATUS_LABEL).map(([k, v]) => (
                              <DropdownMenuItem key={k} onClick={() => setStatus.mutate({ id: a.id, status: k })}>{v}</DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover agendamento?")) del.mutate(a.id); }}>Excluir</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <AppointmentDialog open={open} onOpenChange={setOpen} clients={clients} barbers={barbers} services={services} />
      <WalkInDialog open={walkOpen} onOpenChange={setWalkOpen} clients={clients} barbers={barbers} services={services} />
    </div>
  );
}

function AppointmentDialog({ open, onOpenChange, clients, barbers, services }: { open: boolean; onOpenChange: (v: boolean) => void; clients: any[]; barbers: any[]; services: any[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ clientId: "", customer_name: "", customer_phone: "", barberId: "", serviceId: "", date: "", time: "", price: 0 });
  useMemo(() => {
    if (open) {
      const now = new Date();
      setForm({ clientId: "", customer_name: "", customer_phone: "", barberId: "", serviceId: "", date: now.toISOString().slice(0, 10), time: "10:00", price: 0 });
    }
  }, [open]);

  function onClient(id: string) {
    const c = clients.find((x) => x.id === id);
    setForm((f: any) => ({ ...f, clientId: id, customer_name: c?.name ?? f.customer_name, customer_phone: c?.phone ?? f.customer_phone }));
  }
  function onService(id: string) {
    const s = services.find((x) => x.id === id);
    setForm((f: any) => ({ ...f, serviceId: id, price: Number(s?.price ?? f.price) }));
  }

  const save = useMutation({
    mutationFn: () => {
      const starts = new Date(`${form.date}T${form.time}:00`);
      const svc = services.find((s) => s.id === form.serviceId);
      const ends = svc ? new Date(starts.getTime() + Number(svc.duration_minutes) * 60000) : null;
      const b = barbers.find((x) => x.id === form.barberId);
      return createAppointment({
        data: {
          client_id: form.clientId || null,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone || null,
          barber_id: form.barberId || null,
          barber_name: b?.name ?? null,
          service_id: form.serviceId || null,
          service_name: svc?.name ?? "Atendimento",
          starts_at: starts.toISOString(),
          ends_at: ends ? ends.toISOString() : null,
          price: Number(form.price ?? 0),
          payment_method: "presencial",
        },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Agendamento criado"); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo agendamento</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Cliente cadastrado</Label>
            <Select value={form.clientId} onValueChange={onClient}>
              <SelectTrigger><SelectValue placeholder="Selecione ou digite abaixo" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Nome*</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
          <div>
            <Label>Barbeiro</Label>
            <Select value={form.barberId} onValueChange={(v) => setForm({ ...form, barberId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{barbers.filter((b) => b.is_active).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Serviço*</Label>
            <Select value={form.serviceId} onValueChange={onService}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{services.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {formatBRL(s.price)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Hora</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Preço (R$)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.customer_name || !form.serviceId}>{save.isPending ? "Salvando..." : "Agendar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalkInDialog({ open, onOpenChange, clients, barbers, services }: { open: boolean; onOpenChange: (v: boolean) => void; clients: any[]; barbers: any[]; services: any[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ clientId: "", customer_name: "Cliente avulso", barberId: "", serviceId: "", payment: "dinheiro", price: 0 });
  useMemo(() => {
    if (open) setForm({ clientId: "", customer_name: "Cliente avulso", barberId: "", serviceId: "", payment: "dinheiro", price: 0 });
  }, [open]);

  function onClient(id: string) {
    const c = clients.find((x) => x.id === id);
    setForm((f: any) => ({ ...f, clientId: id, customer_name: c?.name ?? f.customer_name }));
  }
  function onService(id: string) {
    const s = services.find((x) => x.id === id);
    setForm((f: any) => ({ ...f, serviceId: id, price: Number(s?.price ?? f.price) }));
  }

  const save = useMutation({
    mutationFn: () => createWalkIn({
      data: {
        client_id: form.clientId || null,
        customer_name: form.customer_name,
        barber_id: form.barberId || null,
        service_id: form.serviceId,
        payment_method: form.payment,
        price_override: Number(form.price) || undefined,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
      toast.success("Atendimento registrado e contabilizado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Atendimento avulso (walk-in)</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">Registra um atendimento concluído agora e já gera receita no financeiro do dia.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Cliente (opcional)</Label>
            <Select value={form.clientId} onValueChange={onClient}>
              <SelectTrigger><SelectValue placeholder="Selecionar ou deixar como avulso" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label>Nome</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
          <div>
            <Label>Serviço*</Label>
            <Select value={form.serviceId} onValueChange={onService}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{services.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {formatBRL(s.price)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Barbeiro</Label>
            <Select value={form.barberId} onValueChange={(v) => setForm({ ...form, barberId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{barbers.filter((b) => b.is_active).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
          <div>
            <Label>Pagamento</Label>
            <Select value={form.payment} onValueChange={(v) => setForm({ ...form, payment: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.serviceId || !form.customer_name}>
            {save.isPending ? "Registrando..." : "Registrar atendimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}