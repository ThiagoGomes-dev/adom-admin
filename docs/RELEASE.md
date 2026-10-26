# Processo de release

Vale para os dois repositórios da loja: `adom-admin` (painel + API) e
`Adom-Website` (site). O fluxo é o mesmo nos dois.

```
feat/xxx ──PR──▶ develop ──(homologação na Vercel)──PR──▶ main ──▶ produção
```

## Branches

| Branch | Para quê | Quem escreve nela |
| --- | --- | --- |
| `main` | Produção. Cada merge publica em produção na Vercel. | Só PR vindo de `develop` (ou `hotfix/*`). |
| `develop` | Homologação. Cada merge publica no ambiente de homologação. | Só PR vindo de `feat/*`, `fix/*` ou `chore/*`. |
| `feat/*`, `fix/*`, `chore/*` | Uma mudança por branch, sempre criada a partir de `develop`. | Livre. |
| `hotfix/*` | Correção urgente em produção, criada a partir de `main`. | Livre. |

`main` e `develop` são protegidas no GitHub: ninguém dá push direto, todo
merge passa por PR com o CI verde.

## Passo a passo de uma mudança

1. Atualize a `develop` e crie a branch:
   ```bash
   git switch develop && git pull
   git switch -c feat/nome-curto
   ```
2. Faça o trabalho e rode localmente o mesmo que o CI roda:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run build
   ```
3. Adicione uma linha em `CHANGELOG.md`, seção **Não lançado**.
4. Abra o PR para `develop`. O template pede o que testar, migrations e
   variáveis de ambiente novas.
5. Espere o CI (**lint, tipos, testes e build**) ficar verde, revise o diff e
   faça o merge (prefira *Squash and merge*).
6. A Vercel publica a `develop` na homologação. Teste lá.

## Subida para produção (release)

1. Quando a homologação estiver aprovada, abra um PR de `develop` para `main`
   com o título `Release AAAA-MM-DD`.
2. No próprio PR, edite o `CHANGELOG.md`: a seção **Não lançado** vira
   `## [x.y.z] - AAAA-MM-DD` e uma nova **Não lançado** vazia fica no topo.
   Suba o `version` do `package.json` junto.
   - `x` muda quando algo deixa de funcionar como antes (ex.: API nova que o site precisa acompanhar).
   - `y` muda para funcionalidade nova.
   - `z` muda para correção.
3. Antes do merge, rode em produção as migrations do Supabase listadas nos PRs
   que estão entrando, na ordem indicada.
4. Faça o merge com *Create a merge commit* (para `main` e `develop` não
   divergirem) e marque a versão:
   ```bash
   git switch main && git pull
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
5. Confira a produção. Se algo quebrar, use *Instant Rollback* na Vercel
   (Deployments → deploy anterior → Promote) e corrija com um `hotfix/*`.

### Ordem entre os dois repositórios

Quando uma mudança mexe na API do painel e no site ao mesmo tempo, suba
primeiro o `adom-admin` (a API nova precisa aceitar o site antigo) e depois o
`Adom-Website`.

## Hotfix

1. `git switch main && git pull && git switch -c hotfix/descricao`
2. PR para `main` (CI obrigatório), merge, entrada no CHANGELOG como versão `z`.
3. Abra em seguida um PR de `main` para `develop` para a correção não se perder.

## Homologação na Vercel

A Vercel já gera preview para toda branch. A `develop` vira a homologação
fixa. Isso é configurado no painel da Vercel, uma vez por projeto:

1. **Domínio fixo para a develop** (recomendado): Settings → Domains → Add,
   por exemplo `homolog-painel.adomformen.com.br` (painel) e
   `homolog.adomformen.com.br` (site), e em cada um escolha *Git Branch:
   develop*. Sem isso, a URL fica no formato
   `<projeto>-git-develop-<time>.vercel.app`.
2. **Variáveis de ambiente**: hoje elas estão só em *Production*. Em
   Settings → Environment Variables, adicione cada uma de novo marcando só
   **Preview** e, no campo de branch, **develop**. Assim a homologação tem as
   próprias chaves e não usa as de produção. Depois de salvar, faça um
   *Redeploy* da develop.
3. **Proteção de preview**: se *Deployment Protection → Vercel
   Authentication* estiver ligado para previews, o Mercado Pago não consegue
   chamar o webhook e o site não consegue chamar a API da homologação. Desligue
   para previews ou use *Protection Bypass for Automation*.

### Variáveis do painel (`adom-admin`) em Preview/develop

| Variável | Valor na homologação |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase de homologação (ver abaixo). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publishable desse projeto. |
| `SUPABASE_SECRET_KEY` | Chave secret desse projeto (entra com o webhook endurecido). |
| `MP_ACCESS_TOKEN` | Token do **vendedor de teste** do Mercado Pago, nunca o de produção. |
| `MP_WEBHOOK_SECRET` | Segredo do webhook configurado para a URL de homologação. |
| `ADMIN_URL` | URL da homologação do painel (monta o `notification_url`). |
| `STOREFRONT_URL` | URL da homologação do site (monta os `back_urls`). |
| `STOREFRONT_ORIGIN` | Mesma origem da homologação do site (CORS). |
| `CRON_SECRET` | Um valor próprio da homologação (entra com o webhook endurecido). |

### Variáveis do site (`Adom-Website`) em Preview/develop

| Variável | Valor na homologação |
| --- | --- |
| `VITE_ADMIN_API_URL` | URL da homologação do painel. |

### Banco de dados da homologação

Se a homologação usar o mesmo Supabase da produção, um teste de compra cria
pedido de verdade e mexe no estoque real. O recomendado é criar um segundo
projeto no Supabase só para homologação, rodar nele as migrations de
`supabase/migrations` e usar as chaves dele nas variáveis acima.
