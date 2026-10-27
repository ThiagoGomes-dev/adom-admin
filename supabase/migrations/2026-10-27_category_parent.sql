-- Rodar uma vez no SQL Editor do Supabase (também incluído no fim do schema.sql).
-- Só aditiva: o site e o painel atuais ignoram as colunas novas, e o painel
-- novo continua listando categorias mesmo antes dela rodar (só não consegue
-- mover/criar subcategorias até lá).
--
-- Subcategorias: uma categoria com parent_id fica dentro da categoria apontada
-- (quantos níveis quiser; o painel impede ciclos). sort_order é a posição entre
-- as irmãs, definida arrastando no painel e usada no menu do site.

alter table categories add column if not exists parent_id uuid references categories (id) on delete set null;
alter table categories add column if not exists sort_order integer not null default 0;

create index if not exists categories_parent_id_idx on categories (parent_id);
