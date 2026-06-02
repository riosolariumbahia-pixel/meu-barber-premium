import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
        const body = await request.text();
        if (secret) {
          const sig = request.headers.get("x-webhook-signature") ?? "";
          const expected = createHmac("sha256", secret).update(body).digest("hex");
          try {
            if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
              return new Response("Invalid signature", { status: 401 });
            }
          } catch {
            return new Response("Invalid signature", { status: 401 });
          }
        }
        let payload: unknown;
        try { payload = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }
        // Stored for later processing once a provider is wired
        await supabaseAdmin.from("audit_logs").insert({
          action: "WHATSAPP_WEBHOOK",
          table_name: "external",
          new_data: payload as any,
        });
        return new Response("ok");
      },
    },
  },
});