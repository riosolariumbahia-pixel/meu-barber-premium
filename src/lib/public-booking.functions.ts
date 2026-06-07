import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/i);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveTenant(slug: string) {
  const db = await admin();
  const { data, error } = await db
    .from("tenants")
    .select("id, name, slug, city, whatsapp_number, instagram_handle, logo_color, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Barbearia não encontrada");
  return data;
}

export const getPublicBooking = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ slug: slugSchema }).parse(i))
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.slug);
    const db = await admin();
    const [{ data: services }, { data: barbers }] = await Promise.all([
      db.from("services").select("id, name, price, duration_minutes, category").eq("tenant_id", tenant.id).eq("is_active", true).order("name"),
      db.from("barbers").select("id, name, specialty, avatar_url, hours").eq("tenant_id", tenant.id).eq("is_active", true).order("name"),
    ]);
    return {
      tenant: { id: tenant.id, name: tenant.name, city: tenant.city, whatsapp: tenant.whatsapp_number, instagram: tenant.instagram_handle, color: tenant.logo_color },
      services: services ?? [],
      barbers: barbers ?? [],
    };
  });

const PUBLIC_TIMEZONE_OFFSET = "-03:00";

function brazilDateAt(date: string, minutesFromMidnight: number) {
  const hours = Math.floor(minutesFromMidnight / 60).toString().padStart(2, "0");
  const minutes = (minutesFromMidnight % 60).toString().padStart(2, "0");
  return new Date(`${date}T${hours}:${minutes}:00${PUBLIC_TIMEZONE_OFFSET}`);
}

export const getPublicAvailability = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z.object({
      slug: slugSchema,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      serviceId: z.string().uuid(),
      barberId: z.string().uuid().optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.slug);
    const db = await admin();
    const { data: service } = await db.from("services").select("id, duration_minutes").eq("tenant_id", tenant.id).eq("id", data.serviceId).maybeSingle();
    if (!service) throw new Error("Serviço inválido");
    const dayStart = brazilDateAt(data.date, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

    const hours: [number, number] = [9, 20];

    const apptQuery = db
      .from("appointments")
      .select("starts_at, ends_at, barber_id, status")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .not("status", "in", "(cancelled,noshow)");
    if (data.barberId) apptQuery.eq("barber_id", data.barberId);
    const { data: appts } = await apptQuery;

    const duration = Number(service.duration_minutes) || 30;
    const step = 30;
    const slots: string[] = [];
    const now = Date.now();
    for (let mins = hours[0] * 60; mins + duration <= hours[1] * 60; mins += step) {
      const slotStart = brazilDateAt(data.date, mins);
      if (slotStart.getTime() < now + 30 * 60000) continue;
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);
      const conflict = (appts ?? []).some((a: any) => {
        const s = new Date(a.starts_at).getTime();
        const e = a.ends_at ? new Date(a.ends_at).getTime() : s + 30 * 60000;
        return s < slotEnd.getTime() && e > slotStart.getTime();
      });
      if (!conflict) slots.push(slotStart.toISOString());
    }
    return { slots };
  });

const phoneRegex = /^[\d\s()+-]{8,20}$/;

export const createPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      slug: slugSchema,
      serviceId: z.string().uuid(),
      barberId: z.string().uuid().optional().nullable(),
      startsAt: z.string().datetime(),
      customer: z.object({
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().regex(phoneRegex),
        email: z.string().trim().email().max(160).optional().nullable(),
      }),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.slug);
    const db = await admin();

    const { data: service } = await db.from("services").select("id, name, price, duration_minutes").eq("tenant_id", tenant.id).eq("id", data.serviceId).maybeSingle();
    if (!service) throw new Error("Serviço inválido");

    let barberName: string | null = null;
    if (data.barberId) {
      const { data: barber } = await db.from("barbers").select("id, name").eq("tenant_id", tenant.id).eq("id", data.barberId).maybeSingle();
      if (!barber) throw new Error("Barbeiro inválido");
      barberName = barber.name;
    }

    const starts = new Date(data.startsAt);
    const ends = new Date(starts.getTime() + Number(service.duration_minutes) * 60000);
    if (starts.getTime() < Date.now() + 15 * 60000) throw new Error("Escolha um horário futuro.");

    // Rate limit: máx 3 agendamentos do mesmo telefone na barbearia nas últimas 24h
    const phoneDigits = data.customer.phone.replace(/\D/g, "");
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: recent } = await db
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("customer_phone", phoneDigits)
      .gte("created_at", since);
    if ((recent ?? 0) >= 3) throw new Error("Limite de agendamentos atingido. Entre em contato com a barbearia.");

    // Conflito (mesmo barbeiro, intervalo sobreposto)
    if (data.barberId) {
      const { data: clash } = await db
        .from("appointments")
        .select("id, starts_at, ends_at")
        .eq("tenant_id", tenant.id)
        .eq("barber_id", data.barberId)
        .not("status", "in", "(cancelled,noshow)")
        .lt("starts_at", ends.toISOString())
        .gte("starts_at", new Date(starts.getTime() - 4 * 3600 * 1000).toISOString());
      const conflict = (clash ?? []).some((a: any) => {
        const s = new Date(a.starts_at).getTime();
        const e = a.ends_at ? new Date(a.ends_at).getTime() : s + 30 * 60000;
        return s < ends.getTime() && e > starts.getTime();
      });
      if (conflict) throw new Error("Esse horário acabou de ser preenchido. Escolha outro.");
    }

    // Upsert cliente por telefone dentro do tenant
    let clientId: string | null = null;
    const { data: existing } = await db.from("clients").select("id").eq("tenant_id", tenant.id).eq("phone", phoneDigits).maybeSingle();
    if (existing) {
      clientId = existing.id;
      await db.from("clients").update({ name: data.customer.name, whatsapp: phoneDigits, email: data.customer.email ?? null }).eq("id", clientId);
    } else {
      const { data: created, error: cErr } = await db
        .from("clients")
        .insert({ tenant_id: tenant.id, name: data.customer.name, phone: phoneDigits, whatsapp: phoneDigits, email: data.customer.email ?? null })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      clientId = created.id;
    }

    const { data: appt, error } = await db
      .from("appointments")
      .insert({
        tenant_id: tenant.id,
        client_id: clientId,
        customer_name: data.customer.name,
        customer_phone: phoneDigits,
        barber_id: data.barberId || null,
        barber_name: barberName,
        service_id: service.id,
        service_name: service.name,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        price: service.price,
        status: "scheduled",
        payment_method: "presencial",
      })
      .select("id, starts_at")
      .single();
    if (error) throw new Error(error.message);

    return { appointmentId: appt.id, startsAt: appt.starts_at, tenantName: tenant.name };
  });