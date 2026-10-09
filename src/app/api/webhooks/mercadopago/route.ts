import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchPayment, validateWebhookSignature } from '@/lib/mercadopago';

/** `confirm_order`/`cancel_order` recusam pedido que não está mais `pending` — o Mercado Pago reenvia webhook (retry), então isso é esperado, não um erro de verdade. */
function isAlreadyProcessedError(message: string): boolean {
  return message.includes('Pedido já foi') || message.includes('Pedido não encontrado');
}

/**
 * Webhook do Mercado Pago — avisa quando um pagamento muda de status.
 * Nunca confia no corpo da notificação: quando vem assinatura (Webhooks v2),
 * ela precisa ser válida; notificações IPN legadas não trazem x-signature,
 * então nesse caso a verificação real fica só por conta do passo seguinte,
 * que busca o pagamento de verdade na API antes de agir. Server-to-server
 * (sem CORS).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic') ?? url.searchParams.get('type');

  // DEBUG temporário — remover depois de confirmar o IPN em produção.
  // (force redeploy: garantir que MP_WEBHOOK_SECRET novo entra no build)
  console.log('[MP webhook] request recebida', {
    url: request.url,
    topic,
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
  });

  if (topic && topic !== 'payment') {
    // merchant_order, chargebacks, etc. — não é o que esse endpoint trata
    console.log('[MP webhook] ignorado: topic != payment', topic);
    return NextResponse.json({ ok: true });
  }

  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  if (xSignature) {
    try {
      validateWebhookSignature({ xSignature, xRequestId, dataId });
      console.log('[MP webhook] assinatura validada com sucesso');
    } catch (err) {
      console.error('[MP webhook] assinatura inválida:', err);
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => null)) as { data?: { id?: string } } | null;
  const paymentId = dataId ?? body?.data?.id;
  console.log('[MP webhook] paymentId resolvido', { dataId, bodyDataId: body?.data?.id, paymentId });
  if (!paymentId) {
    console.error('[MP webhook] sem paymentId — abortando', { url: request.url, body });
    return NextResponse.json({ error: 'missing payment id' }, { status: 400 });
  }

  let payment;
  try {
    payment = await fetchPayment(String(paymentId));
    console.log('[MP webhook] pagamento buscado na API do MP', payment);
  } catch (err) {
    console.error('[MP webhook] falha ao buscar pagamento no Mercado Pago:', err);
    return NextResponse.json({ error: 'failed to fetch payment' }, { status: 502 });
  }

  const orderId = payment.externalReference;
  if (!orderId) {
    // pagamento sem external_reference não corresponde a nenhum pedido nosso
    console.log('[MP webhook] pagamento sem external_reference — ignorando');
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();

  if (payment.status === 'approved') {
    const { error } = await supabase.rpc('confirm_order', { p_order_id: orderId });
    if (error && !isAlreadyProcessedError(error.message)) {
      console.error('[MP webhook] falha ao confirmar pedido', orderId, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log('[MP webhook] confirm_order OK (ou já processado)', orderId, error?.message);
  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
    if (error && !isAlreadyProcessedError(error.message)) {
      console.error('[MP webhook] falha ao cancelar pedido', orderId, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log('[MP webhook] cancel_order OK (ou já processado)', orderId, error?.message);
  } else {
    console.log('[MP webhook] status ainda não final, nada a fazer', payment.status);
  }
  // 'pending' | 'in_process': nada a fazer ainda — espera o próximo webhook

  return NextResponse.json({ ok: true });
}
