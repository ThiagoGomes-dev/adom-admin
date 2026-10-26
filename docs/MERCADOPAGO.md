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
2. **Supabase → SQL Editor:** rodar `supabase/migrations/2026-10-26_order_delivery_and_payment.sql`
   (colunas de entrega/frete/meio de pagamento — o admin novo grava nelas).
3. Fazer merge da branch `feat/mp-webhook-hardening` do admin (deploy).
4. Fazer merge da branch `feat/retirada-na-loja` do site (deploy). O admin novo exige
   `deliveryMethod` no pedido, então o site antigo recebe erro até este passo.
5. **Supabase → SQL Editor:** rodar `supabase/migrations/2026-10-26_revoke_anon_order_rpcs.sql`.
6. Pagamentos de teste (um com entrega, um com retirada) e conferir o pedido virando "confirmado"
   no painel, com frete e forma de pagamento preenchidos.

## Frete

Calculado no servidor (`src/lib/shipping.ts`): retirada na loja = 0; Campina Grande = R$ 12;
outras cidades = R$ 49,90; grátis com R$ 399,90 ou mais em produtos. A cidade vem do CEP via
ViaCEP. O site tem uma cópia da regra só para exibir — mudou aqui, mude lá também.

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

## Ambiente de teste (compra e pagamento de ponta a ponta)

No Checkout Pro o "teste" não usa as credenciais `TEST-...`: usa **usuários de teste**.

1. Na sua conta real: Mercado Pago Developers → Suas integrações → sua aplicação → **Contas de teste**.
   Crie dois usuários (país Brasil): **Vendedor** e **Comprador**. Anote usuário/senha de cada um.
2. Numa janela anônima, entre em mercadopago.com.br/developers **com o usuário Vendedor de teste**, crie
   uma aplicação (Checkout Pro) e copie as **credenciais de produção** dela (`APP_USR-...`). Esse é o
   `MP_ACCESS_TOKEN` de teste. (O token do `.env.local` local já é de um vendedor de teste.)
3. Ainda logado como Vendedor de teste: na aplicação dele → **Webhooks → Configurar notificações**,
   URL `https://<admin-de-teste>/api/webhooks/mercadopago`, evento **Pagamentos**, salve e copie a
   **assinatura secreta** → `MP_WEBHOOK_SECRET`. O segredo tem que ser da MESMA aplicação do token —
   misturar token do vendedor de teste com segredo da conta real faz a assinatura nunca conferir.
4. O MP não alcança `localhost`. Opções: um deploy de Preview na Vercel (com as variáveis no escopo
   **Preview** e `ADMIN_URL` = URL do preview) **com Deployment Protection desligada** para o
   preview — senão a Vercel responde 401 ao MP antes de chegar no código; ou um túnel (ngrok/cloudflared)
   para o `next dev` local.
5. `STOREFRONT_URL` = URL do site que vai receber o cliente de volta; no site, `VITE_ADMIN_API_URL`
   apontando para o admin de teste.
6. Compre pelo site, abra o link de pagamento numa janela anônima e **entre com o usuário Comprador de
   teste**. Cartão de teste Mastercard `5031 4332 1540 6351`, CVV `123`, validade `11/30`, CPF
   `12345678909`. O nome do titular define o resultado: `APRO` aprovado, `OTHE` recusado, `CONT` pendente.
7. O que conferir: ao criar o pedido o estoque da variação já cai (reserva) e o pedido aparece
   **pendente** no painel; com `APRO`, em segundos o pedido vira **confirmado** e aparece em Vendas;
   com `OTHE` continua pendente (o cliente pode tentar de novo); nos logs da Vercel aparece
   `[MP webhook] pedido confirmado`.

Atenção: o banco é o mesmo Supabase de produção, então pedidos de teste baixam estoque de verdade.
Cancele-os no painel depois (devolve o estoque) ou use um projeto Supabase separado para teste.
