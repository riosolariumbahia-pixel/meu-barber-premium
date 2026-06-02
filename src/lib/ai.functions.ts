import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callAI(messages: { role: string; content: string }[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente. Habilite Lovable AI em Configurações.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (res.status === 429) throw new Error("Limite de uso de IA atingido. Tente em instantes.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Lovable AI.");
  if (!res.ok) throw new Error(`IA falhou (${res.status})`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export const generateInstagramPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      topic: z.string().trim().min(2).max(200),
      tone: z.enum(["descontraido", "elegante", "promocional"]).default("descontraido"),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const text = await callAI([
      { role: "system", content: "Você é um social media de barbearia premium. Escreva em PT-BR, com emojis sutis e CTA claro. Máximo 300 caracteres + 5 a 7 hashtags relevantes." },
      { role: "user", content: `Tema: ${data.topic}. Tom: ${data.tone}. Estruture: legenda curta + linha em branco + hashtags.` },
    ]);
    return { content: text };
  });

export const generateWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      kind: z.enum(["lembrete", "promocao", "aniversario", "reativacao"]),
      clientName: z.string().trim().max(120).optional(),
      context: z.string().trim().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const text = await callAI([
      { role: "system", content: "Você escreve mensagens de WhatsApp curtas, calorosas e profissionais para clientes de barbearia. PT-BR, 1 a 3 frases, 1 emoji no máximo." },
      { role: "user", content: `Tipo: ${data.kind}. Cliente: ${data.clientName ?? "cliente"}. Contexto: ${data.context ?? "geral"}.` },
    ]);
    return { content: text };
  });

export const generateMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      revenue: z.number(),
      expense: z.number(),
      ticket: z.number(),
      topBarber: z.string().optional(),
      topService: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const text = await callAI([
      { role: "system", content: "Você é um analista de barbearia. Escreva um relatório curto e acionável em PT-BR, 4 a 6 bullets, com 1 sugestão clara de próxima ação no final." },
      { role: "user", content: `Mês fechou com receita R$${data.revenue.toFixed(2)}, despesas R$${data.expense.toFixed(2)}, ticket médio R$${data.ticket.toFixed(2)}. Top barbeiro: ${data.topBarber ?? "—"}. Serviço mais vendido: ${data.topService ?? "—"}.` },
    ]);
    return { content: text };
  });

export const suggestCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ goal: z.string().trim().min(2).max(200) }).parse(i))
  .handler(async ({ data }) => {
    const text = await callAI([
      { role: "system", content: "Você é um marketeiro de barbearia. Sugira 3 campanhas práticas e mensuráveis em PT-BR, cada uma com: título, mecânica, canal sugerido (Instagram/WhatsApp) e KPI principal." },
      { role: "user", content: `Objetivo: ${data.goal}` },
    ]);
    return { content: text };
  });