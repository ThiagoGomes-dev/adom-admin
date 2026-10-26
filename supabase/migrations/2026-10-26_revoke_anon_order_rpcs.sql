-- Rodar uma vez no SQL Editor do Supabase (já incluído no fim do schema.sql).
--
-- Fecha a brecha em que qualquer pessoa, com a chave publishable (pública),
-- chamava `rpc/confirm_order` e marcava o próprio pedido como pago sem pagar.
-- Antes de rodar: SUPABASE_SECRET_KEY precisa estar configurada na Vercel e
-- o deploy com o webhook novo já publicado — senão o webhook para de
-- conseguir confirmar pedidos.

revoke execute on function confirm_order(uuid) from anon;
revoke execute on function cancel_order(uuid) from anon;
grant execute on function confirm_order(uuid) to authenticated, service_role;
grant execute on function cancel_order(uuid) to authenticated, service_role;
