## Diagnóstico

O problema principal não é que as contas antigas funcionem e as novas estejam “sem permissão”. A arquitetura atual já tem tabelas e regras para isolamento por barbearia, mas o fluxo de nova conta ainda depende de um onboarding manual e pode travar por três causas:

1. A rota protegida `/app` roda cedo demais e pode tentar carregar o contexto antes da sessão estar totalmente pronta.
2. Se o usuário ainda não tem barbearia, o sistema redireciona para onboarding em vez de auto-recuperar/criar a estrutura.
3. Há falhas reais no banco por `slug` duplicado ao criar barbearia, fazendo o usuário ficar preso sem tenant atual.

Observação importante: neste projeto a tabela real de barbearias é `tenants`; clientes são `clients`; assinatura/trial ficam em `tenants`. Portanto a correção deve usar a estrutura existente, sem criar tabelas duplicadas como `barbershops`, `customers`, `settings` ou `subscriptions` quando elas não fazem parte deste schema.

## Plano de correção

### 1. Tornar o contexto do usuário auto-recuperável

- Ajustar a função de contexto do usuário para sempre garantir que exista:
  - perfil do usuário;
  - barbearia atual;
  - vínculo do usuário como `owner`;
  - plano inicial/trial;
  - dados mínimos para o dashboard carregar.
- Se o usuário já tiver vínculo com uma barbearia, mas `current_tenant_id` estiver vazio, corrigir automaticamente.
- Se o usuário não tiver nenhuma barbearia, criar uma automaticamente com nome padrão baseado no nome/e-mail do usuário.

### 2. Corrigir criação de barbearia com slug único

- Atualizar a função de criação no banco para gerar `slug` único automaticamente.
- Em caso de slug já existente, anexar sufixo incremental/aleatório seguro em vez de falhar.
- Manter tudo em uma transação: criar barbearia, criar vínculo owner e atualizar perfil juntos.

### 3. Corrigir rota protegida e loops de autenticação

- Ajustar `/app` para ser carregada somente no cliente autenticado, evitando sessão vazia durante restauração.
- Remover comportamento que deixa a tela em branco ou em carregamento infinito.
- Em vez de redirecionar eternamente para onboarding, `/app` deve chamar o contexto auto-recuperável e abrir o dashboard quando a estrutura for criada.
- Manter `/onboarding` como tela opcional de edição/configuração inicial, não como bloqueio obrigatório que prende contas novas.

### 4. Corrigir cache e eventos de autenticação

- Filtrar eventos de autenticação no listener global para evitar invalidações infinitas em `INITIAL_SESSION` e `TOKEN_REFRESHED`.
- Ao entrar, invalidar apenas o necessário para buscar o contexto atualizado.
- Ao sair, limpar cache protegido antes de navegar para login, evitando dados antigos ou 401 em cascata.

### 5. Padronizar dados iniciais da nova barbearia

- Garantir que a barbearia criada automaticamente inicie com:
  - plano/trial ativo;
  - status ativo;
  - horário operacional padrão 09:00–20:00;
  - intervalo de 30 minutos no fluxo de agenda/agendamento público;
  - defaults coerentes para novos barbeiros.
- Corrigir defaults ainda antigos de barbeiro `09:00-18:00` para `09:00-20:00`.

### 6. Validar acesso aos módulos principais

- Revisar as server functions de:
  - serviços;
  - barbeiros;
  - clientes;
  - agenda/agendamentos;
  - financeiro/dashboard;
  - configurações.
- Onde hoje elas falham com “Tenant atual não encontrado”, passar a depender do contexto auto-recuperável ou retornar mensagem clara quando houver erro real.

### 7. Melhorar tratamento de erro

- Adicionar logs claros no backend para falhas de:
  - criação de perfil;
  - criação/recuperação de barbearia;
  - geração de slug;
  - carregamento de contexto;
  - carregamento do dashboard.
- Exibir mensagens amigáveis na interface, sem tela branca.

### 8. Validação obrigatória após implementação

Após aplicar a correção, validar:

1. Criar nova conta e confirmar que o dashboard abre.
2. Sair e entrar novamente na mesma conta.
3. Cadastrar serviço.
4. Cadastrar barbeiro.
5. Criar agendamento interno.
6. Abrir o link público de agendamento.
7. Confirmar que os horários seguem 09:00–20:00 com intervalos de 30 minutos.
8. Verificar logs de console e banco para confirmar que não há erro novo.

## Resultado esperado

- Nova conta entra no dashboard sem intervenção manual.
- Barbearia é criada automaticamente quando faltar.
- Perfil e vínculo owner ficam consistentes.
- Slug duplicado não trava mais o cadastro.
- Serviços, barbeiros, clientes, agenda e link público funcionam para contas novas.
- Sem tela branca, sem loop de login/onboarding e sem loading infinito.

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>