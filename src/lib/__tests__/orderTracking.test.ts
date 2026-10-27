import { describe, expect, it } from 'vitest';
import type { Order } from '@/types';
import {
  customerMessage,
  isValidEmail,
  mailtoLink,
  matchesOrderCode,
  orderCode,
  stageOf,
  toPublicOrder,
  whatsappLink,
} from '../orderTracking';

const ID = '7f3a2c1d-0000-4000-8000-000000000001';

function order(patch: Partial<Order> = {}): Order {
  return {
    id: ID,
    items: [{ productId: 'p1', name: 'Camisa Linho', variantLabel: 'Azul / M', quantity: 2, unitPrice: 100, unitCost: 40 }],
    total: 200,
    totalCost: 80,
    paymentMethod: null,
    customerName: 'Maria Souza',
    customerPhone: '83999998888',
    customerEmail: 'maria@exemplo.com',
    note: 'Rua A, 10',
    status: 'pending',
    confirmationMethod: 'mercado_pago',
    paymentReference: '123',
    createdAt: '2026-10-27T10:00:00Z',
    deliveryMethod: 'delivery',
    shippingCost: 25,
    ...patch,
  };
}

describe('stageOf', () => {
  it('separa o pedido pago conforme a entrega', () => {
    expect(stageOf(order())).toBe('pending');
    expect(stageOf(order({ status: 'confirmed' }))).toBe('toShip');
    expect(stageOf(order({ status: 'confirmed', readyAt: '2026-10-27T11:00:00Z' }))).toBe('ready');
    expect(stageOf(order({ status: 'confirmed', readyAt: 'x', shippedAt: '2026-10-27T12:00:00Z' }))).toBe('shipped');
    expect(stageOf(order({ status: 'cancelled' }))).toBe('cancelled');
  });
});

describe('número curto do pedido', () => {
  it('usa os 8 primeiros caracteres em maiúsculas', () => {
    expect(orderCode(ID)).toBe('7F3A2C1D');
  });

  it('aceita o número com #, minúsculas e espaços', () => {
    expect(matchesOrderCode(ID, ' #7f3a2c1d ')).toBe(true);
    expect(matchesOrderCode(ID, '7F3A2C1D')).toBe(true);
  });

  it('não aceita número parcial ou de outro pedido', () => {
    expect(matchesOrderCode(ID, '7F3A')).toBe(false);
    expect(matchesOrderCode(ID, '7F3A2C1E')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('valida o formato básico', () => {
    expect(isValidEmail('maria@exemplo.com')).toBe(true);
    expect(isValidEmail('maria@exemplo')).toBe(false);
    expect(isValidEmail('maria exemplo.com')).toBe(false);
  });
});

describe('toPublicOrder', () => {
  it('não expõe telefone, e-mail, endereço nem custo', () => {
    const pub = toPublicOrder(order());
    const json = JSON.stringify(pub);
    expect(json).not.toContain('83999998888');
    expect(json).not.toContain('maria@exemplo.com');
    expect(json).not.toContain('Rua A');
    expect(json).not.toContain('unitCost');
    expect(pub.customerFirstName).toBe('Maria');
    expect(pub.total).toBe(225);
    expect(pub.code).toBe('7F3A2C1D');
  });
});

describe('customerMessage', () => {
  const site = 'https://www.adomformen.com.br/';

  it('leva o link da página do pedido', () => {
    const msg = customerMessage(order({ status: 'confirmed' }), site);
    expect(msg.subject).toBe('Pedido #7F3A2C1D: pagamento confirmado');
    expect(msg.body).toContain(`https://www.adomformen.com.br/pedido/${ID}`);
    expect(msg.body.startsWith('Olá, Maria!')).toBe(true);
  });

  it('inclui o rastreio quando enviado', () => {
    const msg = customerMessage(order({ status: 'confirmed', shippedAt: 'x', trackingCode: 'AA123456789BR' }), site);
    expect(msg.body).toContain('AA123456789BR');
  });

  it('avisa pronto para retirada', () => {
    const msg = customerMessage(order({ status: 'confirmed', deliveryMethod: 'pickup', readyAt: 'x' }), site);
    expect(msg.subject).toContain('pronto para retirada');
  });
});

describe('links de contato', () => {
  it('prefixa 55 no WhatsApp e codifica o texto', () => {
    expect(whatsappLink('83999998888', 'Olá!')).toBe('https://wa.me/5583999998888?text=Ol%C3%A1!');
    expect(whatsappLink('5583999998888', '')).toBe('https://wa.me/5583999998888');
  });

  it('monta o mailto com assunto e corpo', () => {
    expect(mailtoLink('a@b.com', { subject: 'Oi', body: 'Linha 1\nLinha 2' })).toBe(
      'mailto:a@b.com?subject=Oi&body=Linha%201%0ALinha%202',
    );
  });
});
