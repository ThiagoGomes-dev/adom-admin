import type { Category, Product, ProductVariantGroup } from '@/types';

/** Formato de uma linha da tabela `products` no Postgres (snake_case). */
export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  short_description: string | null;
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
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description ?? undefined,
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
  };
}

/** Payload aceito pelos formulários do admin (sem id/timestamps). */
export interface ProductInput {
  slug: string;
  name: string;
  description: string;
  shortDescription?: string;
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

export function productInputToRow(input: ProductInput) {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    short_description: input.shortDescription || null,
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
