import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("current_tenant_id").eq("id", userId).maybeSingle();
  if (!data?.current_tenant_id) throw new Error("Tenant atual não encontrado");
  return data.current_tenant_id as string;
}

const barberSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  specialty: z.string().trim().max(120).optional().nullable(),
  role: z.string().trim().max(60).optional().nullable(),
  avatar_url: z.string().trim().url().max(500).optional().nullable().or(z.literal("")),
  commission_type: z.enum(["percent", "fixed"]),
  commission_value: z.number().min(0).max(100000),
  hours: z.string().trim().max(60).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const listBarbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertBarber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => barberSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const payload = {
      tenant_id: tenantId,
      name: data.name,
      specialty: data.specialty || null,
      role: data.role || null,
      avatar_url: data.avatar_url || null,
      commission_type: data.commission_type,
      commission_value: data.commission_value,
      hours: data.hours || "09:00-20:00",
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await supabase.from("barbers").update(payload).eq("id", data.id).eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase.from("barbers").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteBarber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase.from("barbers").delete().eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });