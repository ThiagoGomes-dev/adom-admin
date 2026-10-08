-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  image text,
  created_at timestamptz not null default now()
);

-- migração: adiciona imagem de capa da categoria em bancos já existentes (sem efeito em bancos novos, já criado acima)
alter table categories add column if not exists image text;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  short_description text,
  cost_price numeric(10, 2) not null default 0,
  price numeric(10, 2) not null default 0,
  promo_price numeric(10, 2),
  images text[] not null default '{}',
  category_slug text references categories (slug) on update cascade on delete set null,
  variants jsonb not null default '[]',
  available boolean not null default true,
  featured boolean not null default false,
  tags text[] not null default '{}',
  stock_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- mantém updated_at em dia a cada edição
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row
  execute function set_updated_at();

-- migração: adiciona preço de custo em bancos já existentes (sem efeito em bancos novos, já criado acima)
alter table products add column if not exists cost_price numeric(10, 2) not null default 0;

-- Row Level Security: leitura pública (para a API /api/products), escrita só autenticado
alter table categories enable row level security;
alter table products enable row level security;

drop policy if exists "Public read categories" on categories;
create policy "Public read categories" on categories for select using (true);

drop policy if exists "Public read products" on products;
create policy "Public read products" on products for select using (true);

drop policy if exists "Authenticated manage categories" on categories;
create policy "Authenticated manage categories" on categories for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated manage products" on products;
create policy "Authenticated manage products" on products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Categorias iniciais (iguais às que já existem hoje no site)
insert into categories (name, slug, icon) values
  ('Camisetas', 'camisetas', 'Shirt'),
  ('Regatas', 'regatas', 'Shirt')
on conflict (slug) do nothing;

-- Bucket de imagens dos produtos (leitura pública, escrita só autenticado)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Authenticated upload product images" on storage.objects;
create policy "Authenticated upload product images" on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update product images" on storage.objects;
create policy "Authenticated update product images" on storage.objects for update
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete product images" on storage.objects;
create policy "Authenticated delete product images" on storage.objects for delete
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Estoque por variação (SKU = combinação de opções, ex: Cor=Preta + Tamanho=P)
-- ---------------------------------------------------------------------------

-- Cada linha é uma combinação específica de variação de um produto, com
-- estoque e custo próprios. Produtos sem grupos de variação nunca têm linhas
-- aqui — continuam usando só products.stock_quantity/cost_price, como hoje.
create table if not exists product_variant_skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  -- snapshot de qual opção de cada grupo compõe esta combinação, ex:
  -- [{"groupId":"g1","groupName":"Cor","optionId":"o1","optionLabel":"Preta"},
  --  {"groupId":"g2","groupName":"Tamanho","optionId":"o5","optionLabel":"P"}]
  combo jsonb not null default '[]',
  -- chave normalizada "groupId:optionId|groupId:optionId" (ordenada), usada só
  -- para garantir que a mesma combinação não seja criada duas vezes
  combo_key text not null,
  stock_quantity integer not null default 0,
  cost_price numeric(10, 2) not null default 0,
  -- preço de venda específico desta variação — nulo = herda price/promo_price
  -- do produto (a maioria dos produtos nunca preenche isso)
  price numeric(10, 2),
  promo_price numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, combo_key)
);

-- migração: preço por variação em bancos já existentes (sem efeito em bancos novos, já criado acima)
alter table product_variant_skus add column if not exists price numeric(10, 2);
alter table product_variant_skus add column if not exists promo_price numeric(10, 2);

alter table product_variant_skus enable row level security;

drop trigger if exists product_variant_skus_set_updated_at on product_variant_skus;
create trigger product_variant_skus_set_updated_at
  before update on product_variant_skus
  for each row
  execute function set_updated_at();

drop policy if exists "Public read variant skus" on product_variant_skus;
create policy "Public read variant skus" on product_variant_skus for select using (true);

drop policy if exists "Authenticated manage variant skus" on product_variant_skus;
create policy "Authenticated manage variant skus" on product_variant_skus for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Mantém products.stock_quantity/cost_price/available como espelho automático
-- da soma dos SKUs — assim todo o resto do sistema (dashboard, lista de
-- produtos, alerta de estoque baixo, API pública) continua lendo os mesmos
-- dois campos de sempre, sem saber que por baixo existe variação.
create or replace function sync_product_from_variant_skus()
returns trigger as $$
declare
  v_product_id uuid;
  v_total_qty integer;
  v_total_cost numeric(14, 2);
begin
  v_product_id := coalesce(new.product_id, old.product_id);

  select coalesce(sum(stock_quantity), 0), coalesce(sum(stock_quantity * cost_price), 0)
    into v_total_qty, v_total_cost
    from product_variant_skus
    where product_id = v_product_id;

  update products
    set stock_quantity = v_total_qty,
        cost_price = case when v_total_qty > 0 then v_total_cost / v_total_qty else cost_price end,
        available = v_total_qty > 0
    where id = v_product_id;

  return null;
end;
$$ language plpgsql;

drop trigger if exists product_variant_skus_sync_product on product_variant_skus;
create trigger product_variant_skus_sync_product
  after insert or update or delete on product_variant_skus
  for each row
  execute function sync_product_from_variant_skus();

-- ---------------------------------------------------------------------------
-- Controle de vendas (registro manual — sem pagamento integrado)
-- ---------------------------------------------------------------------------

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null default '[]', -- [{product_id, sku_id, name, quantity, unit_price, unit_cost}]
  total numeric(10, 2) not null default 0,
  total_cost numeric(10, 2) not null default 0,
  payment_method text, -- 'pix' | 'credito' | 'dinheiro' | null
  note text,
  created_at timestamptz not null default now()
);

alter table sales enable row level security;

-- migração: custo total da venda em bancos já existentes (sem efeito em bancos novos, já criado acima)
alter table sales add column if not exists total_cost numeric(10, 2) not null default 0;

-- vendas não são públicas: só quem está logado no admin lê/cria
drop policy if exists "Authenticated manage sales" on sales;
create policy "Authenticated manage sales" on sales for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Registra uma venda com vários produtos de uma vez: valida estoque, desconta
-- de cada produto (ou, quando o item informa `sku_id`, da variação específica
-- — o gatilho `product_variant_skus_sync_product` mantém o total do produto
-- em dia sozinho) e grava o histórico — tudo em uma transação só (ou tudo
-- funciona, ou nada é alterado, mesmo se um item no meio da lista falhar).
create or replace function register_sale(p_items jsonb, p_payment_method text, p_note text)
returns uuid
language plpgsql
as $$
declare
  v_item jsonb;
  v_product products%rowtype;
  v_sku product_variant_skus%rowtype;
  v_sku_id uuid;
  v_variant_label text;
  v_quantity integer;
  v_unit_price numeric(10, 2);
  v_unit_cost numeric(10, 2);
  v_snapshot jsonb := '[]'::jsonb;
  v_total numeric(10, 2) := 0;
  v_total_cost numeric(10, 2) := 0;
  v_sale_id uuid;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::int;
    v_sku_id := nullif(v_item->>'sku_id', '')::uuid;
    v_variant_label := null;

    select * into v_product from products where id = (v_item->>'product_id')::uuid for update;
    if not found then
      raise exception 'Produto não encontrado';
    end if;

    if v_sku_id is not null then
      select * into v_sku from product_variant_skus where id = v_sku_id and product_id = v_product.id for update;
      if not found then
        raise exception 'Variação não encontrada para "%"', v_product.name;
      end if;

      if v_sku.stock_quantity < v_quantity then
        raise exception 'Estoque insuficiente para "%": disponível %, pedido %', v_product.name, v_sku.stock_quantity, v_quantity;
      end if;

      v_unit_price := coalesce(v_sku.promo_price, v_sku.price, v_product.promo_price, v_product.price);
      v_unit_cost := coalesce(v_sku.cost_price, 0);

      select string_agg(elem->>'optionLabel', ' / ' order by elem->>'groupName')
        into v_variant_label
        from jsonb_array_elements(v_sku.combo) elem;

      update product_variant_skus set stock_quantity = stock_quantity - v_quantity where id = v_sku.id;
    else
      if v_product.stock_quantity < v_quantity then
        raise exception 'Estoque insuficiente para "%": disponível %, pedido %', v_product.name, v_product.stock_quantity, v_quantity;
      end if;

      v_unit_price := coalesce(v_product.promo_price, v_product.price);
      v_unit_cost := coalesce(v_product.cost_price, 0);

      update products
        set stock_quantity = stock_quantity - v_quantity,
            available = (stock_quantity - v_quantity) > 0
        where id = v_product.id;
    end if;

    v_snapshot := v_snapshot || jsonb_build_object(
      'product_id', v_product.id,
      'sku_id', v_sku_id,
      'variant_label', v_variant_label,
      'name', v_product.name,
      'quantity', v_quantity,
      'unit_price', v_unit_price,
      'unit_cost', v_unit_cost
    );
    v_total := v_total + v_unit_price * v_quantity;
    v_total_cost := v_total_cost + v_unit_cost * v_quantity;
  end loop;

  insert into sales (items, total, total_cost, payment_method, note)
  values (v_snapshot, v_total, v_total_cost, p_payment_method, p_note)
  returning id into v_sale_id;

  return v_sale_id;
end;
$$;

revoke all on function register_sale(jsonb, text, text) from public;
grant execute on function register_sale(jsonb, text, text) to authenticated;

-- Exclui uma venda e devolve ao estoque a quantidade de cada item vendido
-- (para o caso de a venda ter sido registrada errada e precisar ser refeita).
-- Itens com `sku_id` devolvem à variação específica; itens antigos (sem
-- `sku_id`, de antes desta coluna existir) devolvem ao produto, como sempre.
create or replace function delete_sale(p_sale_id uuid)
returns void
language plpgsql
as $$
declare
  v_sale sales%rowtype;
  v_item jsonb;
  v_sku_id uuid;
  v_qty integer;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada';
  end if;

  for v_item in select * from jsonb_array_elements(v_sale.items) loop
    v_qty := (v_item->>'quantity')::int;
    v_sku_id := nullif(v_item->>'sku_id', '')::uuid;

    if v_sku_id is not null then
      update product_variant_skus set stock_quantity = stock_quantity + v_qty where id = v_sku_id;
    else
      update products
        set stock_quantity = stock_quantity + v_qty,
            available = (stock_quantity + v_qty) > 0
        where id = (v_item->>'product_id')::uuid;
    end if;
  end loop;

  delete from sales where id = p_sale_id;
end;
$$;

revoke all on function delete_sale(uuid) from public;
grant execute on function delete_sale(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reposição de estoque (custo médio ponderado)
-- ---------------------------------------------------------------------------

-- Cada linha é uma "entrada" de mercadoria — permite no futuro montar um
-- relatório de quanto foi gasto comprando estoque, por período/produto.
create table if not exists stock_entries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  quantity integer not null,
  total_cost numeric(10, 2) not null,
  unit_cost numeric(10, 2) not null, -- total_cost / quantity, guardado pronto pra não recalcular no relatório
  note text,
  created_at timestamptz not null default now()
);

alter table stock_entries enable row level security;

-- migração: vincula cada entrada a uma variação específica, quando o produto
-- tem variação (nulo = entrada de produto simples, comportamento de sempre)
alter table stock_entries add column if not exists sku_id uuid references product_variant_skus (id) on delete cascade;

drop policy if exists "Authenticated manage stock entries" on stock_entries;
create policy "Authenticated manage stock entries" on stock_entries for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Registra a chegada de mais unidades de um produto: soma ao estoque atual e
-- recalcula o custo por unidade como média ponderada entre o que já tinha e
-- a nova leva (mistura lotes com preços diferentes sem precisar rastrear
-- cada lote separadamente — suficiente pra um estoque fungível tipo camiseta).
create or replace function restock_product(p_product_id uuid, p_quantity integer, p_total_cost numeric, p_note text)
returns void
language plpgsql
as $$
declare
  v_product products%rowtype;
  v_new_stock integer;
  v_new_cost numeric(10, 2);
  v_unit_cost numeric(10, 2);
begin
  if p_quantity <= 0 then
    raise exception 'Quantidade precisa ser maior que zero';
  end if;
  if p_total_cost < 0 then
    raise exception 'Valor pago não pode ser negativo';
  end if;

  select * into v_product from products where id = p_product_id for update;
  if not found then
    raise exception 'Produto não encontrado';
  end if;

  v_unit_cost := p_total_cost / p_quantity;
  v_new_stock := v_product.stock_quantity + p_quantity;
  v_new_cost := (v_product.stock_quantity * v_product.cost_price + p_total_cost) / v_new_stock;

  update products
    set stock_quantity = v_new_stock,
        cost_price = v_new_cost,
        available = true
    where id = p_product_id;

  insert into stock_entries (product_id, quantity, total_cost, unit_cost, note)
  values (p_product_id, p_quantity, p_total_cost, v_unit_cost, p_note);
end;
$$;

revoke all on function restock_product(uuid, integer, numeric, text) from public;
grant execute on function restock_product(uuid, integer, numeric, text) to authenticated;

-- Registra a chegada de um lote e distribui entre as variações de um produto,
-- numa única transação: exige que a soma das quantidades alocadas feche
-- exatamente com a quantidade total do lote (reconciliação obrigatória — é
-- assim que o financeiro garante que nenhuma peça "sumiu" na distribuição),
-- rateia o custo por unidade uniformemente pelo lote, e atualiza o custo
-- médio ponderado de cada SKU individualmente (mesmo princípio do
-- restock_product acima, só que por variação em vez de por produto inteiro).
create or replace function restock_product_variants(
  p_product_id uuid,
  p_total_quantity integer,
  p_total_cost numeric,
  p_allocations jsonb, -- [{"sku_id": "...", "quantity": 10}, ...]
  p_note text
)
returns void
language plpgsql
as $$
declare
  v_alloc jsonb;
  v_sku product_variant_skus%rowtype;
  v_qty integer;
  v_unit_cost numeric(10, 2);
  v_allocated_total integer := 0;
  v_new_stock integer;
  v_new_cost numeric(10, 2);
begin
  if p_total_quantity <= 0 then
    raise exception 'Quantidade total precisa ser maior que zero';
  end if;
  if p_total_cost < 0 then
    raise exception 'Valor pago não pode ser negativo';
  end if;
  if p_allocations is null or jsonb_array_length(p_allocations) = 0 then
    raise exception 'Distribua a quantidade entre ao menos uma variação';
  end if;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_allocated_total := v_allocated_total + coalesce((v_alloc->>'quantity')::int, 0);
  end loop;

  if v_allocated_total <> p_total_quantity then
    raise exception 'A soma das variações (%) precisa bater com a quantidade total do lote (%)', v_allocated_total, p_total_quantity;
  end if;

  v_unit_cost := p_total_cost / p_total_quantity;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_qty := coalesce((v_alloc->>'quantity')::int, 0);
    if v_qty <= 0 then
      continue;
    end if;

    select * into v_sku from product_variant_skus
      where id = (v_alloc->>'sku_id')::uuid and product_id = p_product_id
      for update;
    if not found then
      raise exception 'Variação não encontrada para este produto';
    end if;

    v_new_stock := v_sku.stock_quantity + v_qty;
    v_new_cost := (v_sku.stock_quantity * v_sku.cost_price + v_qty * v_unit_cost) / v_new_stock;

    update product_variant_skus
      set stock_quantity = v_new_stock,
          cost_price = v_new_cost
      where id = v_sku.id;

    insert into stock_entries (product_id, sku_id, quantity, total_cost, unit_cost, note)
    values (p_product_id, v_sku.id, v_qty, v_qty * v_unit_cost, v_unit_cost, p_note);
  end loop;
end;
$$;

revoke all on function restock_product_variants(uuid, integer, numeric, jsonb, text) from public;
grant execute on function restock_product_variants(uuid, integer, numeric, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cadastro atômico de produto com variação
-- ---------------------------------------------------------------------------

-- Cadastra um produto com variação numa única transação: insere o produto,
-- cria um SKU por combinação (já com preço, quando informado) e, se houver
-- lote inicial, distribui o estoque reaproveitando restock_product_variants
-- (mesma reconciliação "soma tem que bater" de sempre). Substitui a cadeia
-- createProduct -> listProductVariantSkus -> setVariantSkuPricing ->
-- restockProductVariants que o admin fazia em 4 chamadas separadas sem
-- transação — se qualquer parte falhar aqui, nada fica salvo (nem o produto,
-- nem os SKUs), em vez de deixar dado parcial órfão.
create or replace function create_product_with_variants(
  p_product jsonb,       -- mesmo formato de productInputToRow() em src/lib/mappers.ts (colunas já em snake_case)
  p_skus jsonb,           -- [{"combo_key": "...", "combo": [...], "price": num|null, "promo_price": num|null}, ...]
  p_allocations jsonb,    -- [{"combo_key": "...", "quantity": int}, ...] — '[]' quando não há estoque inicial
  p_total_quantity integer,
  p_total_cost numeric,
  p_note text
)
returns uuid
language plpgsql
as $$
declare
  v_product_id uuid;
  v_sku jsonb;
  v_sku_id uuid;
  v_resolved_allocations jsonb := '[]'::jsonb;
  v_qty integer;
begin
  if exists (select 1 from products where slug = p_product->>'slug') then
    raise exception 'Já existe um produto com o slug "%"', p_product->>'slug';
  end if;

  insert into products (
    slug, name, description, short_description, cost_price, price, promo_price,
    images, category_slug, variants, available, featured, tags, stock_quantity
  )
  values (
    p_product->>'slug',
    p_product->>'name',
    coalesce(p_product->>'description', ''),
    p_product->>'short_description',
    0,
    coalesce((p_product->>'price')::numeric, 0),
    nullif(p_product->>'promo_price', '')::numeric,
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_product->'images') x), '{}'),
    p_product->>'category_slug',
    coalesce(p_product->'variants', '[]'::jsonb),
    coalesce((p_product->>'available')::boolean, true),
    coalesce((p_product->>'featured')::boolean, false),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_product->'tags') x), '{}'),
    0
  )
  returning id into v_product_id;

  for v_sku in select * from jsonb_array_elements(p_skus) loop
    insert into product_variant_skus (product_id, combo, combo_key, price, promo_price)
    values (
      v_product_id,
      v_sku->'combo',
      v_sku->>'combo_key',
      nullif(v_sku->>'price', '')::numeric,
      nullif(v_sku->>'promo_price', '')::numeric
    )
    returning id into v_sku_id;

    select (a->>'quantity')::int into v_qty
      from jsonb_array_elements(p_allocations) a
      where a->>'combo_key' = v_sku->>'combo_key';

    if v_qty is not null and v_qty > 0 then
      v_resolved_allocations := v_resolved_allocations
        || jsonb_build_object('sku_id', v_sku_id, 'quantity', v_qty);
    end if;
  end loop;

  if p_allocations is not null and jsonb_array_length(p_allocations) > 0 then
    perform restock_product_variants(v_product_id, p_total_quantity, p_total_cost, v_resolved_allocations, p_note);
  end if;

  return v_product_id;
end;
$$;

revoke all on function create_product_with_variants(jsonb, jsonb, jsonb, integer, numeric, text) from public;
grant execute on function create_product_with_variants(jsonb, jsonb, jsonb, integer, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Pedidos (criados pelo site, pendentes até confirmação de pagamento)
-- ---------------------------------------------------------------------------

-- Cada linha é um pedido feito pelo site. Nasce com o estoque já debitado
-- (reserva) e `status = 'pending'`; o admin confirma (vira venda de
-- verdade, em `sales`) ou cancela (devolve o estoque) — ver as duas
-- funções abaixo. `confirmation_method`/`payment_reference` já preparam o
-- terreno pra quando o pagamento online (Mercado Pago) existir: o checkout
-- vai chamar a mesma `create_order` só trocando esses dois campos, e o
-- webhook de pagamento vai chamar as mesmas `confirm_order`/`cancel_order`
-- que o botão do admin já chama hoje — nada aqui precisa ser refeito.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null default '[]', -- mesmo shape do snapshot de sales.items: [{product_id, sku_id, variant_label, name, quantity, unit_price, unit_cost}]
  total numeric(10, 2) not null default 0,
  total_cost numeric(10, 2) not null default 0,
  payment_method text, -- 'pix' | 'credito' | null — forma escolhida no checkout do site
  customer_name text,
  customer_phone text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  confirmation_method text not null default 'manual', -- 'manual' hoje | 'mercado_pago' depois — texto livre, não enum fechado
  payment_reference text, -- id de pagamento/preference do Mercado Pago — vazio até a integração existir
  sale_id uuid references sales (id) on delete set null, -- preenchido quando confirmado
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  shipped_at timestamptz -- preenchido quando o admin marca como enviado (pedido confirmado + não enviado = "aguardando envio")
);

-- migração: status de envio em bancos já existentes (sem efeito em bancos novos, já criado acima)
alter table orders add column if not exists shipped_at timestamptz;

alter table orders enable row level security;

-- Leitura/gestão só autenticado (painel admin). Anônimo nunca lê/escreve
-- direto nesta tabela — a única escrita de anônimo passa pela função
-- `create_order` abaixo (security definer), que valida tudo antes de inserir.
drop policy if exists "Authenticated manage orders" on orders;
create policy "Authenticated manage orders" on orders for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create index if not exists orders_status_idx on orders (status, created_at desc);

-- Habilita notificação em tempo real (Supabase Realtime) pro admin saber
-- na hora que um pedido novo chegou, sem precisar de infraestrutura extra.
alter publication supabase_realtime add table orders;

-- Replica identity "full": sem isso, o Supabase Realtime só manda a chave
-- primária no "old" de um UPDATE — e o front precisa saber o status
-- ANTERIOR (pending -> confirmed, confirmed -> enviado) pra decidir que
-- toast mostrar e se a contagem de pendências deve mudar.
alter table orders replica identity full;

-- Cria um pedido pendente a partir do carrinho do site: valida estoque e
-- DECREMENTA na hora (reserva), mas não grava em `sales` ainda — só quando
-- confirmado. É a única escrita que um visitante anônimo faz no banco, por
-- isso é security definer (RLS de products/product_variant_skus só permite
-- escrita autenticada) — e por isso valida tudo internamente (não confia só
-- na camada HTTP): quantidade positiva, teto de itens/quantidade por
-- pedido, mesma trava de estoque `for update` que `register_sale` já usa.
-- Não aceita nenhum parâmetro que não seja estritamente necessário pro
-- pedido (sem p_status, sem p_sale_id) — nada que o chamador anônimo passe
-- pode pular as validações abaixo.
-- migração: create_order passou a devolver a linha inteira do pedido (em vez
-- de só o uuid), pra rota da API não precisar de um segundo select (que
-- falhava: o select avulso roda como anônimo e a RLS de `orders` bloqueia
-- leitura sem estar autenticado). `create or replace` não permite trocar o
-- tipo de retorno, por isso o drop abaixo.
drop function if exists create_order(jsonb, text, text, text, text, text);

create or replace function create_order(
  p_items jsonb, -- [{"product_id": "...", "sku_id": "..."|null, "quantity": int}, ...] já resolvido
  p_payment_method text,
  p_customer_name text,
  p_customer_phone text,
  p_note text,
  p_confirmation_method text default 'manual'
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product products%rowtype;
  v_sku product_variant_skus%rowtype;
  v_sku_id uuid;
  v_variant_label text;
  v_quantity integer;
  v_unit_price numeric(10, 2);
  v_unit_cost numeric(10, 2);
  v_snapshot jsonb := '[]'::jsonb;
  v_total numeric(10, 2) := 0;
  v_total_cost numeric(10, 2) := 0;
  v_item_count integer := 0;
  v_order orders%rowtype;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Pedido sem itens';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'Pedido com muitos itens';
  end if;
  if coalesce(trim(p_customer_phone), '') = '' then
    raise exception 'Telefone do cliente é obrigatório';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::int;
    if v_quantity is null or v_quantity <= 0 or v_quantity > 50 then
      raise exception 'Quantidade inválida para um dos itens';
    end if;
    v_item_count := v_item_count + v_quantity;
    if v_item_count > 200 then
      raise exception 'Pedido excede o limite de itens permitido';
    end if;

    v_sku_id := nullif(v_item->>'sku_id', '')::uuid;
    v_variant_label := null;

    select * into v_product from products where id = (v_item->>'product_id')::uuid for update;
    if not found then
      raise exception 'Produto não encontrado';
    end if;

    if v_sku_id is not null then
      select * into v_sku from product_variant_skus where id = v_sku_id and product_id = v_product.id for update;
      if not found then
        raise exception 'Variação não encontrada para "%"', v_product.name;
      end if;
      if v_sku.stock_quantity < v_quantity then
        raise exception 'Estoque insuficiente para "%": disponível %, pedido %', v_product.name, v_sku.stock_quantity, v_quantity;
      end if;

      v_unit_price := coalesce(v_sku.promo_price, v_sku.price, v_product.promo_price, v_product.price);
      v_unit_cost := coalesce(v_sku.cost_price, 0);

      select string_agg(elem->>'optionLabel', ' / ' order by elem->>'groupName')
        into v_variant_label
        from jsonb_array_elements(v_sku.combo) elem;

      update product_variant_skus set stock_quantity = stock_quantity - v_quantity where id = v_sku.id;
    else
      if v_product.stock_quantity < v_quantity then
        raise exception 'Estoque insuficiente para "%": disponível %, pedido %', v_product.name, v_product.stock_quantity, v_quantity;
      end if;

      v_unit_price := coalesce(v_product.promo_price, v_product.price);
      v_unit_cost := coalesce(v_product.cost_price, 0);

      update products
        set stock_quantity = stock_quantity - v_quantity,
            available = (stock_quantity - v_quantity) > 0
        where id = v_product.id;
    end if;

    v_snapshot := v_snapshot || jsonb_build_object(
      'product_id', v_product.id,
      'sku_id', v_sku_id,
      'variant_label', v_variant_label,
      'name', v_product.name,
      'quantity', v_quantity,
      'unit_price', v_unit_price,
      'unit_cost', v_unit_cost
    );
    v_total := v_total + v_unit_price * v_quantity;
    v_total_cost := v_total_cost + v_unit_cost * v_quantity;
  end loop;

  insert into orders (
    items, total, total_cost, payment_method, customer_name, customer_phone, note, confirmation_method
  )
  values (
    v_snapshot, v_total, v_total_cost, p_payment_method, p_customer_name, p_customer_phone, p_note,
    coalesce(p_confirmation_method, 'manual')
  )
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function create_order(jsonb, text, text, text, text, text) from public;
grant execute on function create_order(jsonb, text, text, text, text, text) to anon, authenticated;

-- Confirma um pedido pendente: o estoque já foi debitado em create_order,
-- então aqui só grava a venda real em `sales` (reaproveitando o mesmo
-- snapshot `items` já calculado) e marca o pedido como confirmado. Chamada
-- pelo botão "Confirmar venda" do admin (autenticado) E pelo webhook do
-- Mercado Pago (anônimo, mas só depois de validar a assinatura na rota) —
-- por isso também é security definer, com grant pra `anon` além de
-- `authenticated`.
create or replace function confirm_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_sale_id uuid;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Pedido já foi %', v_order.status;
  end if;

  insert into sales (items, total, total_cost, payment_method, note)
  values (
    v_order.items, v_order.total, v_order.total_cost, v_order.payment_method,
    coalesce(v_order.note, '') || case
      when v_order.customer_name is not null then format(' — Cliente: %s (%s)', v_order.customer_name, v_order.customer_phone)
      else ''
    end
  )
  returning id into v_sale_id;

  update orders
    set status = 'confirmed', sale_id = v_sale_id, confirmed_at = now()
    where id = p_order_id;

  return v_sale_id;
end;
$$;

revoke all on function confirm_order(uuid) from public;
grant execute on function confirm_order(uuid) to anon, authenticated;

-- Cancela um pedido pendente e devolve ao estoque (mesma lógica de
-- delete_sale, só que a partir de `orders`, sem nunca ter existido venda).
-- Mesmo motivo de confirm_order acima: precisa ser chamável pelo webhook
-- (anônimo) e pela própria rota /api/orders quando a preference do
-- Mercado Pago falha e o pedido precisa ser desfeito.
create or replace function cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item jsonb;
  v_sku_id uuid;
  v_qty integer;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Pedido já foi %', v_order.status;
  end if;

  for v_item in select * from jsonb_array_elements(v_order.items) loop
    v_qty := (v_item->>'quantity')::int;
    v_sku_id := nullif(v_item->>'sku_id', '')::uuid;

    if v_sku_id is not null then
      update product_variant_skus set stock_quantity = stock_quantity + v_qty where id = v_sku_id;
    else
      update products
        set stock_quantity = stock_quantity + v_qty,
            available = (stock_quantity + v_qty) > 0
        where id = (v_item->>'product_id')::uuid;
    end if;
  end loop;

  update orders set status = 'cancelled', cancelled_at = now() where id = p_order_id;
end;
$$;

revoke all on function cancel_order(uuid) from public;
grant execute on function cancel_order(uuid) to anon, authenticated;
