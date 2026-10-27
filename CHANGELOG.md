# Changelog

Todas as subidas para produção do painel ADOM ficam registradas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

Cada PR para `develop` adiciona uma linha em **Não lançado**. No PR de release
(`develop` → `main`), essa seção vira uma versão com a data da subida.

## [Não lançado]

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
