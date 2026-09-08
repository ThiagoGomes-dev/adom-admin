-- Rode este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  created_at timestamptz not null default now()
);

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
-- Controle de vendas (registro manual — sem pagamento integrado)
-- ---------------------------------------------------------------------------

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null default '[]', -- [{product_id, name, quantity, unit_price, unit_cost}]
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
-- de cada produto e grava o histórico — tudo em uma transação só (ou tudo
-- funciona, ou nada é alterado, mesmo se um item no meio da lista falhar).
create or replace function register_sale(p_items jsonb, p_payment_method text, p_note text)
returns uuid
language plpgsql
as $$
declare
  v_item jsonb;
  v_product products%rowtype;
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

    select * into v_product from products where id = (v_item->>'product_id')::uuid for update;
    if not found then
      raise exception 'Produto não encontrado';
    end if;

    if v_product.stock_quantity < v_quantity then
      raise exception 'Estoque insuficiente para "%": disponível %, pedido %', v_product.name, v_product.stock_quantity, v_quantity;
    end if;

    v_unit_price := coalesce(v_product.promo_price, v_product.price);
    v_unit_cost := coalesce(v_product.cost_price, 0);

    update products
      set stock_quantity = stock_quantity - v_quantity,
          available = (stock_quantity - v_quantity) > 0
      where id = v_product.id;

    v_snapshot := v_snapshot || jsonb_build_object(
      'product_id', v_product.id,
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
create or replace function delete_sale(p_sale_id uuid)
returns void
language plpgsql
as $$
declare
  v_sale sales%rowtype;
  v_item jsonb;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada';
  end if;

  for v_item in select * from jsonb_array_elements(v_sale.items) loop
    update products
      set stock_quantity = stock_quantity + (v_item->>'quantity')::int,
          available = (stock_quantity + (v_item->>'quantity')::int) > 0
      where id = (v_item->>'product_id')::uuid;
  end loop;

  delete from sales where id = p_sale_id;
end;
$$;

revoke all on function delete_sale(uuid) from public;
grant execute on function delete_sale(uuid) to authenticated;
