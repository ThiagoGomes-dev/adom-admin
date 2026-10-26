import { MercadoPagoConfig, Payment, Preference, WebhookSignatureValidator } from 'mercadopago';
import type { SaleItem } from '@/types';

function getConfig(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN não configurado.');
  }
  return new MercadoPagoConfig({ accessToken });
}

/**
 * Por quanto tempo o link do Checkout Pro fica válido depois de criado. O
 * estoque fica reservado nesse meio-tempo — passou disso sem pagamento, o
 * cron `/api/cron/expire-orders` cancela o pedido e devolve o estoque.
 */
export function getPaymentWindowMinutes(): number {
  const value = Number(process.env.MP_PAYMENT_WINDOW_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : 60;
}

export interface CreatedPreference {
  preferenceId: string;
  checkoutUrl: string;
}

/**
 * Cria a preference do Checkout Pro pra um pedido que já existe (estoque já
 * reservado por `create_order`) — `external_reference` é o id do pedido, é
 * isso que o webhook usa pra achar o pedido de volta quando o Mercado Pago
 * confirmar (ou recusar) o pagamento.
 */
export async function createPreferenceForOrder(
  orderId: string,
  items: SaleItem[],
  shippingCost = 0,
): Promise<CreatedPreference> {
  const adminUrl = process.env.ADMIN_URL;
  const storefrontUrl = process.env.STOREFRONT_URL;
  if (!adminUrl) throw new Error('ADMIN_URL não configurado (necessário pra montar o notification_url do webhook).');
  if (!storefrontUrl) throw new Error('STOREFRONT_URL não configurado (necessário pra montar os back_urls).');

  const preferenceItems = items.map((item, index) => ({
    id: `${orderId}-${index}`,
    title: item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    currency_id: 'BRL',
  }));

  // Frete entra como um item à parte — assim o valor cobrado no Mercado
  // Pago já fecha com produtos + entrega, sem precisar de uma segunda
  // cobrança depois.
  if (shippingCost > 0) {
    preferenceItems.push({
      id: `${orderId}-shipping`,
      title: 'Frete',
      quantity: 1,
      unit_price: shippingCost,
      currency_id: 'BRL',
    });
  }

  // Link e Pix expiram junto com a reserva de estoque. Boleto fica de fora:
  // leva até 3 dias úteis pra compensar, e o estoque não pode ficar preso
  // esse tempo todo (nem o pedido ser cancelado com o boleto ainda válido).
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getPaymentWindowMinutes() * 60_000);

  const preference = new Preference(getConfig());
  const response = await preference.create({
    body: {
      items: preferenceItems,
      external_reference: orderId,
      notification_url: `${adminUrl}/api/webhooks/mercadopago`,
      back_urls: {
        success: `${storefrontUrl}/pedido/sucesso?order=${orderId}`,
        pending: `${storefrontUrl}/pedido/pendente?order=${orderId}`,
        failure: `${storefrontUrl}/pedido/falha?order=${orderId}`,
      },
      auto_return: 'approved',
      expires: true,
      expiration_date_from: now.toISOString(),
      expiration_date_to: expiresAt.toISOString(),
      date_of_expiration: expiresAt.toISOString(),
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }],
      },
    },
  });

  if (!response.id || !response.init_point) {
    throw new Error('Mercado Pago não retornou os dados esperados ao criar a preference.');
  }

  return { preferenceId: response.id, checkoutUrl: response.init_point };
}

export interface MpPaymentResult {
  id: string;
  status: string | undefined;
  statusDetail: string | undefined;
  externalReference: string | undefined;
  transactionAmount: number | undefined;
  currencyId: string | undefined;
}

/**
 * Busca o pagamento de verdade na API do Mercado Pago a partir do id
 * recebido no webhook — nunca confiamos no status que vem no corpo da
 * notificação, só no que a própria API confirma na hora.
 */
export async function fetchPayment(paymentId: string): Promise<MpPaymentResult> {
  const payment = new Payment(getConfig());
  const response = await payment.get({ id: paymentId });
  return {
    id: String(response.id ?? paymentId),
    status: response.status,
    statusDetail: response.status_detail,
    externalReference: response.external_reference,
    transactionAmount: response.transaction_amount,
    currencyId: response.currency_id,
  };
}

/**
 * Pagamentos já feitos pra um pedido (via `external_reference`) — usado pelo
 * cron de expiração pra nunca cancelar um pedido que tem pagamento aprovado
 * ou ainda em análise e só não teve o webhook processado.
 */
export async function searchPaymentsForOrder(orderId: string): Promise<{ id: string; status: string | undefined }[]> {
  const payment = new Payment(getConfig());
  const response = await payment.search({ options: { external_reference: orderId } });
  return (response.results ?? []).map((p) => ({ id: String(p.id), status: p.status }));
}

/** Valida a assinatura do webhook (`x-signature`/`x-request-id`) contra `MP_WEBHOOK_SECRET`. Lança se inválida. */
export function validateWebhookSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): void {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('MP_WEBHOOK_SECRET não configurado.');
  }
  WebhookSignatureValidator.validate({
    xSignature: params.xSignature,
    xRequestId: params.xRequestId,
    // a doc do Mercado Pago pede o data.id em minúsculas quando é alfanumérico
    dataId: params.dataId?.toLowerCase() ?? null,
    secret: secret.trim(),
    // sem toleranceSeconds de propósito: replay de notificação velha não faz
    // estrago (o webhook sempre relê o pagamento na API e só age se o pedido
    // ainda estiver pendente), e não há garantia de que o `ts` muda nos retries.
  });
}
