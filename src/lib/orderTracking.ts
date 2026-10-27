import type { Order } from '@/types';
import { formatPrice } from '@/lib/currency';

/**
 * Situação do pedido como o cliente e o painel enxergam. `confirmed` no banco
 * se divide conforme a entrega: entrega → pago / enviado; retirada → pago /
 * pronto para retirada / retirado (o `shipped_at` marca a retirada).
 */
export type OrderStage = 'pending' | 'toShip' | 'ready' | 'shipped' | 'cancelled';

export function stageOf(order: Pick<Order, 'status' | 'shippedAt' | 'readyAt'>): OrderStage {
  if (order.status !== 'confirmed') return order.status;
  if (order.shippedAt) return 'shipped';
  if (order.readyAt) return 'ready';
  return 'toShip';
}

/** Número curto do pedido, o mesmo que o cliente vê no site: 8 primeiros caracteres do id. */
export function orderCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** Confere o número curto digitado pelo cliente (com ou sem #, maiúsculas ou não) contra o id do pedido. */
export function matchesOrderCode(id: string, code: string): boolean {
  const normalized = code.trim().replace(/^#/, '').toLowerCase();
  return normalized.length === 8 && id.toLowerCase().startsWith(normalized);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** Endereço da página "Meu pedido" no site. */
export function orderPageUrl(storefrontUrl: string, orderId: string): string {
  return `${storefrontUrl.replace(/\/$/, '')}/pedido/${orderId}`;
}

/**
 * O que a página pública "Meu pedido" recebe. Só o necessário pro cliente
 * acompanhar: nada de telefone, e-mail, endereço, custo ou id de pagamento —
 * quem tiver o link (ele circula por WhatsApp) não vê dado pessoal além do
 * primeiro nome.
 */
export interface PublicOrder {
  id: string;
  code: string;
  stage: OrderStage;
  deliveryMethod: 'delivery' | 'pickup' | null;
  customerFirstName: string | null;
  items: { name: string; variantLabel: string | null; quantity: number; unitPrice: number }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  trackingCode: string | null;
  createdAt: string;
  confirmedAt: string | null;
  readyAt: string | null;
  shippedAt: string | null;
  cancelledAt: string | null;
}

export function toPublicOrder(order: Order): PublicOrder {
  const firstName = order.customerName?.trim().split(/\s+/)[0] || null;
  return {
    id: order.id,
    code: orderCode(order.id),
    stage: stageOf(order),
    deliveryMethod: order.deliveryMethod ?? null,
    customerFirstName: firstName,
    items: order.items.map((item) => ({
      name: item.name,
      variantLabel: item.variantLabel ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    subtotal: order.total,
    shippingCost: order.shippingCost ?? 0,
    total: order.total + (order.shippingCost ?? 0),
    trackingCode: order.trackingCode ?? null,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt ?? null,
    readyAt: order.readyAt ?? null,
    shippedAt: order.shippedAt ?? null,
    cancelledAt: order.cancelledAt ?? null,
  };
}

export interface CustomerMessage {
  subject: string;
  body: string;
}

/**
 * Texto pronto pra avisar o cliente da etapa atual — o mesmo texto vai no
 * botão de WhatsApp e no de e-mail do painel (envio manual pelo funcionário).
 */
export function customerMessage(order: Order, storefrontUrl: string): CustomerMessage {
  const code = orderCode(order.id);
  const name = order.customerName?.trim().split(/\s+/)[0];
  const hello = name ? `Olá, ${name}!` : 'Olá!';
  const link = orderPageUrl(storefrontUrl, order.id);
  const follow = `Acompanhe seu pedido aqui: ${link}`;
  const signature = 'Equipe ADOM';
  const stage = stageOf(order);
  const isPickup = order.deliveryMethod === 'pickup';

  const lines = (subject: string, ...paragraphs: string[]): CustomerMessage => ({
    subject,
    body: [hello, ...paragraphs, follow, signature].join('\n\n'),
  });

  switch (stage) {
    case 'pending':
      return lines(
        `Pedido #${code}: aguardando pagamento`,
        `Recebemos seu pedido #${code} no valor de ${formatPrice(order.total + (order.shippingCost ?? 0))}, mas o pagamento ainda não foi confirmado.`,
        'Se precisar de ajuda para concluir, é só responder esta mensagem.',
      );
    case 'toShip':
      return lines(
        `Pedido #${code}: pagamento confirmado`,
        `O pagamento do seu pedido #${code} foi confirmado.`,
        isPickup
          ? 'Estamos separando suas peças e avisamos assim que estiver pronto para retirada.'
          : 'Estamos separando suas peças e avisamos assim que for enviado, com o código de rastreio.',
      );
    case 'ready':
      return lines(
        `Pedido #${code}: pronto para retirada`,
        `Seu pedido #${code} está separado e pronto para retirada na loja.`,
        'É só informar o número do pedido no balcão.',
      );
    case 'shipped':
      if (isPickup) {
        return lines(`Pedido #${code}: retirado`, `Seu pedido #${code} foi retirado. Obrigado pela compra!`);
      }
      return lines(
        `Pedido #${code}: enviado`,
        `Seu pedido #${code} foi enviado!`,
        order.trackingCode
          ? `Código de rastreio: ${order.trackingCode}\nRastreie em https://rastreamento.correios.com.br`
          : 'Assim que tivermos o código de rastreio, enviamos para você.',
      );
    case 'cancelled':
      return lines(
        `Pedido #${code}: não concluído`,
        `O pagamento do pedido #${code} não foi concluído e as peças voltaram para o estoque.`,
        'Se ainda quiser as peças, é só montar o pedido de novo no site ou responder esta mensagem.',
      );
  }
}

/** Link do WhatsApp com a mensagem pronta. Telefone salvo só com DDD + número → prefixa 55. */
export function whatsappLink(phoneDigits: string, text: string): string {
  const phone = phoneDigits.length <= 11 ? `55${phoneDigits}` : phoneDigits;
  return text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`;
}

export function mailtoLink(email: string, message: CustomerMessage): string {
  return `mailto:${email}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
}
