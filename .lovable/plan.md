Plano de correção crítica do SaaS de barbearia

Diagnóstico encontrado
- O link público carrega serviços e barbeiros, mas a disponibilidade ainda não considera bloqueios da barbearia (`appointment_blocks`).
- A agenda interna não possui assinatura em tempo real; ela depende de cache/refetch manual do React Query.
- As tabelas necessárias não estão publicadas no Realtime (`supabase_realtime` está vazio).
- Não há proteção forte no banco contra dois agendamentos sobrepostos para o mesmo barbeiro.
- A criação pública permite `barber_id` vazio; isso dificulta conflito por barbeiro e pode permitir ocupação incorreta do horário.
- A agenda interna está desenhada de 07:00 a 22:00, enquanto a regra solicitada é 09:00 a 20:00.
- Existe uma estrutura de bloqueio (`appointment_blocks`) que já cobre o papel de `blocked_slots`: `id`, barbearia/tenant, barbeiro, início, fim, motivo e criação. Não é necessário duplicar tabela; a correção é fazer o link público respeitar essa estrutura.

Implementação planejada

1. Banco de dados e regras de segurança
- Habilitar Realtime nas tabelas principais:
  - `appointments`
  - `appointment_blocks`
  - `barbers`
  - `services`
- Adicionar grants explícitos nas tabelas usadas pelo app para garantir acesso correto pelas funções autenticadas e pelo backend.
- Criar validação no banco para impedir agendamento fora de 09:00–20:00.
- Criar validação no banco para impedir início fora dos intervalos de 30 minutos.
- Criar proteção contra conflito de agendamento para o mesmo barbeiro no mesmo intervalo.
- Criar proteção contra agendamento em horário bloqueado.
- Ajustar a função de conflito existente para retornar a mensagem esperada quando houver ocupação:
  - `Este horário já foi reservado.`
- Criar uma tabela leve de eventos públicos de agenda, sem dados pessoais, para sinalizar mudanças em tempo real no link público com segurança. Ela terá apenas referência da barbearia, tipo de evento e data/hora do evento, sem nome, telefone ou serviço do cliente.

2. Agendamento público do cliente
- Manter horário público fixo em São Paulo/Brasil: 09:00 até 20:00.
- Gerar slots de 30 em 30 minutos.
- Para serviço de 30 minutos, permitir início até 19:30 para terminar às 20:00.
- Corrigir disponibilidade para considerar:
  - agendamentos existentes
  - bloqueios da barbearia
  - barbeiro selecionado
  - “sem preferência”, atribuindo automaticamente um barbeiro realmente livre antes de gravar
  - horários passados indisponíveis
- Na confirmação pública, revalidar tudo novamente antes de salvar:
  - serviço ativo
  - barbeiro ativo ou barbeiro livre automático
  - horário dentro de 09:00–20:00
  - sem conflito com agendamento existente
  - sem conflito com bloqueio
- Se o horário tiver sido ocupado entre a listagem e a confirmação, exibir:
  - `Este horário já foi reservado.`
- Após criar o agendamento, invalidar/refazer a consulta de disponibilidade.

3. Agenda interna da barbearia
- Padronizar a linha do tempo visual para 09:00–20:00.
- Ajustar criação e movimentação de agendamento interno para validar:
  - horário comercial
  - intervalo de 30 minutos
  - conflito com agendamento existente
  - conflito com bloqueio
- Ao criar, cancelar, excluir, remarcar ou alterar status, invalidar também KPIs, lembretes e disponibilidade relacionada.
- Corrigir bloqueios para refletirem imediatamente no link público.

4. Sincronização em tempo real
- Na agenda interna, adicionar assinatura Realtime para eventos de:
  - `appointments`
  - `appointment_blocks`
  - `barbers`
  - `services`
- Quando qualquer evento chegar, refazer a leitura real do banco via server functions, sem depender de estado local como fonte da verdade.
- No link público, assinar a tabela segura de eventos públicos por barbearia.
- Quando houver mudança de agendamento, bloqueio, serviço ou barbeiro, refazer:
  - dados públicos da barbearia
  - horários disponíveis
- Preservar cache apenas como mecanismo técnico de renderização, sempre com invalidação por evento e `staleTime` zero para refletir o banco.

5. Testes obrigatórios após implementação
- Teste 1: cliente agenda pelo link público.
  - Confirmar que salva no banco.
  - Confirmar que aparece na agenda interna sem refresh manual.
- Teste 2: barbearia cria agendamento.
  - Confirmar que o horário desaparece do link público.
- Teste 3: barbearia bloqueia horário.
  - Confirmar que o horário bloqueado não aparece para clientes.
- Teste 4: cliente tenta reservar horário já ocupado.
  - Confirmar que o sistema bloqueia e mostra `Este horário já foi reservado.`
- Teste 5: cancelamento/exclusão.
  - Confirmar que o horário volta a ficar disponível.
- Verificar console, rede, logs do backend e consultas do banco para garantir ausência de erros relacionados ao fluxo.

Arquivos e áreas que serão alterados
- `src/lib/public-booking.functions.ts`
- `src/lib/appointments.functions.ts`
- `src/lib/blocks.functions.ts`
- `src/routes/b.$slug.tsx`
- `src/routes/app.agenda.tsx`
- Migração do banco para Realtime, validações, eventos seguros e proteção contra duplicidade

Resultado esperado
- Agenda interna sincronizada em tempo real.
- Link público sincronizado em tempo real.
- Serviços e barbeiros carregando corretamente.
- Agendamento público funcionando de ponta a ponta.
- Horários públicos corretos: 09:00 até 20:00, de 30 em 30 minutos.
- Bloqueios respeitados no link público.
- Duplicidade impedida no frontend, backend e banco.
- Fluxo pronto para produção.