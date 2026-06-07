Plano de correção:

1. Ajustar a geração dos horários no link público de agendamento para criar os slots no fuso horário de São Paulo/Brasil, não em UTC.
2. Manter o intervalo público fixo de 09:00 até 20:00, com opções a cada 30 minutos.
3. Garantir que o último horário disponível respeite a duração do serviço — por exemplo, serviço de 30 minutos pode começar até 19:30 para terminar às 20:00.
4. Preservar as regras atuais de conflito com agendamentos existentes e bloqueio de horários passados.
5. Validar no link `/b/barbershop` que os horários exibidos para o cliente começam em 09:00 e vão até o limite correto antes de concluir.

Detalhe técnico: o bug acontece porque o código usa `new Date(`${date}T00:00:00`)`, que no servidor é interpretado em UTC. Ao chegar no navegador no horário do Brasil, aparece 3 horas antes: 09:00 vira 06:00 e 19:30 vira 16:30. A correção será montar as datas dos slots com offset `-03:00` para o horário público brasileiro.