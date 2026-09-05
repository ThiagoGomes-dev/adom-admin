# ADOM — Painel Administrativo

Sistema separado do site público (`Adom-Website`), pra gerenciar produtos e estoque. Expõe uma
API pública de leitura (`/api/products`) que o site consome no lugar do catálogo estático.

## Telas

- `/login` — acesso restrito (Supabase Auth)
- `/produtos` — lista, busca, filtro por categoria/estoque, edição rápida de estoque
- `/produtos/novo` e `/produtos/[id]` — criar/editar produto (dados, fotos, variantes flexíveis)
- `/categorias` — CRUD de categorias

## Configuração inicial (uma vez só)

### 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com), crie uma conta e um novo projeto (grátis).
2. No painel do projeto, vá em **SQL Editor > New query**, cole todo o conteúdo de
   [`supabase/schema.sql`](./supabase/schema.sql) e rode. Isso cria as tabelas `products` e
   `categories`, as políticas de segurança (RLS) e o bucket de imagens `product-images`.
3. Em **Authentication > Users**, crie manualmente o usuário (e-mail/senha) que vai logar no
   painel — não existe cadastro público, é só você/quem for administrar.

### 2. Configurar as variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha com os dados do seu projeto Supabase
(em **Project Settings > API**):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
STOREFRONT_ORIGIN=https://seu-site.vercel.app
```

### 3. Rodar localmente

```bash
npm install
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000) (redireciona pro login).

## Deploy no Vercel

Projeto separado do site — importa este repositório como um **novo projeto** no Vercel e
configura as mesmas 3 variáveis de ambiente acima (Project Settings > Environment Variables).

## Integração com o site (Adom-Website)

O site deve buscar os produtos em `GET https://<esse-projeto>.vercel.app/api/products` no lugar
de importar `src/data/demo/products.ts`. A resposta já vem no mesmo formato do tipo `Product`
usado pelo site, incluindo `stockQuantity`.
