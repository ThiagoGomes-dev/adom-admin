import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPayment, validateWebhookSignature, type MpPaymentResult } from '@/lib/mercadopago';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `confirm_order`/`cancel_order` recusam pedido que não está mais `pending` — dois webhooks do mesmo pagamento chegando juntos caem aqui, não é erro de verdade. */
function isAlreadyProcessedError(message: string): boolean {
  return message.includes('Pedido já foi');
}

/**
 * `enforce` (padrão): notificação com x-signature inválida é recusada (401).
 * `log`: só registra no log e segue — seguro porque nada aqui confia no corpo
 * da notificação (o pagamento é sempre relido na API com o nosso token), e
 * útil enquanto a assinatura secreta do painel do MP não bate com a usada
 * pra assinar as notificações.
 */
function signatureMode(): 'enforce' | 'log' {
  return process.env.MP_WEBHOOK_SIGNATURE_MODE === 'log' ? 'log' : 'enforce';
}

/**
 * Traduz o meio de pagamento do MP pro `PaymentMethod` do painel ('pix' |
 * 'credito' | 'dinheiro'). Débito, saldo em conta etc. não têm equivalente —
 * ficam `null` aqui, mas o valor exato fica em mp_payment_type/mp_payment_method.
 */
function toPanelPaymentMethod(typeId: string | undefined, methodId: string | undefined): string | null {
  if (methodId === 'pix' || typeId === 'bank_transfer') return 'pix';
  if (typeId === 'credit_card') return 'credito';
  return null;
}

/** Erro 404 da API do MP = id de pagamento que não é da nossa conta (ou inventado). */
function isNotFound(err: unknown): boolean {
  return (err as { status?: number })?.status === 404;
}

/**
 * Webhook do Mercado Pago — avisa quando um pagamento muda de status.
 *
 * Nunca confia no corpo da notificação: o id recebido só serve pra buscar o
 * pagamento de verdade na API do MP, e é o status/valor que a API devolve
 * que decide o que acontece com o pedido. A assinatura (x-signature) é uma
 * camada extra; notificações IPN legadas nem trazem ela.
 *
 * Idempotente: o Mercado Pago reenvia a mesma notificação várias vezes, e
 * `confirm_order`/`cancel_order` só agem sobre pedido ainda `pending` (com
 * lock de linha no banco), então processar duas vezes não duplica venda.
 *
 * Respostas: 2xx = "recebi, não reenvie"; 5xx = "falhei, reenvie depois".
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => null)) as
    | { type?: string; topic?: string; data?: { id?: string | number } }
    | null;

  const topic = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body?.type ?? body?.topic ?? null;
  if (topic && topic !== 'payment') {
    // merchant_order, chargebacks etc. — não é o que esse endpoint trata
    return NextResponse.json({ ok: true, ignored: topic });
  }

  const queryDataId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
  const paymentId = queryDataId ?? (body?.data?.id != null ? String(body.data.id) : null);
  if (!paymentId || !/^\d+$/.test(paymentId)) {
    console.warn('[MP webhook] notificação sem id de pagamento válido', { url: request.url });
    return NextResponse.json({ error: 'missing payment id' }, { status: 400 });
  }

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  if (xSignature) {
    try {
      // o manifest usa o data.id da query string, não o do corpo
      validateWebhookSignature({ xSignature, xRequestId, dataId: queryDataId });
    } catch (err) {
      const reason = (err as { reason?: string })?.reason ?? (err as Error)?.message;
      if (signatureMode() === 'enforce') {
        console.error('[MP webhook] assinatura inválida — recusado', { reason, xRequestId, paymentId });
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
      }
      console.warn('[MP webhook] assinatura inválida — seguindo (modo log)', { reason, xRequestId, paymentId });
    }
  }

  let payment: MpPaymentResult;
  try {
    payment = await fetchPayment(paymentId);
  } catch (err) {
    if (isNotFound(err)) {
      console.warn('[MP webhook] pagamento não existe nesta conta — ignorando', { paymentId });
      return NextResponse.json({ ok: true });
    }
    console.error('[MP webhook] falha ao buscar pagamento no Mercado Pago', { paymentId, err });
    return NextResponse.json({ error: 'failed to fetch payment' }, { status: 502 });
  }

  const orderId = payment.externalReference;
  if (!orderId || !UUID_REGEX.test(orderId)) {
    // pagamento que não saiu do nosso checkout (link avulso, maquininha etc.)
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, total, shipping_cost, payment_reference, note')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) {
    console.error('[MP webhook] falha ao ler pedido', { orderId, message: orderError.message });
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }
  if (!order) {
    console.warn('[MP webhook] external_reference não corresponde a nenhum pedido', { orderId, paymentId });
    return NextResponse.json({ ok: true });
  }

  const log = { orderId, paymentId, paymentStatus: payment.status, orderStatus: order.status };

  if (payment.status === 'approved') {
    if (order.status === 'confirmed') {
      return NextResponse.json({ ok: true, already: 'confirmed' });
    }

    if (order.status === 'cancelled') {
      // Pago depois de o pedido ter expirado/sido cancelado: o estoque já
      // voltou pra loja. Não dá pra simplesmente confirmar — sinaliza no
      // pedido pra alguém decidir (enviar a peça mesmo assim ou estornar).
      if (order.payment_reference !== payment.id) {
        await supabase
          .from('orders')
          .update({
            payment_reference: payment.id,
            note: `${order.note ? `${order.note} — ` : ''}ATENÇÃO: pagamento aprovado (MP ${payment.id}) depois do cancelamento. Conferir estoque e enviar, ou estornar no Mercado Pago.`,
          })
          .eq('id', orderId);
      }
      console.error('[MP webhook] pagamento aprovado para pedido cancelado', log);
      return NextResponse.json({ ok: true, attention: 'paid_after_cancel' });
    }

    // Confere o valor: o pago tem que cobrir produtos + frete (o frete entra
    // como item à parte na preference e fica gravado em shipping_cost).
    const expected = Number(order.total) + Number(order.shipping_cost ?? 0);
    if (payment.currencyId !== 'BRL' || (payment.transactionAmount ?? 0) + 0.01 < expected) {
      console.error('[MP webhook] valor/moeda do pagamento não confere com o pedido — não confirmado', {
        ...log,
        expected,
        paid: payment.transactionAmount,
        currency: payment.currencyId,
      });
      return NextResponse.json({ ok: true, attention: 'amount_mismatch' });
    }

    // Grava antes de confirmar: confirm_order copia orders.payment_method pra
    // venda, e é isso que aparece na coluna "Pagamento" do painel.
    await supabase
      .from('orders')
      .update({ payment_method: toPanelPaymentMethod(payment.paymentTypeId, payment.paymentMethodId) })
      .eq('id', orderId)
      .eq('status', 'pending');

    const { error } = await supabase.rpc('confirm_order', { p_order_id: orderId });
    if (error && !isAlreadyProcessedError(error.message)) {
      console.error('[MP webhook] falha ao confirmar pedido', { ...log, message: error.message });
      return NextResponse.json({ error: 'confirm failed' }, { status: 500 });
    }
    await supabase
      .from('orders')
      .update({
        payment_reference: payment.id,
        mp_payment_type: payment.paymentTypeId ?? null,
        mp_payment_method: payment.paymentMethodId ?? null,
        mp_installments: payment.installments ?? null,
      })
      .eq('id', orderId);
    console.log('[MP webhook] pedido confirmado', log);
    return NextResponse.json({ ok: true });
  }

  if (payment.status === 'cancelled' && order.status === 'pending') {
    // `rejected` NÃO cancela: no Checkout Pro o cliente pode tentar de novo
    // com outro cartão na mesma preference. Pedido abandonado volta pro
    // estoque pelo cron de expiração (/api/cron/expire-orders).
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
    if (error && !isAlreadyProcessedError(error.message)) {
      console.error('[MP webhook] falha ao cancelar pedido', { ...log, message: error.message });
      return NextResponse.json({ error: 'cancel failed' }, { status: 500 });
    }
    console.log('[MP webhook] pedido cancelado', log);
    return NextResponse.json({ ok: true });
  }

  if ((payment.status === 'refunded' || payment.status === 'charged_back') && order.status === 'confirmed') {
    console.error('[MP webhook] pagamento estornado/contestado em pedido já confirmado — revisar manualmente', log);
  }

  // pending | in_process | authorized | rejected: espera o próximo webhook
  return NextResponse.json({ ok: true });
}
