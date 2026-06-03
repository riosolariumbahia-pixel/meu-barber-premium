## Diagnóstico

O erro `new row violates row-level security policy for table "tenants"` na verdade vem de `.insert(...).select().single()` em `createTenant` (`src/lib/tenant.functions.ts`). O INSERT passa (policy `auth.uid() IS NOT NULL`), mas o `RETURNING`/SELECT logo em seguida exige a policy `is_tenant_member(auth.uid(), id)` — e o usuário ainda não é membro nesse instante. O Supabase reporta isso como violação de RLS.

O segundo log (`Tenant atual não encontrado` em `getFinanceSummary`) é apenas consequência: como o tenant não foi criado, o dashboard chama `cashflow` sem `current_tenant_id`.

## Correção

Criar uma função SQL `public.create_tenant_with_owner(name, slug, city)` como `SECURITY DEFINER` que faz, atomicamente:
1. Insere em `tenants`
2. Insere `tenant_members` (role `owner`)
3. Atualiza `profiles.current_tenant_id`
4. Retorna o tenant

Isso elimina a janela onde o usuário tenta ler um tenant do qual ainda não é membro, e garante atomicidade (sem tenant órfão se uma etapa falhar).

### Mudanças

**Migração SQL** (nova):
- `CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(_name text, _slug text, _city text) RETURNS public.tenants` — SECURITY DEFINER, `search_path = public`, valida `auth.uid() IS NOT NULL`, garante profile existe (`INSERT ... ON CONFLICT DO NOTHING`), insere tenant, membership, atualiza profile, retorna a linha.
- `GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(text,text,text) TO authenticated;`

**`src/lib/tenant.functions.ts`**:
- Substituir os 3 inserts manuais em `createTenant` por uma única chamada `supabase.rpc("create_tenant_with_owner", { _name, _slug, _city })`.
- Manter validação Zod e mensagens de erro.

**Defesa adicional em `getFinanceSummary` / outros `getTenantId`**:
- Retornar payload vazio (`kpis` zerados, series vazia) quando o usuário ainda não tem `current_tenant_id`, ao invés de `throw`. Evita tela em branco durante o redirect para `/onboarding`.

### Fora de escopo
- Não mexer em RLS policies existentes (já estão corretas).
- Não tocar em outras server functions além do guard defensivo.
