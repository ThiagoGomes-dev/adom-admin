import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase com a chave secreta (papel `service_role`) — ignora RLS.
 * Só pra código de servidor que roda SEM sessão de usuário e precisa mexer
 * em pedido: webhook do Mercado Pago, rollback de pedido em /api/orders, o
 * cron de expiração e a consulta pública do pedido ("Meu pedido" no site). `confirm_order`/`cancel_order` não aceitam mais o papel
 * `anon`, então essas rotas não funcionam com o cliente comum.
 *
 * Nunca importar isso em componente de cliente — a chave dá acesso total
 * ao banco.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error('SUPABASE_SECRET_KEY não configurada (necessária pro webhook do Mercado Pago).');
  }
  return createSupabaseClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
