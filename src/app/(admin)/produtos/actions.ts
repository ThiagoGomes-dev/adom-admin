'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  productInputToRow,
  rowToProduct,
  rowToProductVariantSku,
  rowToStockEntry,
  type ProductInput,
  type ProductRow,
  type ProductVariantSkuRow,
  type StockEntryRow,
} from '@/lib/mappers';
import { extractStoragePath } from '@/lib/storagePath';
import type { Product, ProductVariantGroup, ProductVariantSku, StockEntry, VariantSkuComboEntry } from '@/types';

/** Todas as combinações possíveis dos grupos de variação (produto cartesiano). */
function cartesianCombos(variants: ProductVariantGroup[]): VariantSkuComboEntry[][] {
  return variants.reduce<VariantSkuComboEntry[][]>(
    (acc, group) =>
      acc.flatMap((combo) =>
        group.options.map((option) => [
          ...combo,
          { groupId: group.id, groupName: group.name, optionId: option.id, optionLabel: option.label },
        ]),
      ),
    [[]],
  );
}

/** Chave estável e independente da ordem dos grupos, pra identificar a mesma combinação. */
function comboKeyOf(combo: VariantSkuComboEntry[]): string {
  return combo
    .map((c) => `${c.groupId}:${c.optionId}`)
    .sort()
    .join('|');
}

export async function listProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ProductRow[]).map(rowToProduct);
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToProduct(data as ProductRow) : null;
}

export async function createProduct(input: ProductInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('products').insert(productInputToRow(input));
  if (error) return { error: error.message };
  revalidatePath('/produtos');
  revalidatePath('/dashboard');
  return {};
}

export async function updateProduct(id: string, input: ProductInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('products').update(productInputToRow(input)).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/produtos');
  revalidatePath('/dashboard');
  return {};
}

export async function updateStock(id: string, stockQuantity: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ stock_quantity: stockQuantity, available: stockQuantity > 0 })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/produtos');
  revalidatePath('/dashboard');
  return {};
}

export interface RestockInput {
  productId: string;
  /** quantidade de unidades que chegou nesta leva */
  quantity: number;
  /** valor total pago por essa leva (não é o custo por unidade) */
  totalCost: number;
  note?: string;
}

/**
 * Registra a chegada de mais unidades de um produto. Chama `restock_product`
 * no banco, que soma ao estoque e recalcula o custo por unidade como média
 * ponderada entre o que já havia e a nova leva — e grava o histórico em
 * `stock_entries`, tudo em uma transação só.
 */
export async function restockProduct(input: RestockInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('restock_product', {
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_total_cost: input.totalCost,
    p_note: input.note || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/produtos');
  revalidatePath(`/produtos/${input.productId}`);
  revalidatePath('/dashboard');
  return {};
}

export async function listStockEntries(productId: string): Promise<StockEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stock_entries')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as StockEntryRow[]).map(rowToStockEntry);
}

export interface ProductVariantSkusResult {
  /** SKUs que correspondem às combinações atuais de `product.variants`. */
  skus: ProductVariantSku[];
  /** SKUs de combinações que já não existem mais nas variações do produto, mas ainda têm estoque/custo — não são apagados sozinhos, pra não perder dado. */
  orphanSkus: ProductVariantSku[];
}

/**
 * Garante que existe um SKU (linha de estoque por variação) pra cada
 * combinação atual dos grupos de variação do produto — cria os que faltam
 * (com estoque 0) e retorna a lista, separando os que ficaram órfãos (a
 * variação foi removida do produto, mas o SKU ainda tem estoque/custo
 * registrado). Idempotente: pode ser chamado toda vez que a página de edição
 * é aberta.
 */
export async function listProductVariantSkus(productId: string): Promise<ProductVariantSkusResult> {
  const supabase = await createClient();

  const { data: productRow, error: productError } = await supabase
    .from('products')
    .select('variants')
    .eq('id', productId)
    .maybeSingle();
  if (productError) throw new Error(productError.message);

  const variants: ProductVariantGroup[] = productRow?.variants ?? [];
  const combos = cartesianCombos(variants);
  const currentKeys = new Set(combos.map(comboKeyOf));

  const { data: existingRows, error: existingError } = await supabase
    .from('product_variant_skus')
    .select('*')
    .eq('product_id', productId);
  if (existingError) throw new Error(existingError.message);

  const existingKeys = new Set((existingRows ?? []).map((row) => row.combo_key));
  const missing = combos.filter((combo) => !existingKeys.has(comboKeyOf(combo)));

  if (missing.length > 0) {
    const toInsert = missing.map((combo) => ({
      product_id: productId,
      combo,
      combo_key: comboKeyOf(combo),
    }));
    const { error: insertError } = await supabase.from('product_variant_skus').insert(toInsert);
    if (insertError) throw new Error(insertError.message);
  }

  const { data: finalRows, error: finalError } = await supabase
    .from('product_variant_skus')
    .select('*')
    .eq('product_id', productId)
    .order('combo_key', { ascending: true });
  if (finalError) throw new Error(finalError.message);

  const all = (finalRows as ProductVariantSkuRow[]).map(rowToProductVariantSku);

  return {
    skus: all.filter((sku) => currentKeys.has(sku.comboKey)),
    orphanSkus: all.filter((sku) => !currentKeys.has(sku.comboKey)),
  };
}

/**
 * SKUs já existentes de todos os produtos, agrupados por `productId` — usado
 * na tela de nova venda pra saber quais produtos exigem escolher uma
 * variação. Ao contrário de `listProductVariantSkus`, não cria nada: produto
 * com variação que ainda não foi aberto/distribuído no cadastro (sem SKU
 * nenhum) continua vendável como produto simples até isso acontecer.
 */
export async function listAllProductVariantSkus(): Promise<Record<string, ProductVariantSku[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('product_variant_skus').select('*');
  if (error) throw new Error(error.message);

  const byProduct: Record<string, ProductVariantSku[]> = {};
  for (const row of (data as ProductVariantSkuRow[]) ?? []) {
    const sku = rowToProductVariantSku(row);
    (byProduct[sku.productId] ??= []).push(sku);
  }
  return byProduct;
}

export interface RestockVariantsInput {
  productId: string;
  /** quantidade total do lote que chegou */
  totalQuantity: number;
  /** valor total pago pelo lote inteiro */
  totalCost: number;
  /** como o lote foi distribuído entre as variações — a soma precisa bater com `totalQuantity` */
  allocations: { skuId: string; quantity: number }[];
  note?: string;
}

/**
 * Registra a chegada de um lote e distribui entre as variações do produto.
 * Chama `restock_product_variants` no banco, que exige que a soma das
 * alocações feche com `totalQuantity` (reconciliação obrigatória) antes de
 * gravar qualquer coisa.
 */
export async function restockProductVariants(input: RestockVariantsInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('restock_product_variants', {
    p_product_id: input.productId,
    p_total_quantity: input.totalQuantity,
    p_total_cost: input.totalCost,
    p_allocations: input.allocations.map((a) => ({ sku_id: a.skuId, quantity: a.quantity })),
    p_note: input.note || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/produtos');
  revalidatePath(`/produtos/${input.productId}`);
  revalidatePath('/dashboard');
  return {};
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase.from('products').select('images').eq('id', id).maybeSingle();
  const existingImages = (existing?.images ?? []) as string[];
  const paths = existingImages.map(extractStoragePath).filter((p): p is string => Boolean(p));
  if (paths.length) {
    await supabase.storage.from('product-images').remove(paths);
  }

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/produtos');
  revalidatePath('/dashboard');
  return {};
}
