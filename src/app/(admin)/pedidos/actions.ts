'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { rowToOrder, type OrderRow } from '@/lib/mappers';
import type { Order } from '@/types';

export async function listOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as OrderRow[]).map(rowToOrder);
}

/**
 * Confirma um pedido pendente: vira venda de verdade em `sales` (o estoque já
 * estava debitado desde a criação do pedido) via `confirm_order` no banco.
 */
export async function confirmOrder(id: string): Promise<{ error?: string; saleId?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_order', { p_order_id: id });
  if (error) return { error: error.message };

  revalidatePath('/pedidos');
  revalidatePath('/vendas');
  revalidatePath('/dashboard');
  revalidatePath('/produtos');
  return { saleId: data as string };
}

/**
 * Cancela um pedido pendente e devolve o estoque reservado, via
 * `cancel_order` no banco.
 */
export async function cancelOrder(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_order', { p_order_id: id });
  if (error) return { error: error.message };

  revalidatePath('/pedidos');
  revalidatePath('/produtos');
  return {};
}

/**
 * Marca um pedido já pago como enviado (entrega) ou retirado (retirada) —
 * não envolve estoque/dinheiro, só uma marcação operacional, por isso é um
 * update direto (sem RPC). O código de rastreio é opcional: dá pra enviar
 * agora e informar depois com `saveTrackingCode`.
 */
export async function markOrderShipped(id: string, trackingCode?: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const code = trackingCode?.trim().toUpperCase() || null;
  const { error } = await supabase
    .from('orders')
    .update({ shipped_at: new Date().toISOString(), ...(code ? { tracking_code: code } : {}) })
    .eq('id', id)
    .eq('status', 'confirmed');
  if (error) return { error: error.message };

  revalidatePath('/pedidos');
  return {};
}

/** Grava ou corrige o código de rastreio de um pedido já pago. */
export async function saveTrackingCode(id: string, trackingCode: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const code = trackingCode.trim().toUpperCase() || null;
  const { error } = await supabase.from('orders').update({ tracking_code: code }).eq('id', id).eq('status', 'confirmed');
  if (error) return { error: error.message };

  revalidatePath('/pedidos');
  return {};
}

/** Retirada: o pedido pago foi separado e o cliente já pode buscar na loja. */
export async function markOrderReady(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('orders')
    .update({ ready_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'confirmed')
    .eq('delivery_method', 'pickup');
  if (error) return { error: error.message };

  revalidatePath('/pedidos');
  return {};
}
