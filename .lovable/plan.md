## Problema

No link público `/b/{slug}` os horários aparecem somente até 14h30 porque `getPublicAvailability` lê o campo `hours` do barbeiro selecionado (ex.: "09:00-14:30") e usa isso como limite. O padrão de 8–20 só vale quando não há barbeiro escolhido.

## Correção

Em `src/lib/public-booking.functions.ts`, dentro de `getPublicAvailability`:

- Remover a leitura de `barber.hours` e a chamada a `parseHours`.
- Fixar `hours = [9, 20]` para todos os casos (com ou sem barbeiro selecionado).
- Manter o resto da lógica (duração, passo de 30 min, conflitos, filtro de horários passados) intacta.

Isso garante que o cliente sempre veja slots de 9h às 20h, independentemente das `hours` cadastradas no barbeiro (que continuam servindo apenas para a agenda interna do SaaS).

Nenhum outro arquivo precisa mudar.