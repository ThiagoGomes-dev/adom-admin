'use client';

import { useEffect, useRef } from 'react';
import { X, MapPin, User, CreditCard, Package, Clock, MessageCircle, Store } from 'lucide-react';
import type { Order } from '@/types';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/cn';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  dinheiro: 'Dinheiro',
};

const formatDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;

/** Telefone BR só com dígitos → (83) 99999-9999 */
function formatPhone(digits: string) {
  const d = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

/**
 * O site grava o endereço de entrega no campo `note`, uma informação por linha
 * (rua/número/bairro, referência, CEP e frete — ver CartDrawer.tsx do site).
 * Aqui só separamos a linha do frete do resto para exibir em blocos diferentes.
 */
function splitNote(note?: string) {
  const lines = (note ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const shipping = lines.find((l) => l.toLowerCase().startsWith('frete:'));
  const address = lines.filter((l) => l !== shipping);
  return { address, shipping: shipping?.replace(/^frete:\s*/i, '') };
}

/** payment_type_id do Mercado Pago → rótulo; bank_transfer é o Pix. */
const MP_PAYMENT_TYPES: Record<string, string> = {
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  prepaid_card: 'Cartão pré-pago',
  bank_transfer: 'Pix',
  account_money: 'Saldo do Mercado Pago',
  ticket: 'Boleto',
};

/** payment_method_id do Mercado Pago (bandeira) → rótulo. */
const MP_PAYMENT_METHODS: Record<string, string> = {
  visa: 'Visa',
  master: 'Mastercard',
  amex: 'American Express',
  elo: 'Elo',
  hipercard: 'Hipercard',
  debvisa: 'Visa',
  debmaster: 'Mastercard',
  debelo: 'Elo',
};

/** Como o cliente pagou: dados do Mercado Pago quando existem, senão o que o pedido antigo tiver. */
function paymentLabel(order: Order) {
  if (order.mpPaymentType) {
    const type = MP_PAYMENT_TYPES[order.mpPaymentType] ?? order.mpPaymentType;
    const isCard = order.mpPaymentType.endsWith('_card');
    const brand = isCard && order.mpPaymentMethod ? MP_PAYMENT_METHODS[order.mpPaymentMethod] ?? order.mpPaymentMethod : null;
    const installments =
      order.mpPaymentType === 'credit_card' && order.mpInstallments && order.mpInstallments > 1
        ? `em ${order.mpInstallments}x`
        : null;
    return [type, brand, installments].filter(Boolean).join(' · ');
  }
  if (order.paymentMethod) return PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod;
  if (order.confirmationMethod === 'mercado_pago' || order.paymentReference) return 'Mercado Pago';
  return 'Não informado';
}

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-bronze-text">
        <Icon size={14} /> {title}
      </h3>
      <div className="rounded-xl border border-line bg-slate-50/60 p-4 text-sm text-ink">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

interface OrderDetailsModalProps {
  order: Order;
  stageLabel: string;
  stageClassName: string;
  onClose: () => void;
}

export function OrderDetailsModal({ order, stageLabel, stageClassName, onClose }: OrderDetailsModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const phoneDigits = order.customerPhone?.replace(/\D/g, '');
  const { address, shipping } = splitNote(order.note);
  const itemsTotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  // `total` é só dos produtos; o frete é cobrado à parte no Mercado Pago (shipping_cost).
  // Pedidos antigos não têm shipping_cost: o frete deles só aparece no texto do endereço.
  const shippingValue = order.shippingCost ?? 0;
  const paidTotal = order.total + shippingValue;
  const isPickup = order.deliveryMethod === 'pickup';
  const deliveryLabel = isPickup ? 'Retirada na loja' : order.deliveryMethod === 'delivery' ? 'Entrega no endereço' : null;
  const payment = paymentLabel(order);

  const timeline = [
    { label: 'Pedido feito', at: formatDateTime(order.createdAt) },
    { label: 'Pagamento confirmado', at: formatDateTime(order.confirmedAt) },
    { label: 'Enviado', at: formatDateTime(order.shippedAt) },
    { label: 'Cancelado', at: formatDateTime(order.cancelledAt) },
  ].filter((t) => t.at);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button type="button" aria-label="Fechar" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[22px] bg-white shadow-2xl sm:rounded-[22px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-bronze-text">
              Pedido #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <h2 id="order-details-title" className="font-display text-2xl font-medium text-ink">
              {order.customerName || 'Cliente sem nome'}
            </h2>
            <span
              className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                stageClassName,
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {stageLabel}
            </span>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Section icon={User} title="Cliente">
              <Row label="Nome">{order.customerName || '—'}</Row>
              <Row label="Telefone">{phoneDigits ? formatPhone(phoneDigits) : '—'}</Row>
              {phoneDigits && (
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  <MessageCircle size={16} /> Chamar no WhatsApp
                </a>
              )}
            </Section>

            <Section icon={isPickup ? Store : MapPin} title="Entrega">
              {deliveryLabel && (
                <span
                  className={cn(
                    'mb-2 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                    isPickup ? 'bg-bronze/15 text-bronze-dark' : 'bg-slate-200 text-ink',
                  )}
                >
                  {deliveryLabel}
                </span>
              )}
              {isPickup ? (
                <p className="text-slate-600">O cliente vai buscar na loja. Sem frete.</p>
              ) : address.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {address.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                  {order.deliveryCep && !address.some((l) => l.startsWith('CEP')) && (
                    <span>CEP: {order.deliveryCep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}</span>
                  )}
                  {order.deliveryMethod ? (
                    <span className="mt-2 text-xs text-slate-500">
                      Frete: {shippingValue > 0 ? formatPrice(shippingValue) : 'grátis'}
                    </span>
                  ) : (
                    shipping && <span className="mt-2 text-xs text-slate-500">Frete: {shipping}</span>
                  )}
                </div>
              ) : (
                <span className="text-slate-500">Nenhum endereço informado.</span>
              )}
            </Section>
          </div>

          <Section icon={Package} title="Itens">
            <ul className="flex flex-col">
              {order.items.map((item, i) => (
                <li
                  key={`${item.productId}-${item.skuId ?? i}`}
                  className={cn('flex items-start justify-between gap-4 py-2', i > 0 && 'border-t border-line')}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-xs text-slate-500">
                      {item.variantLabel ? `${item.variantLabel} · ` : ''}
                      {item.quantity} × {formatPrice(item.unitPrice)}
                    </span>
                  </div>
                  <span className="font-semibold">{formatPrice(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-line pt-2">
              <Row label="Produtos">{formatPrice(itemsTotal)}</Row>
              {order.deliveryMethod && (
                <Row label="Frete">{shippingValue > 0 ? formatPrice(shippingValue) : isPickup ? 'Retirada' : 'Grátis'}</Row>
              )}
              <div className="flex justify-between gap-4 pt-1 text-base font-bold">
                <span>Total pago</span>
                <span>{formatPrice(paidTotal)}</span>
              </div>
            </div>
          </Section>

          <div className="grid gap-5 sm:grid-cols-2">
            <Section icon={CreditCard} title="Pagamento">
              <Row label="Forma">{payment}</Row>
              {order.paymentReference && <Row label="ID no Mercado Pago">{order.paymentReference}</Row>}
              <Row label="Confirmação">{order.confirmationMethod === 'mercado_pago' ? 'Automática' : 'Manual'}</Row>
            </Section>

            <Section icon={Clock} title="Histórico">
              {timeline.map((t) => (
                <Row key={t.label} label={t.label}>
                  {t.at}
                </Row>
              ))}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
