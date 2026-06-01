import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const onboardingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífen"),
  city: z.string().trim().min(2).max(80),
});

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => onboardingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Create tenant
    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .insert({
        name: data.name,
        slug: data.slug,
        city: data.city,
        subscription_plan: "starter",
        subscription_status: "trial",
      })
      .select()
      .single();
    if (tErr) throw new Error(tErr.message);

    // 2. Membership (owner)
    const { error: mErr } = await supabase
      .from("tenant_members")
      .insert({ tenant_id: tenant.id, user_id: userId, role: "owner" });
    if (mErr) throw new Error(mErr.message);

    // 3. Set as current tenant on profile
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ current_tenant_id: tenant.id })
      .eq("id", userId);
    if (pErr) throw new Error(pErr.message);

    return { tenant };
  });

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, current_tenant_id")
      .eq("id", userId)
      .maybeSingle();

    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("tenant_id, role, tenants ( id, name, slug, city, subscription_plan, subscription_status, trial_ends_at )")
      .eq("user_id", userId);

    const currentMembership = memberships?.find(
      (m) => m.tenant_id === profile?.current_tenant_id,
    ) ?? memberships?.[0];

    return {
      profile,
      memberships: memberships ?? [],
      currentTenant: (currentMembership as { tenants?: unknown } | undefined)?.tenants ?? null,
      currentRole: currentMembership?.role ?? null,
    };
  });