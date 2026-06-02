import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("current_tenant_id").eq("id", userId).maybeSingle();
  if (!data?.current_tenant_id) throw new Error("Tenant atual não encontrado");
  return data.current_tenant_id as string;
}

const tenantSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120).optional().nullable(),
  whatsapp_number: z.string().trim().max(20).optional().nullable(),
  instagram_handle: z.string().trim().max(60).optional().nullable(),
  pix_key: z.string().trim().max(160).optional().nullable(),
  pix_key_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]).optional().nullable(),
});

export const getTenantSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateTenantSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tenantSettingsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase.from("tenants").update(data).eq("id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });