import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("current_tenant_id").eq("id", userId).maybeSingle();
  if (!data?.current_tenant_id) throw new Error("Tenant atual não encontrado");
  return data.current_tenant_id as string;
}

const APPT_STATUS = ["scheduled", "confirmed", "serving", "completed", "cancelled", "noshow"] as const;

const createSchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().trim().min(2).max(120),
  customer_phone: z.string().trim().max(20).optional().nullable(),
  barber_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  service_name: z.string().trim().min(2).max(120),
  barber_name: z.string().trim().max(120).optional().nullable(),
  starts_at: z.string(),
  ends_at: z.string().optional().nullable(),
  price: z.number().min(0).max(100000),
  notes: z.string().trim().max(1000).optional().nullable(),
  payment_method: z.string().trim().max(40).default("presencial"),
});

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() });

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ from: z.string(), to: z.string() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data: rows, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("starts_at", data.from)
      .lt("starts_at", data.to)
      .order("starts_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    if (data.barber_id) {
      const endsArg = data.ends_at ?? new Date(new Date(data.starts_at).getTime() + 30 * 60000).toISOString();
      const { data: conflict, error: cErr } = await supabase.rpc("check_appointment_conflict", {
        _tenant_id: tenantId,
        _barber_id: data.barber_id,
        _starts_at: data.starts_at,
        _ends_at: endsArg,
        _exclude_id: "00000000-0000-0000-0000-000000000000",
      });
      if (cErr) throw new Error(cErr.message);
      if (conflict) throw new Error("Este horário já foi reservado.");
    }
    const payload = {
      tenant_id: tenantId,
      client_id: data.client_id || null,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone || null,
      barber_id: data.barber_id || null,
      barber_name: data.barber_name || null,
      service_id: data.service_id || null,
      service_name: data.service_name,
      starts_at: data.starts_at,
      ends_at: data.ends_at || null,
      price: data.price,
      notes: data.notes || null,
      payment_method: data.payment_method,
      status: "scheduled" as const,
    };
    const { data: created, error } = await supabase.from("appointments").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const updateAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { id, ...rest } = data;
    const { error } = await supabase
      .from("appointments")
      .update(rest)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { id };
  });

export const setAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), status: z.enum(APPT_STATUS) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase.from("appointments").delete().eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const walkInSchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().trim().min(2).max(120),
  customer_phone: z.string().trim().max(20).optional().nullable(),
  barber_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid(),
  payment_method: z.enum(["dinheiro", "pix", "debito", "credito", "presencial"]).default("dinheiro"),
  price_override: z.number().min(0).max(100000).optional(),
});

export const createWalkIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => walkInSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);

    const { data: service, error: sErr } = await supabase
      .from("services").select("id, name, price, duration_minutes")
      .eq("tenant_id", tenantId).eq("id", data.service_id).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!service) throw new Error("Serviço inválido");

    let barberName: string | null = null;
    if (data.barber_id) {
      const { data: b } = await supabase.from("barbers").select("name").eq("tenant_id", tenantId).eq("id", data.barber_id).maybeSingle();
      barberName = b?.name ?? null;
    }

    const starts = new Date();
    const ends = new Date(starts.getTime() + Number(service.duration_minutes) * 60000);
    const price = data.price_override ?? Number(service.price);

    const { data: created, error } = await supabase
      .from("appointments")
      .insert({
        tenant_id: tenantId,
        client_id: data.client_id || null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || null,
        barber_id: data.barber_id || null,
        barber_name: barberName,
        service_id: service.id,
        service_name: service.name,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        price,
        status: "completed",
        payment_method: data.payment_method,
        reminder_sent_at: starts.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const listPendingReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data } = await supabase
      .from("appointment_reminders")
      .select("id, appointment_id, wa_link, status, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const markReminderSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase
      .from("appointment_reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAgendaKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ day: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data: kpis, error } = await supabase.rpc("agenda_kpis_for_tenant", {
      _tenant_id: tenantId,
      _day: data.day,
    });
    if (error) throw new Error(error.message);
    return kpis as any;
  });

export const listMonthCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ from: z.string(), to: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data: rows, error } = await supabase
      .from("appointments")
      .select("starts_at, status, price")
      .eq("tenant_id", tenantId)
      .gte("starts_at", data.from)
      .lt("starts_at", data.to);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });