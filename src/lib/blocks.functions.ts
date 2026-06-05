import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("current_tenant_id").eq("id", userId).maybeSingle();
  if (!data?.current_tenant_id) throw new Error("Tenant atual não encontrado");
  return data.current_tenant_id as string;
}

const blockSchema = z.object({
  barber_id: z.string().uuid().optional().nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  reason: z.string().trim().max(200).optional().nullable(),
  block_type: z.enum(["busy", "lunch", "off", "holiday"]).default("busy"),
});

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ from: z.string(), to: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data: rows, error } = await supabase
      .from("appointment_blocks")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("starts_at", data.from)
      .lt("starts_at", data.to)
      .order("starts_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => blockSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase.from("appointment_blocks").insert({
      tenant_id: tenantId,
      barber_id: data.barber_id || null,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      reason: data.reason || null,
      block_type: data.block_type,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase.from("appointment_blocks").delete().eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const moveSchema = z.object({
  id: z.string().uuid(),
  starts_at: z.string(),
  ends_at: z.string().optional().nullable(),
});

export const moveAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => moveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);

    const { data: appt, error: fErr } = await supabase
      .from("appointments")
      .select("id, barber_id, ends_at, starts_at")
      .eq("id", data.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!appt) throw new Error("Agendamento não encontrado");

    const oldStart = new Date(appt.starts_at).getTime();
    const oldEnd = appt.ends_at ? new Date(appt.ends_at).getTime() : oldStart + 30 * 60000;
    const duration = oldEnd - oldStart;
    const newStart = new Date(data.starts_at);
    const newEnd = data.ends_at ? new Date(data.ends_at) : new Date(newStart.getTime() + duration);

    if (appt.barber_id) {
      const { data: conflict, error: cErr } = await supabase.rpc("check_appointment_conflict", {
        _tenant_id: tenantId,
        _barber_id: appt.barber_id,
        _starts_at: newStart.toISOString(),
        _ends_at: newEnd.toISOString(),
        _exclude_id: data.id,
      });
      if (cErr) throw new Error(cErr.message);
      if (conflict) throw new Error("Conflito: já existe um atendimento neste horário para o barbeiro");
    }

    const { error } = await supabase
      .from("appointments")
      .update({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() })
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });