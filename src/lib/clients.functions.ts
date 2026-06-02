import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("current_tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.current_tenant_id) throw new Error("Tenant atual não encontrado");
  return data.current_tenant_id as string;
}

const clientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional().nullable(),
  whatsapp: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  birth_date: z.string().trim().optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name");
    if (error) throw new Error(error.message);

    // aggregate spend per client from cash_flow + appointments completed
    const ids = (data ?? []).map((c) => c.id);
    let agg: Record<string, { total: number; last: string | null; visits: number }> = {};
    if (ids.length) {
      const { data: appts } = await supabase
        .from("appointments")
        .select("client_id, price, starts_at, status")
        .eq("tenant_id", tenantId)
        .in("client_id", ids)
        .eq("status", "completed");
      for (const a of appts ?? []) {
        const cid = a.client_id as string;
        if (!cid) continue;
        const cur = agg[cid] ?? { total: 0, last: null, visits: 0 };
        cur.total += Number(a.price ?? 0);
        cur.visits += 1;
        if (!cur.last || (a.starts_at && a.starts_at > cur.last)) cur.last = a.starts_at as string;
        agg[cid] = cur;
      }
    }
    return (data ?? []).map((c) => ({
      ...c,
      _total_spent: agg[c.id]?.total ?? 0,
      _last_visit: agg[c.id]?.last ?? null,
      _visits: agg[c.id]?.visits ?? 0,
    }));
  });

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => clientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const payload = {
      tenant_id: tenantId,
      name: data.name,
      phone: data.phone || null,
      whatsapp: data.whatsapp || data.phone || null,
      email: data.email || null,
      birth_date: data.birth_date || null,
      notes: data.notes || null,
    };
    if (data.id) {
      const { error } = await supabase.from("clients").update(payload).eq("id", data.id).eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase.from("clients").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase.from("clients").delete().eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClientHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, starts_at, service_name, barber_name, price, status")
      .eq("tenant_id", tenantId)
      .eq("client_id", data.clientId)
      .order("starts_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return appts ?? [];
  });