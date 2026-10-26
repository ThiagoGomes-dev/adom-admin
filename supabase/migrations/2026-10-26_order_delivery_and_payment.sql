-- Rodar uma vez no SQL Editor do Supabase (também incluído no fim do schema.sql).
-- Precisa rodar ANTES do deploy do admin que grava essas colunas.
--
-- Entrega/retirada e frete do pedido (calculados no servidor em /api/orders)
-- e o meio de pagamento exato que o Mercado Pago informou (gravado pelo webhook).

alter table orders add column if not exists delivery_method text
  check (delivery_method in ('delivery', 'pickup')); -- null em pedidos antigos / feitos no painel
alter table orders add column if not exists shipping_cost numeric(10, 2) not null default 0;
alter table orders add column if not exists delivery_cep text;
alter table orders add column if not exists mp_payment_type text;   -- credit_card | debit_card | bank_transfer (Pix) | account_money ...
alter table orders add column if not exists mp_payment_method text; -- visa | master | pix ...
alter table orders add column if not exists mp_installments integer;
