import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { vipTierFromSpend } from "./format";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("current_tenant_id").eq("id", userId).maybeSingle();
  if (!data?.current_tenant_id) throw new Error("Tenant atual não encontrado");
  return data.current_tenant_id as string;
}

export const getLoyaltyRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);

    const [{ data: clients }, { data: tenant }, { data: appts }] = await Promise.all([
      supabase.from("clients").select("id, name, fidelity_points, cashback_balance, vip_tier").eq("tenant_id", tenantId),
      supabase.from("tenants").select("cashback_percent, points_per_real").eq("id", tenantId).single(),
      supabase.from("appointments").select("client_id, price").eq("tenant_id", tenantId).eq("status", "completed"),
    ]);

    const spend: Record<string, number> = {};
    for (const a of appts ?? []) {
      if (!a.client_id) continue;
      spend[a.client_id as string] = (spend[a.client_id as string] ?? 0) + Number(a.price ?? 0);
    }

    const rows = (clients ?? []).map((c) => ({
      ...c,
      total_spent: spend[c.id] ?? 0,
      tier: vipTierFromSpend(spend[c.id] ?? 0),
    })).sort((a, b) => b.total_spent - a.total_spent);

    return { rows, config: tenant };
  });

export const updateLoyaltyConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      cashback_percent: z.number().min(0).max(50),
      points_per_real: z.number().min(0).max(10),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase.from("tenants").update(data).eq("id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });