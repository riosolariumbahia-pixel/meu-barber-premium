import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // pg_cron envia apikey = anon key (padrão da plataforma). Aceita também ?apikey=
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") || new URL(request.url).searchParams.get("apikey");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();
        const winStart = new Date(now.getTime() + 55 * 60 * 1000).toISOString();
        const winEnd = new Date(now.getTime() + 65 * 60 * 1000).toISOString();

        const { data: appts, error } = await supabaseAdmin
          .from("appointments")
          .select("id, tenant_id, customer_name, customer_phone, service_name, starts_at, status, reminder_sent_at")
          .is("reminder_sent_at", null)
          .in("status", ["scheduled", "confirmed"])
          .gte("starts_at", winStart)
          .lte("starts_at", winEnd)
          .limit(200);
        if (error) return new Response(error.message, { status: 500 });

        const tenantIds = Array.from(new Set((appts ?? []).map((a) => a.tenant_id)));
        const tenantsMap = new Map<string, string>();
        if (tenantIds.length) {
          const { data: tenants } = await supabaseAdmin.from("tenants").select("id, name").in("id", tenantIds);
          (tenants ?? []).forEach((t: any) => tenantsMap.set(t.id, t.name));
        }

        let processed = 0;
        for (const a of appts ?? []) {
          if (!a.customer_phone) {
            await supabaseAdmin.from("appointments").update({ reminder_sent_at: now.toISOString() }).eq("id", a.id);
            continue;
          }
          const tenantName = tenantsMap.get(a.tenant_id) ?? "Barbearia";
          const d = new Date(a.starts_at as string);
          const date = d.toLocaleDateString("pt-BR");
          const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const msg = `Olá, ${a.customer_name}! 👋\nLembrete do seu horário na ${tenantName}: ${a.service_name} em ${date} às ${time}.\nQualquer coisa, é só responder por aqui.`;
          const digits = String(a.customer_phone).replace(/\D/g, "");
          const num = digits.startsWith("55") ? digits : `55${digits}`;
          const link = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;

          await supabaseAdmin.from("appointment_reminders").insert({
            tenant_id: a.tenant_id,
            appointment_id: a.id,
            channel: "whatsapp",
            wa_link: link,
            status: "ready",
          });
          await supabaseAdmin.from("appointments").update({ reminder_sent_at: now.toISOString() }).eq("id", a.id);
          processed++;
        }

        return Response.json({ ok: true, processed, scanned: appts?.length ?? 0 });
      },
    },
  },
});