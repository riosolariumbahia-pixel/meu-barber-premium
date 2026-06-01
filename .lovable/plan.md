
# Plano — Barber360 Premium SaaS

## Auditoria do ZIP enviado

O projeto anexado é um app Vite + React 19 + Express (template AI Studio) com Gemini e Supabase. Pontos críticos encontrados:

- **Stack incompatível** com este projeto Lovable (TanStack Start + Vite 7 + Tailwind v4 + shadcn). Não dá para "colar" o ZIP por cima — precisa ser portado.
- **Segurança crítica:** isolamento multi-tenant é só por coluna `tenant_id` no client com chave `anon`. Sem RLS, qualquer usuário com a anon key lê dados de qualquer barbearia. Risco real de vazamento entre tenants.
- **Auth fraca:** `PortalLogin` é local/simulado, sem Supabase Auth real. Sessão guardada só no estado React.
- **Config sensível em localStorage:** `barber360_supabase_config` permite trocar URL/key pelo console — vetor de ataque.
- **Sem logs de auditoria, sem migrations, sem políticas, sem trigger de profile.**
- **Arquitetura monolítica:** `App.tsx` com 1000 linhas concentra navegação, estado e sync. Difícil escalar.
- **Sem PWA, sem tema claro/escuro real (apenas flag), sem mobile-first consistente.**
- **Dependências:** React 19.0.1, Vite 6, motion 12, `@google/genai` — todas viáveis, serão substituídas por equivalentes já presentes no template.

Decisão: **portar funcionalidades e UI** do ZIP para a stack Lovable, reescrevendo a camada de dados sobre Lovable Cloud (Supabase gerenciado) com RLS real desde o dia 1.

## Arquitetura alvo

- **Frontend:** TanStack Start + React 19 + Tailwind v4 + shadcn/ui (já no projeto), `motion/react`, `recharts`.
- **Backend:** Lovable Cloud (será habilitado). Toda escrita/leitura sensível via `createServerFn` com `requireSupabaseAuth`. Webhooks (WhatsApp/PIX) em `src/routes/api/public/*`.
- **Multi-tenant:**
  - Tabela `tenants` (barbearias) + `tenant_members(user_id, tenant_id, role)`.
  - Função `security definer` `current_tenant_id()` que lê o tenant ativo do usuário.
  - **RLS em TODAS as tabelas** com `tenant_id = current_tenant_id()`.
  - Roles em tabela separada `user_roles` (`owner`, `manager`, `barber`, `client`) — nunca no perfil.
- **Auditoria:** tabela `audit_logs` + trigger genérico que registra INSERT/UPDATE/DELETE por tenant e usuário.
- **PWA:** manifest only (instalável, sem service worker — evita problemas no preview Lovable).
- **Tema claro/escuro:** via `class="dark"` + tokens oklch em `src/styles.css`.

## Entregas em fases

Escopo total é enorme (15+ módulos). Proponho 5 fases entregáveis. Confirme a fase 1 e seguimos.

### Fase 1 — Fundação (esta entrega)
1. Habilitar Lovable Cloud.
2. Migrations: `tenants`, `tenant_members`, `user_roles`, `profiles`, `audit_logs` + função `has_role`, `current_tenant_id`, trigger de auditoria, trigger `handle_new_user`.
3. Auth real (email/senha + Google) com `_authenticated` layout, onboarding de barbearia (cria tenant + membership).
4. Design system Barber360: paleta premium (inspiração HubSpot/Stripe/Linear), tokens oklch claro/escuro, layout shell com sidebar shadcn responsiva, toggle de tema.
5. Roteamento TanStack para os módulos (placeholders prontos): `/dashboard`, `/agenda`, `/clientes`, `/barbeiros`, `/servicos`, `/financeiro`, `/fidelidade`, `/assinatura`, `/configuracoes`.
6. Manifest PWA + ícones + meta SEO em pt-BR.

### Fase 2 — Operação diária
- Módulo **Agenda** (dia/semana/mês, drag-to-reschedule, status: agendado/confirmado/em atendimento/finalizado/cancelado/no-show).
- Módulo **Clientes** (CRUD, histórico, gasto total, última visita, frequência).
- Módulo **Barbeiros** (CRUD, foto via upload, especialidade, horários, comissão).
- Módulo **Serviços** (CRUD, categorias, duração, preço, combos).

### Fase 3 — Financeiro
- Fluxo de caixa, receitas, despesas, lucro.
- Dashboard financeiro com gráficos (recharts).
- Indicadores: ticket médio, faturamento mensal, receita por barbeiro/serviço.
- Comissões automáticas (fixa/percentual), extrato, fechamento mensal.

### Fase 4 — Crescimento
- Fidelidade: cashback, pontos, clube VIP, regra "10 cortes = 1 grátis".
- Dashboard executivo com rankings.
- Assinaturas Starter/Pro/Premium (estrutura de plano + trial/ativo/suspenso, sem cobrança real ainda).

### Fase 5 — Integrações
- WhatsApp: server functions + webhook `/api/public/whatsapp` (preparado, sem provedor amarrado).
- PIX: arquitetura QR Code + Copia-e-Cola + pagamento antecipado (estrutura, integração real depende de PSP escolhido).
- IA (Lovable AI Gateway): geração de posts Instagram, mensagens WhatsApp, relatórios, sugestões de campanha.

## Detalhes técnicos relevantes

- **Não vou copiar o ZIP para `src/`.** Vou usar os componentes do ZIP como referência visual/funcional e reescrever em TanStack + shadcn.
- **Toda query passa por `createServerFn` com `requireSupabaseAuth`** — RLS aplica como usuário logado. Nada de `anon` key fazendo escrita do client.
- **`supabaseAdmin` só** em jobs administrativos (criar tenant no onboarding, webhooks verificados).
- **Auditoria** ativada via trigger SQL em todas as tabelas de domínio.
- **Sem service worker** (apenas manifest) — segue regra do template para evitar quebrar preview.

## Pergunta antes de implementar

A Fase 1 entrega fundação sólida (auth, multi-tenant com RLS, design system, shell navegável, placeholders dos módulos). As fases 2–5 viriam em mensagens seguintes para manter qualidade.

Confirma esse plano e a Fase 1 como primeira entrega? Ou prefere outra ordem de prioridade (ex.: Agenda + Clientes antes do design system completo)?
