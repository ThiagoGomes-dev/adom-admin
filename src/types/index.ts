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
  createdAt: string;
  updatedAt: string;
}
