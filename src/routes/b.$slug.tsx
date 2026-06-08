import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { queryOptions, useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPublicBooking, getPublicAvailability, createPublicBooking } from "@/lib/public-booking.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scissors, MapPin, Instagram, Phone, Check } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

const bookingQ = (slug: string) =>
  queryOptions({ queryKey: ["public-booking", slug], queryFn: () => getPublicBooking({ data: { slug } }) });

const PUBLIC_TIME_ZONE = "America/Sao_Paulo";

export const Route = createFileRoute("/b/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(bookingQ(params.slug)),
  head: ({ loaderData }: any) => ({
    meta: [
      { title: loaderData?.tenant?.name ? `Agendar — ${loaderData.tenant.name}` : "Agendar atendimento" },
      { name: "description", content: `Agende seu horário online em ${loaderData?.tenant?.name ?? "nossa barbearia"}.` },
      { property: "og:title", content: loaderData?.tenant?.name ? `Agendar — ${loaderData.tenant.name}` : "Agendar atendimento" },
      { property: "og:description", content: `Agende seu horário online em ${loaderData?.tenant?.name ?? "nossa barbearia"}.` },
    ],
  }),
  component: PublicBookingPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Não foi possível abrir esta página</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary underline">Voltar</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Barbearia não encontrada.</div>,
});

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PUBLIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function publicTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: PUBLIC_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
}

function PublicBookingPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(bookingQ(slug));
  const tenant = data.tenant;
  const services = data.services;
  const barbers = data.barbers;
  const qc = useQueryClient();

  useEffect(() => {
    if (!tenant?.id) return;
    const channel = supabase
      .channel(`public-agenda-${tenant.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "public_agenda_events", filter: `tenant_id=eq.${tenant.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["public-availability", slug] });
        qc.invalidateQueries({ queryKey: ["public-booking", slug] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, slug, qc]);

  const [serviceId, setServiceId] = useState<string>("");
  const [barberId, setBarberId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [slot, setSlot] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<{ startsAt: string } | null>(null);

  const availability = useQuery({
    queryKey: ["public-availability", slug, serviceId, barberId, date],
    queryFn: () => getPublicAvailability({ data: { slug, serviceId, barberId: barberId || undefined, date } }),
    enabled: !!serviceId && !!date,
  });

  const create = useMutation({
    mutationFn: () =>
      createPublicBooking({
        data: {
          slug, serviceId, barberId: barberId || null, startsAt: slot,
          customer: { name, phone, email: email || null },
        },
      }),
    onSuccess: (r) => setDone({ startsAt: r.startsAt }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (done) {
    const d = new Date(done.startsAt);
    return (
      <Shell tenant={tenant}>
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-7 w-7" /></div>
          <h2 className="mt-4 text-xl font-semibold">Agendamento confirmado!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {d.toLocaleDateString("pt-BR", { timeZone: PUBLIC_TIME_ZONE, weekday: "long", day: "2-digit", month: "long" })} às {publicTime(done.startsAt)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Você receberá um lembrete 1 hora antes pelo WhatsApp.</p>
          <Button className="mt-6" onClick={() => { setDone(null); setSlot(""); setServiceId(""); setBarberId(""); }}>Fazer outro</Button>
        </div>
      </Shell>
    );
  }

  const canConfirm = serviceId && slot && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10;

  return (
    <Shell tenant={tenant}>
      <div className="space-y-5">
        <Section title="1. Escolha o serviço">
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s: any) => (
              <button key={s.id} type="button" onClick={() => { setServiceId(s.id); setSlot(""); }}
                className={`rounded-xl border p-3 text-left transition ${serviceId === s.id ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/50"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-sm font-semibold text-primary">{formatBRL(s.price)}</div>
                </div>
                <div className="text-xs text-muted-foreground">{s.duration_minutes} min</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="2. Barbeiro (opcional)">
          <div className="flex flex-wrap gap-2">
            <Chip selected={barberId === ""} onClick={() => { setBarberId(""); setSlot(""); }}>Sem preferência</Chip>
            {barbers.map((b: any) => (
              <Chip key={b.id} selected={barberId === b.id} onClick={() => { setBarberId(b.id); setSlot(""); }}>{b.name}</Chip>
            ))}
          </div>
        </Section>

        <Section title="3. Data e horário">
          <div className="grid gap-3 sm:grid-cols-[200px,1fr]">
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} min={todayISO()} onChange={(e) => { setDate(e.target.value); setSlot(""); }} />
            </div>
            <div>
              <Label>Horários disponíveis</Label>
              {!serviceId ? (
                <p className="mt-2 text-sm text-muted-foreground">Selecione um serviço primeiro.</p>
              ) : availability.isLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
              ) : (availability.data?.slots ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Sem horários neste dia. Tente outra data.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {availability.data!.slots.map((iso) => {
                    const t = publicTime(iso);
                    return <Chip key={iso} selected={slot === iso} onClick={() => setSlot(iso)}>{t}</Chip>;
                  })}
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="4. Seus dados">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nome completo*</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>WhatsApp*</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" /></div>
            <div className="sm:col-span-2"><Label>E-mail (opcional)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
        </Section>

        <Button size="lg" className="w-full" disabled={!canConfirm || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Confirmando…" : "Confirmar agendamento"}
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ tenant, children }: { tenant: any; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <header className="mb-6 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Scissors className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight">{tenant.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {tenant.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{tenant.city}</span>}
                {tenant.whatsapp && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{tenant.whatsapp}</span>}
                {tenant.instagram && <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" />{tenant.instagram}</span>}
              </div>
            </div>
          </div>
        </header>
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">Agendamento online via Barber360</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border/60 hover:border-primary/50"}`}>
      {children}
    </button>
  );
}