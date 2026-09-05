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
