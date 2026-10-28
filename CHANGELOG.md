# Changelog

Todas as subidas para produção do painel ADOM ficam registradas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

Cada PR para `develop` adiciona uma linha em **Não lançado**. No PR de release
(`develop` → `main`), essa seção vira uma versão com a data da subida.

## [Não lançado]

## [0.4.1] - 2026-10-28

### Corrigido
- Editar produto: ao adicionar um grupo de variação (ou novas opções) num produto já cadastrado, a seção Preço agora mostra uma linha por combinação, e salvar cria as variações novas com o preço informado. Antes ficava "Defina ao menos um grupo de variante" e o salvar travava em "Preencha o preço de todas as variações".

## [0.4.0] - 2026-10-28

### Adicionado
- Subcategorias em vários níveis na tela Categorias: arrastar e soltar em cima de uma categoria para virar subcategoria, ou entre duas para mudar a ordem; botão "+" para criar subcategoria e campo "Fica dentro de" (alternativa no celular). Precisa da migration `2026-10-27_category_parent.sql`.
- Produtos podem ficar em qualquer subcategoria ("Camisetas › Oversized"), e o filtro da lista de produtos inclui as subcategorias.
- `GET /api/categories` devolve `parentId` e `sortOrder` para a loja montar o menu.

### Alterado
- Entrada de mercadoria: textos curtos de ajuda em "Quantidade", "Valor total pago" e "Observação" (reposição e estoque inicial do cadastro).
- "Estoque atual por variação" com novo visual: agrupado por cor, um quadradinho por tamanho, total de unidades e variações zeradas em vermelho.

## [0.3.0] - 2026-10-27

### Adicionado
- Acompanhamento do pedido pelo cliente: rotas públicas `GET /api/orders/[id]` (página "Meu pedido" do site, sem dados pessoais) e `POST /api/orders/lookup` (busca por número do pedido + telefone).
- E-mail do cliente no pedido, código de rastreio ao marcar como enviado e etapa "Pronto para retirada" / "Retirado" para pedidos de retirada.
- Botões "Avisar no WhatsApp" e "Avisar por e-mail" nos detalhes do pedido, com mensagem pronta para cada etapa e o link de acompanhamento.

### Corrigido
- Links de WhatsApp do painel agora levam o código do país (55), sem ele o WhatsApp não abria a conversa certa.

### Alterado
- Novo visual do painel (cores e fontes do site, menu lateral escuro), listas paginadas com 10 itens e janela com os detalhes completos do pedido (cliente, WhatsApp, entrega ou retirada, frete, forma de pagamento e histórico).

## [0.2.0] - 2026-10-26

### Adicionado
- Processo de release: branch `develop` (homologação), CI com lint, tipos, testes e build, testes com Vitest, template de PR e este changelog.
- Webhook do Mercado Pago endurecido: confirma pedidos com a chave secreta do Supabase e valida a assinatura.
- Cron diário que cancela pedidos pendentes com link de pagamento expirado.
- Frete calculado no servidor, retirada na loja e forma de pagamento registrada no pedido.

### Segurança
- Funções `confirm_order` e `cancel_order` deixam de ser executáveis pelo papel anônimo.

## [0.1.0] - 2026-10-26

Estado de produção no momento em que o processo de release foi criado
(painel, API do site e Checkout Pro do Mercado Pago).
