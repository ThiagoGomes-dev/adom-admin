# Mercado Pago — como o pagamento funciona e como colocar no ar

## Fluxo

1. Site (`Sistemas Web Site`, Vite/React na Vercel) chama `POST {ADMIN}/api/orders` com o carrinho.
2. Admin (`adom-admin`, Next na Vercel) recalcula preço no banco, chama `create_order` (reserva o estoque,
   pedido `pending`) e cria a preference do Checkout Pro (`external_reference` = id do pedido,
   `notification_url` = `{ADMIN_URL}/api/webhooks/mercadopago`). Link expira em `MP_PAYMENT_WINDOW_MINUTES`.
3. Cliente paga no Mercado Pago e volta para `/pedido/sucesso|pendente|falha` (só visual).
4. Mercado Pago chama o webhook. O webhook:
   - valida `x-signature` (`MP_WEBHOOK_SIGNATURE_MODE=enforce` recusa, `log` só registra);
   - **sempre** relê o pagamento na API do MP com o `MP_ACCESS_TOKEN` (nunca confia no corpo);
   - `approved` → confere moeda BRL e valor ≥ total do pedido → `confirm_order` (vira venda) e grava
     `payment_reference`;
   - `cancelled` → `cancel_order` (devolve estoque). `rejected` não cancela: o cliente pode tentar
     de novo com outro cartão;
   - aprovado em pedido já cancelado → não confirma; escreve um aviso na observação do pedido.
   - Idempotente: `confirm_order`/`cancel_order` só agem em pedido `pending`, com lock de linha.
5. Cron diário da Vercel (`/api/cron/expire-orders`) cancela pedidos pendentes cujo link expirou e que
   não têm pagamento aprovado/em análise no MP.

## Checklist para colocar no ar (nesta ordem)

1. **Vercel → adom-admin → Environment Variables (Production):**
   - `SUPABASE_SECRET_KEY` — Supabase → Project Settings → API Keys → secret (ou `service_role`).
   - `CRON_SECRET` — string aleatória longa.
   - `MP_WEBHOOK_SIGNATURE_MODE=log` enquanto a assinatura não conferir (ver abaixo).
   - Conferir `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `ADMIN_URL`, `STOREFRONT_URL`.
2. Fazer merge da branch `feat/mp-webhook-hardening` (deploy).
3. **Supabase → SQL Editor:** rodar `supabase/migrations/2026-10-26_revoke_anon_order_rpcs.sql`.
4. Fazer um pagamento de teste e conferir o pedido virando "confirmado" no painel e nos logs da Vercel.

## Por que a assinatura não confere

O HMAC calculado no `SUPORTE_MERCADOPAGO_WEBHOOK.md` foi refeito e está correto (inclusive testando
variações do manifest e da chave): o Mercado Pago está assinando com um segredo diferente do que está
na Vercel. Causa mais comum: o `MP_ACCESS_TOKEN` usado para criar a preference é de **outra aplicação**
(ou de um usuário de teste) que não a da tela onde o segredo foi copiado — a notificação de um
`notification_url` é assinada com o segredo da aplicação dona do token.

Como conferir: o token tem o formato `APP_USR-<ID_DA_APLICAÇÃO>-...`. Esse número tem que ser igual ao
"Número da aplicação" (Application ID) da tela de Webhooks onde a assinatura secreta foi gerada.
O token do `.env.local` local é de um **usuário de teste** (aplicação `5670683751327340`); os
webhooks desse usuário são assinados com o segredo da aplicação do usuário de teste.

Enquanto isso não for resolvido, `MP_WEBHOOK_SIGNATURE_MODE=log` é seguro: nenhuma decisão usa
dados da notificação, só o que a API do MP devolve com o nosso token.
