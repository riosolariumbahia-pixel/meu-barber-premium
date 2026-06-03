
# Plano — Booking público, lembrete 1h e atendimento avulso

## 1. Link público de agendamento (cliente se cadastra e marca sozinho)

**Rota pública nova:** `src/routes/b.$slug.tsx` (URL final: `https://meu-barber-premium.lovable.app/b/<slug-da-barbearia>`)
- SSR habilitado, `head()` com og:title/description da barbearia.
- Loader chama um server fn público `getPublicBooking({ slug })` que usa `supabaseAdmin` (dentro do handler) e retorna apenas dados seguros: `tenant { id, name, city, whatsapp_number, logo_color }`, lista de `services` ativos (id, name, price, duration_minutes, category) e `barbers` ativos (id, name, specialty, avatar_url). Nenhum PII de outros clientes.
- UI: cabeçalho da barbearia → escolha do serviço → barbeiro (ou "Sem preferência") → data/hora (slots de 30 min derivados de `barber.hours`, excluindo conflitos com `appointments` já existentes naquele dia) → formulário do cliente (nome, telefone WhatsApp, e-mail opcional) → confirmação.

**Server fns públicos** (sem `requireSupabaseAuth`, usam `supabaseAdmin` server-side dentro do `.handler()`):
- `getPublicBooking({ slug })` — dados da barbearia/serviços/barbeiros.
- `getPublicAvailability({ slug, barberId?, serviceId, date })` — devolve slots livres do dia.
- `createPublicBooking({ slug, serviceId, barberId?, customer: {name, phone, email?}, startsAt })`:
  - Valida com Zod (telefone BR, tamanhos, regex).
  - Faz upsert em `clients` por (`tenant_id`, `phone`) — cria cliente se não existir.
  - Insere em `appointments` com `status='scheduled'`, calcula `ends_at` pela `duration_minutes`, copia `price`, `service_name`, `barber_name`.
  - Re-checa conflito (mesmo barbeiro, intervalo sobreposto) antes de inserir, retorna 409 amigável.
  - Retorna `{ appointmentId, startsAt }` para tela de sucesso ("Agendamento confirmado").

**Rate limiting simples** por IP/telefone no `createPublicBooking` (tabela leve `public_booking_attempts` ou contagem por janela em `appointments` do mesmo telefone nas últimas N minutos) para evitar abuso.

**Link compartilhável:** botão "Copiar link público" em `app.configuracoes.tsx` e no header da Agenda → `navigator.clipboard.writeText(\`${origin}/b/${tenant.slug}\`)`.

## 2. Lembrete WhatsApp 1h antes

**Como:** `pg_cron` chamando endpoint público a cada 5 min.
- Rota: `src/routes/api.public.cron.reminders.ts` (POST). Autentica por header `apikey` = anon key (padrão da plataforma).
- Lógica: busca `appointments` com `status in ('scheduled','confirmed')`, `reminder_sent_at IS NULL`, e `starts_at` entre `now()+55min` e `now()+65min`. Para cada um:
  - Monta link `wa.me` via template já existente em `src/lib/whatsapp.ts` (`reminderTemplate`).
  - Se o tenant tiver provedor WhatsApp configurado (futuro): dispara API. **Por ora** (sem provedor pago): grava o link em `appointment_reminders` (nova tabela: id, tenant_id, appointment_id, channel, wa_link, status='ready', created_at) e marca `appointments.reminder_sent_at = now()`.
  - A tela `app.agenda.tsx` mostra um badge "🔔 Lembrete pronto" com botão "Abrir WhatsApp" usando o link salvo, para envio em 1 clique pela barbearia (mantém o fluxo já existente, agora destacado e contabilizado).
- Migração: adicionar coluna `appointments.reminder_sent_at timestamptz` e criar tabela `appointment_reminders` com RLS por tenant. Agendar `cron.schedule('appt-reminders-1h', '*/5 * * * *', ...)`.

> Observação ao usuário: envio 100% automatizado de WhatsApp exige um provedor (Twilio/Z-API/UAZAPI). Esta entrega deixa tudo pronto (job, link gerado, status) — basta plugar o provedor depois sem mudar UI.

## 3. Botão "Atendimento avulso" (walk-in) na Agenda

**Onde:** novo botão `+ Atendimento avulso` ao lado do `+ Novo` em `app.agenda.tsx`.
**Diálogo enxuto:** Serviço (auto-preenche preço/duração), Barbeiro, Cliente (autocomplete em `clients` + opção "novo"), Forma de pagamento (`dinheiro|pix|débito|crédito`).
**Server fn nova** `createWalkIn` em `appointments.functions.ts`:
- `starts_at = now()`, `ends_at = now() + duration`, `status='completed'`, `payment_method` escolhido.
- O trigger SQL existente `on_appointment_completed` já cria automaticamente o lançamento em `cash_flow` e calcula comissão → garante que o **relatório de faturamento do dia já inclui esses atendimentos**.

## 4. Relatório diário de faturamento (já viável após item 3)

O dashboard `app.financeiro.tsx` e `getFinanceSummary` já agregam `cash_flow`. Adicionar:
- Card "Faturamento de hoje" com breakdown por método de pagamento e por barbeiro.
- Botão "Fechamento do dia" → gera PDF/print simples (window.print com layout próprio) listando: agendados, walk-ins, total bruto, comissões, líquido. Sem dependência nova.

## Detalhes técnicos

```text
Arquivos novos
  src/routes/b.$slug.tsx                          # landing pública da barbearia
  src/routes/b.$slug.sucesso.tsx                  # tela de confirmação
  src/lib/public-booking.functions.ts             # server fns públicos (sem auth)
  src/routes/api.public.cron.reminders.ts         # cron 1h
  supabase/migrations/<ts>_booking_reminders.sql  # colunas + tabela + cron + RLS

Arquivos editados
  src/lib/appointments.functions.ts               # + createWalkIn
  src/routes/app.agenda.tsx                       # botão walk-in + badge lembrete + copiar link
  src/routes/app.configuracoes.tsx                # bloco "Link público de agendamento"
  src/routes/app.financeiro.tsx                   # card "Hoje" + Fechamento do dia
```

**Segurança / multi-tenant**
- Server fns públicos resolvem o `tenant_id` pelo `slug` server-side; cliente nunca envia `tenant_id`.
- `supabaseAdmin` usado apenas dentro dos handlers (`await import` no topo do handler) — nunca no client.
- Tudo continua respeitando o isolamento: writes só acontecem em registros do tenant resolvido pelo slug.
- Zod valida todos os inputs (nome 2–120, telefone regex BR, datas ISO, IDs uuid).
- Rate-limit no `createPublicBooking`.

**Sem regressões**
- Não altera RLS das tabelas existentes (apenas adiciona coluna + nova tabela).
- Fluxos atuais (agenda autenticada, financeiro, fidelidade) seguem iguais; trigger de `completed` já existente é reaproveitado para walk-ins.

Pronto para implementar quando aprovar.
