'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { productInputToRow, rowToProduct, type ProductInput, type ProductRow } from '@/lib/mappers';
import type { Product } from '@/types';

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
  return {};
}

export async function updateProduct(id: string, input: ProductInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('products').update(productInputToRow(input)).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/produtos');
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
  return {};
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/produtos');
  return {};
}
