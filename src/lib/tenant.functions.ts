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
    const { supabase } = context;
    const { data: tenant, error } = await supabase.rpc("create_tenant_with_owner", {
      _name: data.name,
      _slug: data.slug,
      _city: data.city,
    });
    if (error) throw new Error(error.message);
    return { tenant };
  });

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, current_tenant_id")
      .eq("id", userId)
      .maybeSingle();

    // CRÍTICO: Auto-criar perfil se não existir (novo usuário após signup)
    if (!profile) {
      const { error: createErr } = await supabase.from("profiles").insert({
        id: userId,
      });
      if (createErr) throw new Error(`Erro ao criar perfil automaticamente: ${createErr.message}`);

      // Retornar perfil vazio para redirecionar ao onboarding
      return {
        profile: { id: userId, full_name: null, avatar_url: null, current_tenant_id: null },
        memberships: [],
        currentTenant: null,
        currentRole: null,
      };
    }

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
