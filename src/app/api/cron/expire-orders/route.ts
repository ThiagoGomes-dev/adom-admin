import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentWindowMinutes, searchPaymentsForOrder } from '@/lib/mercadopago';

/** folga depois da expiração do link, pra pegar pagamento aprovado no último minuto */
const GRACE_MINUTES = 15;
const BATCH_LIMIT = 50;
const STILL_ALIVE_STATUSES = new Set(['approved', 'authorized', 'pending', 'in_process']);

/**
 * Devolve ao estoque os pedidos do Mercado Pago que ficaram pendentes depois
 * de o link de pagamento expirar (cliente abandonou o checkout). Antes de
 * cancelar, confere na API do MP que não existe pagamento aprovado ou em
 * análise pra aquele pedido — se existir, deixa como está (o webhook resolve).
 *
 * Chamado pelo Vercel Cron (ver vercel.json), que manda
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - (getPaymentWindowMinutes() + GRACE_MINUTES) * 60_000);
  const supabase = createAdminClient();
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'pending')
    .eq('confirmation_method', 'mercado_pago')
    .lt('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('[cron expire-orders] falha ao listar pedidos', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cancelled: string[] = [];
  const kept: string[] = [];
  for (const { id } of orders ?? []) {
    try {
      const payments = await searchPaymentsForOrder(id);
      if (payments.some((p) => p.status && STILL_ALIVE_STATUSES.has(p.status))) {
        kept.push(id);
        continue;
      }
      const { error: cancelError } = await supabase.rpc('cancel_order', { p_order_id: id });
      if (cancelError) {
        console.error('[cron expire-orders] falha ao cancelar', id, cancelError.message);
        continue;
      }
      cancelled.push(id);
    } catch (err) {
      // MP fora do ar: tenta de novo na próxima execução
      console.error('[cron expire-orders] falha ao consultar pagamentos', id, err);
    }
  }

  console.log('[cron expire-orders]', { cancelled: cancelled.length, kept });
  return NextResponse.json({ cancelled, kept });
}
