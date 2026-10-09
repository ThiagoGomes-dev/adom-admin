import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchPayment, validateWebhookSignature } from '@/lib/mercadopago';

/** `confirm_order`/`cancel_order` recusam pedido que não está mais `pending` — o Mercado Pago reenvia webhook (retry), então isso é esperado, não um erro de verdade. */
function isAlreadyProcessedError(message: string): boolean {
  return message.includes('Pedido já foi') || message.includes('Pedido não encontrado');
}

/**
 * Webhook do Mercado Pago — avisa quando um pagamento muda de status.
 * Nunca confia no corpo da notificação: valida a assinatura e depois busca
 * o pagamento de verdade na API antes de agir. Server-to-server (sem CORS).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  // DEBUG TEMPORÁRIO: remover depois de descobrir a causa do SignatureMismatch.
  {
    const secretRaw = process.env.MP_WEBHOOK_SECRET ?? '';
    const secretTrimmed = secretRaw.trim();
    const parts = (xSignature ?? '').split(',').reduce<Record<string, string>>((acc, p) => {
      const [k, v] = p.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const manifest = `id:${dataId ?? ''};request-id:${xRequestId ?? ''};ts:${parts.ts ?? ''};`;
    const computedRaw = crypto.createHmac('sha256', secretRaw).update(manifest).digest('hex');
    const computedTrimmed = crypto.createHmac('sha256', secretTrimmed).update(manifest).digest('hex');
    console.log('Webhook MP debug:', {
      search: url.search,
      dataId,
      xSignature,
      xRequestId,
      manifest,
      receivedHash: parts.v1,
      secretLength: secretRaw.length,
      secretTrimmedLength: secretTrimmed.length,
      matchesRaw: computedRaw === parts.v1,
      matchesTrimmed: computedTrimmed === parts.v1,
    });
  }

  try {
    validateWebhookSignature({ xSignature, xRequestId, dataId });
  } catch (err) {
    console.error('Webhook do Mercado Pago com assinatura inválida:', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { data?: { id?: string } } | null;
  const paymentId = dataId ?? body?.data?.id;
  if (!paymentId) {
    return NextResponse.json({ error: 'missing payment id' }, { status: 400 });
  }

  let payment;
  try {
    payment = await fetchPayment(String(paymentId));
  } catch (err) {
    console.error('Falha ao buscar pagamento no Mercado Pago:', err);
    return NextResponse.json({ error: 'failed to fetch payment' }, { status: 502 });
  }

  const orderId = payment.externalReference;
  if (!orderId) {
    // pagamento sem external_reference não corresponde a nenhum pedido nosso
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();

  if (payment.status === 'approved') {
    const { error } = await supabase.rpc('confirm_order', { p_order_id: orderId });
    if (error && !isAlreadyProcessedError(error.message)) {
      console.error('Falha ao confirmar pedido via webhook', orderId, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
    if (error && !isAlreadyProcessedError(error.message)) {
      console.error('Falha ao cancelar pedido via webhook', orderId, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  // 'pending' | 'in_process': nada a fazer ainda — espera o próximo webhook

  return NextResponse.json({ ok: true });
}
