'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Truck } from 'lucide-react';
import type { Order } from '@/types';
import { formatPrice } from '@/lib/currency';
import { confirmOrder, cancelOrder, markOrderShipped } from './actions';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  dinheiro: 'Dinheiro',
};

const STATUS_BADGE: Record<Order['status'], { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmado', className: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-200 text-slate-600' },
};

/** Lista de pedidos recebidos pelo site — espelha SalesTable.tsx, com status e ações de confirmar/cancelar só enquanto pendente. */
export function OrdersTable({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleConfirm = async (order: Order) => {
    if (!confirm(`Confirmar a venda de ${formatPrice(order.total)}? Isso registra a venda em "Vendas".`)) return;

    setBusyId(order.id);
    const result = await confirmOrder(order.id);
    setBusyId(null);

    if (result.error) {
      alert(result.error);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'confirmed', saleId: result.saleId } : o)));
    router.refresh();
  };

  const handleCancel = async (order: Order) => {
    const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    if (!confirm(`Marcar este pedido como não confirmado? O estoque reservado (${totalUnits} peça${totalUnits === 1 ? '' : 's'}) volta pro catálogo.`)) {
      return;
    }

    setBusyId(order.id);
    const result = await cancelOrder(order.id);
    setBusyId(null);

    if (result.error) {
      alert(result.error);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o)));
    router.refresh();
  };

  const handleMarkShipped = async (order: Order) => {
    setBusyId(order.id);
    const result = await markOrderShipped(order.id);
    setBusyId(null);

    if (result.error) {
      alert(result.error);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, shippedAt: new Date().toISOString() } : o)));
    router.refresh();
  };

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Itens</th>
            <th className="px-4 py-3">Pagamento</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => {
            const badge = STATUS_BADGE[order.status];
            const phoneDigits = order.customerPhone?.replace(/\D/g, '');
            return (
              <tr key={order.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {new Date(order.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3 text-slate-900">
                  {order.customerName || '—'}
                  {phoneDigits && (
                    <a
                      href={`https://wa.me/${phoneDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      WhatsApp
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-900">
                  {order.items
                    .map((item) => `${item.quantity}x ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''}`)
                    .join(', ')}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                  {order.status === 'confirmed' && (
                    <span
                      className={`ml-1.5 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        order.shippedAt ? 'bg-slate-100 text-slate-500' : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {order.shippedAt ? 'Enviado' : 'Aguardando envio'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatPrice(order.total)}</td>
                <td className="px-4 py-3 text-right">
                  {order.status === 'pending' ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleConfirm(order)}
                        disabled={busyId === order.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        title="Confirmar venda"
                      >
                        <Check size={13} /> Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancel(order)}
                        disabled={busyId === order.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Venda não confirmada"
                      >
                        <X size={13} /> Não confirmada
                      </button>
                    </div>
                  ) : order.status === 'confirmed' && !order.shippedAt ? (
                    <button
                      type="button"
                      onClick={() => handleMarkShipped(order)}
                      disabled={busyId === order.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                      title="Marcar como enviado"
                    >
                      <Truck size={13} /> Marcar como enviado
                    </button>
                  ) : order.status === 'confirmed' && order.shippedAt ? (
                    <span className="text-xs text-slate-400">
                      Enviado em {new Date(order.shippedAt).toLocaleDateString('pt-BR')}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {orders.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                Nenhum pedido recebido ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
