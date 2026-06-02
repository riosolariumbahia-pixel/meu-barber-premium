import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("current_tenant_id").eq("id", userId).maybeSingle();
  if (!data?.current_tenant_id) throw new Error("Tenant atual não encontrado");
  return data.current_tenant_id as string;
}

const SERVICE_CATEGORIES = ["corte", "barba", "sobrancelha", "pigmentacao", "combo", "outros"] as const;

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  category: z.enum(SERVICE_CATEGORIES),
  duration_minutes: z.number().int().min(5).max(480),
  price: z.number().min(0).max(100000),
  is_active: z.boolean().default(true),
});

export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("category")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => serviceSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const payload = {
      tenant_id: tenantId,
      name: data.name,
      category: data.category,
      duration_minutes: data.duration_minutes,
      price: data.price,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await supabase.from("services").update(payload).eq("id", data.id).eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase.from("services").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase.from("services").delete().eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });