
## Causa raiz identificada

Após uma investigação completa do banco, RLS, triggers e código de frontend, o problema **não é** falta de criação de perfil ou políticas RLS — todos estão corretos:

- Trigger `on_auth_user_created` em `auth.users` cria o perfil automaticamente.
- `getMyContext` já tem fallback para criar perfil se faltar.
- RLS em `services`, `barbers`, `tenants`, `tenant_members`, `profiles` está correta.
- RPC `create_tenant_with_owner` cria tenant + membership owner + atualiza `current_tenant_id` numa única transação SECURITY DEFINER.

**O bug real** está em `src/routes/onboarding.tsx`: após `createTenant` chamar `navigate({ to: "/app" })`, a query `["app","context"]` continua em cache com `currentTenant = null` (estado anterior à criação). Em `src/routes/app.tsx`, o `useEffect` vê `!data.currentTenant` e redireciona de volta para `/onboarding`. Resultado:

- Em contas novas com tenant recém-criado → loop / tela "Redirecionando para o onboarding…" travada.
- O usuário nunca chega a ver Serviços/Barbeiros/Agenda, porque a casca do `/app` nunca renderiza.

Bug secundário menor: `signup` mostra "Confirme seu e-mail" mas não há indicação clara do próximo passo se a confirmação por e-mail estiver desligada (o `onAuthStateChange` já redireciona, ok).

## Correções

### 1. `src/routes/onboarding.tsx`
- Após `createTenant` sucesso: invalidar `["app","context"]` no `queryClient` (via `useQueryClient`) **antes** do `navigate({ to: "/app" })`.
- Isso força o loader de `/app` a refazer `getMyContext`, agora com `currentTenant` populado.

### 2. `src/routes/app.tsx` (defesa em profundidade)
- Trocar o `useEffect` + tela "Redirecionando…" por `throw redirect({ to: "/onboarding" })` dentro do `loader`, quando `getMyContext` retornar `currentTenant === null`. Redireciona antes de renderizar — sem flash de tela e sem loop.
- Mantém `beforeLoad` checando sessão.

### 3. `src/routes/login.tsx` e `src/routes/signup.tsx`
- Sem mudança de lógica; o redirect para `/app` continua e o loader de `/app` agora decide corretamente entre dashboard e onboarding.

### 4. Verificação rápida pós-correção
- Criar conta nova → login → deve cair em `/onboarding`.
- Preencher e submeter → deve abrir `/app` com sidebar e dashboard, sem loop.
- Cadastrar serviço e barbeiro → deve salvar (RLS já valida).

## Arquivos alterados
- `src/routes/onboarding.tsx` — invalidar cache de contexto antes de navegar.
- `src/routes/app.tsx` — mover redirect para onboarding para dentro do `loader`.

Nenhuma migração SQL é necessária — backend e RLS já estão corretos.
