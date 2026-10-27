/**
 * Mesmo contrato de dados usado pelo site público (Adom-Website), acrescido
 * de `stockQuantity`. É o formato que a rota pública `/api/products` expõe.
 */

export interface ProductVariantOption {
  id: string;
  label: string;
  /** valor extra (ex: código hex de cor) usado só para exibição */
  meta?: string;
  /** foto do produto (uma das URLs em `images`) a mostrar quando esta opção é selecionada */
  image?: string;
}

export interface ProductVariantGroup {
  id: string;
  name: string;
  options: ProductVariantOption[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription?: string;
  costPrice: number;
  price: number;
  promoPrice?: number;
  images: string[];
  category: string;
  variants: ProductVariantGroup[];
  available: boolean;
  featured: boolean;
  tags: string[];
  stockQuantity: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
}

export type PaymentMethod = 'pix' | 'credito' | 'dinheiro';

export interface SaleItem {
  productId: string;
  /** variação vendida (quando o produto tem SKUs) — ausente em vendas de produto sem variação ou de antes desta coluna existir */
  skuId?: string;
  /** rótulo da variação no momento da venda, ex: "Preta / P" (só exibição) */
  variantLabel?: string;
  /** nome do produto no momento da venda (não muda se o produto for renomeado depois) */
  name: string;
  quantity: number;
  /** preço unitário no momento da venda */
  unitPrice: number;
  /** custo unitário no momento da venda */
  unitCost: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  totalCost: number;
  paymentMethod: PaymentMethod | null;
  note?: string;
  createdAt: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

/** Quem vai confirmar o pagamento deste pedido — 'manual' hoje (o admin clica), 'mercado_pago' quando essa integração existir (texto livre, não enum fechado, pra caber variações futuras como maquininha). */
export type ConfirmationMethod = string;

/** Pedido criado pelo site — nasce com o estoque já debitado (reserva) e some em `sales` só quando confirmado. */
export interface Order {
  id: string;
  items: SaleItem[];
  total: number;
  totalCost: number;
  paymentMethod: PaymentMethod | null;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  status: OrderStatus;
  confirmationMethod: ConfirmationMethod;
  paymentReference?: string;
  /** id da venda real gerada em `sales`, preenchido quando confirmado */
  saleId?: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  /** preenchido quando o admin marca que o pedido foi enviado — confirmado + sem isso = "pago, aguardando envio" */
  shippedAt?: string;
  /** 'delivery' (entrega no CEP) | 'pickup' (retirada na loja) — ausente em pedidos antigos */
  deliveryMethod?: 'delivery' | 'pickup';
  /** frete cobrado no Mercado Pago, à parte do `total` dos produtos */
  shippingCost: number;
  deliveryCep?: string;
  /** como o cliente pagou no Mercado Pago (payment_type_id/payment_method_id/parcelas) */
  mpPaymentType?: string;
  mpPaymentMethod?: string;
  mpInstallments?: number;
  /** e-mail de contato informado no carrinho do site — ausente em pedidos antigos */
  customerEmail?: string;
  /** código de rastreio dos Correios/transportadora, informado ao marcar como enviado */
  trackingCode?: string;
  /** retirada: quando o pedido ficou separado e pronto para o cliente buscar */
  readyAt?: string;
}

/** Uma reposição de estoque — registrada ao repor um produto, guarda o custo daquela leva. */
export interface StockEntry {
  id: string;
  productId: string;
  /** variação que recebeu esta parte do lote — ausente em entradas de produto sem variação */
  skuId?: string;
  quantity: number;
  totalCost: number;
  /** custo por unidade só desta leva (totalCost / quantity) */
  unitCost: number;
  note?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Estoque por variação (SKU = combinação de opções, ex: Cor=Preta + Tamanho=P)
// ---------------------------------------------------------------------------

/** Qual opção de cada grupo compõe uma combinação — snapshot guardado no SKU. */
export interface VariantSkuComboEntry {
  groupId: string;
  groupName: string;
  optionId: string;
  optionLabel: string;
}

/**
 * Uma combinação específica de variação de um produto (ex: Preta + P), com
 * estoque e custo próprios. Gerado automaticamente a partir de `Product.variants`.
 */
export interface ProductVariantSku {
  id: string;
  productId: string;
  combo: VariantSkuComboEntry[];
  comboKey: string;
  /** rótulo pronto pra exibição, ex: "Preta / P" */
  label: string;
  stockQuantity: number;
  costPrice: number;
  /** preço de venda específico desta variação — ausente/nulo = herda price/promoPrice do produto */
  price?: number;
  promoPrice?: number;
  createdAt: string;
  updatedAt: string;
}
