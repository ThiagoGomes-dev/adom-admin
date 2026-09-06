'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { rowToSale, type SaleRow } from '@/lib/mappers';
import type { PaymentMethod, Sale } from '@/types';

export async function listSales(): Promise<Sale[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SaleRow[]).map(rowToSale);
}

export interface RegisterSaleInput {
  items: { productId: string; quantity: number }[];
  paymentMethod?: PaymentMethod;
  note?: string;
}

/**
 * Registra uma venda com um ou mais produtos. Chama a função `register_sale`
 * no banco, que valida estoque e desconta tudo numa transação só — ou a venda
 * inteira é gravada, ou nada é alterado.
 */
export async function registerSale(input: RegisterSaleInput): Promise<{ error?: string; id?: string }> {
  if (!input.items.length) return { error: 'Adicione ao menos um produto.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('register_sale', {
    p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_payment_method: input.paymentMethod ?? null,
    p_note: input.note || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/vendas');
  revalidatePath('/produtos');
  return { id: data as string };
}
