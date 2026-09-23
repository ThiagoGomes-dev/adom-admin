import type {
  Category,
  PaymentMethod,
  Product,
  ProductVariantGroup,
  ProductVariantSku,
  Sale,
  StockEntry,
  VariantSkuComboEntry,
} from '@/types';

/** Formato de uma linha da tabela `products` no Postgres (snake_case). */
export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  short_description: string | null;
  cost_price: number;
  price: number;
  promo_price: number | null;
  images: string[];
  category_slug: string | null;
  variants: ProductVariantGroup[];
  available: boolean;
  featured: boolean;
  tags: string[];
  stock_quantity: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  image: string | null;
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description ?? undefined,
    costPrice: Number(row.cost_price ?? 0),
    price: Number(row.price),
    promoPrice: row.promo_price != null ? Number(row.promo_price) : undefined,
    images: row.images ?? [],
    category: row.category_slug ?? '',
    variants: row.variants ?? [],
    available: row.available,
    featured: row.featured,
    tags: row.tags ?? [],
    stockQuantity: row.stock_quantity,
  };
}

export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon ?? undefined,
    image: row.image ?? undefined,
  };
}

/** Payload aceito pelos formulários do admin (sem id/timestamps). */
export interface ProductInput {
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

export interface SaleRow {
  id: string;
  items: Array<{
    product_id: string;
    sku_id?: string | null;
    variant_label?: string | null;
    name: string;
    quantity: number;
    unit_price: number;
    unit_cost: number;
  }>;
  total: number;
  total_cost: number;
  payment_method: string | null;
  note: string | null;
  created_at: string;
}

export function rowToSale(row: SaleRow): Sale {
  return {
    id: row.id,
    items: (row.items ?? []).map((i) => ({
      productId: i.product_id,
      skuId: i.sku_id ?? undefined,
      variantLabel: i.variant_label ?? undefined,
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      unitCost: Number(i.unit_cost ?? 0),
    })),
    total: Number(row.total),
    totalCost: Number(row.total_cost ?? 0),
    paymentMethod: (row.payment_method as PaymentMethod) ?? null,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

export interface StockEntryRow {
  id: string;
  product_id: string;
  sku_id?: string | null;
  quantity: number;
  total_cost: number;
  unit_cost: number;
  note: string | null;
  created_at: string;
}

export function rowToStockEntry(row: StockEntryRow): StockEntry {
  return {
    id: row.id,
    productId: row.product_id,
    skuId: row.sku_id ?? undefined,
    quantity: row.quantity,
    totalCost: Number(row.total_cost),
    unitCost: Number(row.unit_cost),
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

/** Formato de uma linha da tabela `product_variant_skus` no Postgres (snake_case). */
export interface ProductVariantSkuRow {
  id: string;
  product_id: string;
  combo: VariantSkuComboEntry[];
  combo_key: string;
  stock_quantity: number;
  cost_price: number;
  price: number | null;
  promo_price: number | null;
  created_at: string;
  updated_at: string;
}

function comboLabel(combo: VariantSkuComboEntry[]): string {
  return combo.map((c) => c.optionLabel).join(' / ');
}

export function rowToProductVariantSku(row: ProductVariantSkuRow): ProductVariantSku {
  return {
    id: row.id,
    productId: row.product_id,
    combo: row.combo ?? [],
    comboKey: row.combo_key,
    label: comboLabel(row.combo ?? []),
    stockQuantity: row.stock_quantity,
    costPrice: Number(row.cost_price ?? 0),
    price: row.price != null ? Number(row.price) : undefined,
    promoPrice: row.promo_price != null ? Number(row.promo_price) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Anexa a cada produto o estoque por variação (quando existir), no formato
 * que o site consome: `selection` é nome do grupo -> rótulo da opção — o
 * mesmo formato já usado em `selectedVariants` no storefront, pra não exigir
 * nenhuma mudança de identidade de variante por lá. Produto sem SKUs cadastrados
 * simplesmente não ganha o campo, e o site cai no comportamento de sempre
 * (estoque único do produto).
 */
export function attachVariantStock<T extends { id: string }>(
  products: T[],
  skuRows: ProductVariantSkuRow[],
): Array<
  T & {
    variantStock?: { selection: Record<string, string>; stockQuantity: number; price?: number; promoPrice?: number }[];
  }
> {
  const byProduct = new Map<string, ProductVariantSkuRow[]>();
  for (const row of skuRows) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row);
    byProduct.set(row.product_id, list);
  }

  return products.map((product) => {
    const rows = byProduct.get(product.id);
    if (!rows || rows.length === 0) return product;

    const variantStock = rows.map((row) => ({
      selection: Object.fromEntries((row.combo ?? []).map((c) => [c.groupName, c.optionLabel])),
      stockQuantity: row.stock_quantity,
      ...(row.price != null ? { price: Number(row.price) } : {}),
      ...(row.promo_price != null ? { promoPrice: Number(row.promo_price) } : {}),
    }));

    return { ...product, variantStock };
  });
}

export function productInputToRow(input: ProductInput) {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    short_description: input.shortDescription || null,
    cost_price: input.costPrice,
    price: input.price,
    promo_price: input.promoPrice ?? null,
    images: input.images,
    category_slug: input.category || null,
    variants: input.variants,
    available: input.available,
    featured: input.featured,
    tags: input.tags,
    stock_quantity: input.stockQuantity,
  };
}
