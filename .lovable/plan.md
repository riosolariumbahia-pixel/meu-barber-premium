
# Plano — Fases 2 a 5 do Barber360 (entrega funcional hoje)

Objetivo: deixar o SaaS operacional hoje, com CRUDs reais, agenda funcional, financeiro com gráficos, fidelidade, planos e integrações preparadas (WhatsApp/PIX/IA). Tudo via `createServerFn` + RLS já existente. Sem mexer em auth, schema de tenants ou design system (já entregues na Fase 1).

## Escopo realista para "funcionar hoje"

Para caber em uma execução e ficar estável, faço um **MVP completo de cada módulo** — não a versão definitiva de cada item do briefing original. Drag-to-reschedule, push notifications, integração real com PSP/WhatsApp ficam como hooks/estrutura prontos, mas sem provedor amarrado (depende de credenciais do usuário).

## Fase 2 — Operação diária

**Server functions** (`src/lib/*.functions.ts`):
- `clients.functions.ts` — list/create/update/delete + busca por nome/telefone, agregados (total gasto, última visita, nº visitas).
- `barbers.functions.ts` — CRUD, ativar/desativar, comissão (fixa/percentual).
- `services.functions.ts` — CRUD por categoria, duração, preço, ativo.
- `appointments.functions.ts` — list por dia/semana, create, update (status + reagendar via inputs date), cancel.

**UI**:
- `/app/clientes` — tabela com busca, dialog de cadastro/edição, drawer com histórico.
- `/app/barbeiros` — grid de cards com avatar, dialog de cadastro.
- `/app/servicos` — tabela por categoria, dialog de cadastro.
- `/app/agenda` — visão **dia** (timeline por barbeiro) + visão **semana** (grid). Botão "Novo agendamento" → dialog com cliente (autocomplete), barbeiro, serviço (puxa preço/duração), data/hora. Mudança de status via dropdown (agendado/confirmado/em atendimento/finalizado/cancelado/no-show). Reagendamento via edição (drag-to-reschedule fica para v2 — exige libs pesadas).

## Fase 3 — Financeiro

- `cashflow.functions.ts` — list por período, create receita/despesa, agregados (receita, despesa, lucro, ticket médio, receita por barbeiro/serviço).
- Quando appointment vira `finalizado`, server function registra automaticamente uma entrada em `cash_flow` (receita) e calcula `commission_paid` conforme o barbeiro.
- `/app/financeiro` — KPIs no topo, gráfico de receita 30 dias (recharts), tabela de lançamentos, dialog para receita/despesa manual, fechamento mensal com comissões por barbeiro.
- `/app/index` (dashboard) — KPIs do dia/mês, próximos agendamentos, top barbeiros.

## Fase 4 — Crescimento

- `loyalty.functions.ts` — regras simples: 1 ponto a cada R$10 gastos + cashback configurável por tenant (campo já existe em `clients`). Mostra saldo e tier (bronze/silver/gold/platinum baseado em gasto acumulado).
- `/app/fidelidade` — ranking de clientes, configuração da regra, histórico de pontos.
- `/app/assinatura` — apresenta planos Starter/Pro/Premium, mostra `subscription_status` e `trial_ends_at` do tenant. **Sem cobrança real** (depende de Stripe/Paddle — ofereço habilitar depois).

## Fase 5 — Integrações (estrutura pronta, sem credenciais externas)

- **IA (Lovable AI Gateway, já tem `LOVABLE_API_KEY`)**:
  - `ai.functions.ts` com 4 ações: `generateInstagramPost`, `generateWhatsappMessage`, `generateMonthlyReport`, `suggestCampaign` usando `google/gemini-2.5-flash`.
  - UI: aba "IA" em `/app/configuracoes` + botões contextuais em Clientes ("Gerar mensagem WhatsApp") e Financeiro ("Relatório IA do mês").
- **WhatsApp**: server function `sendWhatsapp` que monta link `wa.me` com texto (modo "click-to-chat", funciona sem provedor). Webhook `/api/public/whatsapp` deixado preparado com verificação de assinatura HMAC para quando o usuário trouxer provedor.
- **PIX**: gerador de QR Code estático (BR Code / EMV) usando chave PIX do tenant — funciona 100% sem PSP, suficiente para receber pagamento antecipado. Cobrança dinâmica fica para integração futura.

## Migrações adicionais

Uma migration nova para suportar tudo acima:
- `tenants`: `pix_key`, `pix_key_type`, `whatsapp_number`, `instagram_handle`, `cashback_percent`, `points_per_real`.
- `clients`: índice em `(tenant_id, name)` e `(tenant_id, phone)`.
- `appointments`: índice em `(tenant_id, starts_at)`, `(tenant_id, barber_id, starts_at)`.
- `cash_flow`: índice em `(tenant_id, occurred_at)`.
- Trigger `appointments` → `cash_flow` quando status muda para `finalizado` (idempotente via `appointment_id` em `cash_flow.category`/coluna nova `source_id`).

## Estrutura técnica

```text
src/lib/
  clients.functions.ts
  barbers.functions.ts
  services.functions.ts
  appointments.functions.ts
  cashflow.functions.ts
  loyalty.functions.ts
  ai.functions.ts
  pix.ts                  (gerador BR Code, puro client)
  whatsapp.ts             (helpers wa.me + template)
src/routes/api/public/
  whatsapp.ts             (webhook preparado, HMAC)
src/components/
  agenda/                 (DayView, WeekView, AppointmentDialog)
  clients/                (ClientTable, ClientDialog, ClientHistoryDrawer)
  barbers/, services/, finance/, loyalty/, ai/
```

Todas as queries via `useSuspenseQuery` + `queryOptions`. Toda mutação via `useMutation` + `queryClient.invalidateQueries`. Loading states com Skeleton, erros com toast (sonner já existe).

## O que NÃO entra nesta entrega (e por quê)

- Drag-and-drop real na agenda (dnd-kit + lógica de colisão) — adiciona complexidade que arrisca a estabilidade do MVP.
- Cobrança recorrente real de assinatura — exige escolher Stripe ou Paddle e configurar produtos.
- Envio automático de WhatsApp (sem click) — exige conta UAZAPI/Twilio/Z-API com credenciais.
- App mobile / push notifications — PWA instalável já fica, push exige VAPID + service worker que o template evita.

Posso entregar essas três extensões em mensagens seguintes assim que o usuário trouxer credenciais/provedor.

## Confirmação

Confirma essa entrega das fases 2–5 em formato MVP (CRUDs + agenda + financeiro com gráficos + fidelidade + planos + IA + PIX QR + WhatsApp click-to-chat)? Ao aprovar, começo pela migração e depois implemento módulo a módulo.
