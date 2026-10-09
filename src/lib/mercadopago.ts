import { MercadoPagoConfig, Payment, Preference, WebhookSignatureValidator } from 'mercadopago';
import type { SaleItem } from '@/types';

function getConfig(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN não configurado.');
  }
  return new MercadoPagoConfig({ accessToken });
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
    },
  });

  if (!response.id || !response.init_point) {
    throw new Error('Mercado Pago não retornou os dados esperados ao criar a preference.');
  }

  return { preferenceId: response.id, checkoutUrl: response.init_point };
}

export interface MpPaymentResult {
  status: string | undefined;
  externalReference: string | undefined;
}

/**
 * Busca o pagamento de verdade na API do Mercado Pago a partir do id
 * recebido no webhook — nunca confiamos no status que vem no corpo da
 * notificação, só no que a própria API confirma na hora.
 */
export async function fetchPayment(paymentId: string): Promise<MpPaymentResult> {
  const payment = new Payment(getConfig());
  const response = await payment.get({ id: paymentId });
  return { status: response.status, externalReference: response.external_reference };
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
  // DEBUG temporário — nunca loga o segredo inteiro, só o suficiente pra
  // detectar espaço/quebra de linha sobrando ou valor truncado.
  console.log('[MP webhook] secret debug', {
    length: secret.length,
    preview: `${secret.slice(0, 4)}...${secret.slice(-4)}`,
    hasWhitespace: /\s/.test(secret),
  });
  WebhookSignatureValidator.validate({
    xSignature: params.xSignature,
    xRequestId: params.xRequestId,
    dataId: params.dataId,
    secret,
  });
}
