-- Rodar uma vez no SQL Editor do Supabase (também incluído no fim do schema.sql).
-- Precisa rodar ANTES do deploy do admin que grava essas colunas.
--
-- Acompanhamento do pedido pelo cliente: e-mail de contato (pedido no
-- carrinho do site), código de rastreio (preenchido ao marcar como enviado)
-- e quando um pedido de retirada ficou pronto para buscar.

alter table orders add column if not exists customer_email text;
alter table orders add column if not exists tracking_code text;
alter table orders add column if not exists ready_at timestamptz; -- retirada: pedido separado e pronto para buscar na loja

-- A consulta "Acompanhar pedido" do site procura por telefone.
create index if not exists orders_customer_phone_idx on orders (customer_phone, created_at desc);
