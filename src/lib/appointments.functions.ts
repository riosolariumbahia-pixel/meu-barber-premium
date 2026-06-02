import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("current_tenant_id").eq("id", userId).maybeSingle();
  if (!data?.current_tenant_id) throw new Error("Tenant atual não encontrado");
  return data.current_tenant_id as string;
}

const APPT_STATUS = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"] as const;

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