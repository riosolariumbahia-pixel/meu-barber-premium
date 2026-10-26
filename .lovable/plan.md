# Corrigir login com Google ("failed to check consent required")

## O que acontece
O botão "Continuar com Google" envia o retorno do login para a página interna do painel (`/app`), que é protegida. O serviço de login do Google recusa esse endereço de retorno e mostra "failed to check consent required". O login por e-mail e senha não é afetado.

## Correção
1. Reativar a configuração de login com Google no Lovable Cloud (reaplica as credenciais gerenciadas e atualiza o módulo de login).
2. Nas telas Entrar e Criar conta, mandar o retorno do Google para o endereço principal do site (`window.location.origin`) em vez de `/app`.
3. Depois que a sessão existir, as telas Entrar/Criar conta e a página inicial já redirecionam sozinhas para o painel (comportamento que já existe).
4. Mostrar uma mensagem de erro legível em português no lugar do texto técnico.

## Detalhes técnicos
- `src/routes/login.tsx` e `src/routes/signup.tsx`: `redirect_uri: window.location.origin`; `toast.error` com `result.error.message`.
- Chamar `supabase--configure_social_auth` com `["google"]`.
- Verificar: botão abre o popup do Google sem erro e, após login, cai em `/app`.
