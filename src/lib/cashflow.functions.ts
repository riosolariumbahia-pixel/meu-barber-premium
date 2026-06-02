import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("current_tenant_id").eq("id", userId).maybeSingle();
  if (!data?.current_tenant_id) throw new Error("Tenant atual não encontrado");
  return data.current_tenant_id as string;
}

const entrySchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["income", "expense"]),
  amount: z.number().min(0.01).max(1000000),
  description: z.string().trim().min(2).max(200),
  category: z.string().trim().max(60).optional().nullable(),
  occurred_at: z.string().optional(),
});

export const listCashFlow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ from: z.string(), to: z.string() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { data: rows, error } = await supabase
      .from("cash_flow")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("occurred_at", data.from)
      .lt("occurred_at", data.to)
      .order("occurred_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertCashFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => entrySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const payload = {
      tenant_id: tenantId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      category: data.category || null,
      occurred_at: data.occurred_at || new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabase.from("cash_flow").update(payload).eq("id", data.id).eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase.from("cash_flow").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteCashFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);
    const { error } = await supabase.from("cash_flow").delete().eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFinanceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const tenantId = await getTenantId(supabase, userId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: flows }, { data: appts }, { data: barbers }] = await Promise.all([
      supabase.from("cash_flow").select("type, amount, occurred_at").eq("tenant_id", tenantId).gte("occurred_at", last30),
      supabase.from("appointments").select("price, status, starts_at, barber_id, barber_name, service_name, commission_paid").eq("tenant_id", tenantId).gte("starts_at", monthStart),
      supabase.from("barbers").select("id, name").eq("tenant_id", tenantId),
    ]);

    let income = 0, expense = 0;
    const daily: Record<string, { income: number; expense: number }> = {};
    for (const f of flows ?? []) {
      const day = (f.occurred_at as string).slice(0, 10);
      const cur = daily[day] ?? { income: 0, expense: 0 };
      if (f.type === "income") { income += Number(f.amount); cur.income += Number(f.amount); }
      else { expense += Number(f.amount); cur.expense += Number(f.amount); }
      daily[day] = cur;
    }

    const completed = (appts ?? []).filter((a) => a.status === "completed");
    const monthRevenue = completed.reduce((s, a) => s + Number(a.price ?? 0), 0);
    const todayAppts = (appts ?? []).filter((a) => (a.starts_at as string) >= dayStart);
    const ticket = completed.length ? monthRevenue / completed.length : 0;

    const byBarber: Record<string, { id: string; name: string; revenue: number; commission: number; count: number }> = {};
    for (const a of completed) {
      const id = (a.barber_id as string) ?? "_";
      const name = (a.barber_name as string) ?? "Sem barbeiro";
      const cur = byBarber[id] ?? { id, name, revenue: 0, commission: 0, count: 0 };
      cur.revenue += Number(a.price ?? 0);
      cur.commission += Number(a.commission_paid ?? 0);
      cur.count += 1;
      byBarber[id] = cur;
    }

    const byService: Record<string, { name: string; revenue: number; count: number }> = {};
    for (const a of completed) {
      const name = (a.service_name as string) ?? "Serviço";
      const cur = byService[name] ?? { name, revenue: 0, count: 0 };
      cur.revenue += Number(a.price ?? 0);
      cur.count += 1;
      byService[name] = cur;
    }

    const days: { date: string; income: number; expense: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, income: daily[key]?.income ?? 0, expense: daily[key]?.expense ?? 0 });
    }

    return {
      kpis: {
        income30: income,
        expense30: expense,
        profit30: income - expense,
        monthRevenue,
        ticket,
        todayCount: todayAppts.length,
        completedCount: completed.length,
      },
      series: days,
      byBarber: Object.values(byBarber).sort((a, b) => b.revenue - a.revenue),
      byService: Object.values(byService).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      barbers: barbers ?? [],
    };
  });