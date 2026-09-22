'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  productInputToRow,
  rowToProduct,
  rowToStockEntry,
  type ProductInput,
  type ProductRow,
  type StockEntryRow,
} from '@/lib/mappers';
import { extractStoragePath } from '@/lib/storagePath';
import type { Product, StockEntry } from '@/types';

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
