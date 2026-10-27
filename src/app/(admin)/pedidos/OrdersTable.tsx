'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Truck, Search, Eye, Store, PackageCheck } from 'lucide-react';
import type { Order } from '@/types';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { card } from '@/components/ui/PageHeader';
import { stageOf, whatsappLink, type OrderStage } from '@/lib/orderTracking';
import { confirmOrder, cancelOrder, markOrderShipped, markOrderReady, saveTrackingCode } from './actions';
import { OrderDetailsModal } from './OrderDetailsModal';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  dinheiro: 'Dinheiro',
};

const STAGE_BADGE: Record<OrderStage, { label: string; className: string }> = {
  pending: { label: 'Aguardando pagamento', className: 'bg-amber-100 text-amber-800' },
  toShip: { label: 'Pago · enviar', className: 'bg-emerald-100 text-emerald-800' },
  ready: { label: 'Pronto p/ retirada', className: 'bg-sky-100 text-sky-800' },
  shipped: { label: 'Enviado', className: 'bg-indigo-100 text-indigo-800' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600' },
};

const TABS: { id: OrderStage | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Aguardando pagamento' },
  { id: 'toShip', label: 'Pagos para enviar' },
  { id: 'ready', label: 'Prontos p/ retirada' },
  { id: 'shipped', label: 'Enviados/retirados' },
  { id: 'cancelled', label: 'Cancelados' },
];

/** Na retirada, o `shipped_at` marca que o cliente buscou — o rótulo muda, a etapa é a mesma. */
const badgeOf = (order: Order) => {
  const stage = stageOf(order);
  if (stage === 'shipped' && order.deliveryMethod === 'pickup') return { ...STAGE_BADGE.shipped, label: 'Retirado' };
  return STAGE_BADGE[stage];
};

/** Lista de pedidos recebidos pelo site — espelha SalesTable.tsx, com status e ações de confirmar/cancelar só enquanto pendente. */
export function OrdersTable({ initialOrders, storefrontUrl }: { initialOrders: Order[]; storefrontUrl: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<OrderStage | 'all'>('all');
  const [search, setSearch] = useState('');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsOrder = orders.find((o) => o.id === detailsId);
  const closeDetails = useCallback(() => setDetailsId(null), []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (tab !== 'all' && stageOf(o) !== tab) return false;
      if (term && !(o.customerName ?? '').toLowerCase().includes(term) && !(o.customerPhone ?? '').includes(term)) {
        return false;
      }
      return true;
    });
  }, [orders, tab, search]);

  const { page, pageCount, pageItems, setPage, total, pageSize } = usePagination(filtered, `${tab}|${search}`);

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

  const updateLocal = (id: string, patch: Partial<Order>) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const handleMarkShipped = async (order: Order) => {
    const isPickup = order.deliveryMethod === 'pickup';
    let trackingCode: string | undefined;
    if (isPickup) {
      if (!confirm('Confirmar que o cliente retirou o pedido?')) return;
    } else {
      const answer = prompt('Código de rastreio (pode deixar em branco e informar depois nos detalhes do pedido):', '');
      if (answer === null) return;
      trackingCode = answer.trim().toUpperCase() || undefined;
    }

    setBusyId(order.id);
    const result = await markOrderShipped(order.id, trackingCode);
    setBusyId(null);

    if (result.error) {
      alert(result.error);
      return;
    }
    updateLocal(order.id, { shippedAt: new Date().toISOString(), ...(trackingCode ? { trackingCode } : {}) });
    router.refresh();
  };

  const handleMarkReady = async (order: Order) => {
    setBusyId(order.id);
    const result = await markOrderReady(order.id);
    setBusyId(null);

    if (result.error) {
      alert(result.error);
      return;
    }
    updateLocal(order.id, { readyAt: new Date().toISOString() });
    router.refresh();
  };

  const handleSaveTracking = async (order: Order) => {
    const answer = prompt('Código de rastreio:', order.trackingCode ?? '');
    if (answer === null) return;
    const trackingCode = answer.trim().toUpperCase();

    setBusyId(order.id);
    const result = await saveTrackingCode(order.id, trackingCode);
    setBusyId(null);

    if (result.error) {
      alert(result.error);
      return;
    }
    updateLocal(order.id, { trackingCode: trackingCode || undefined });
    router.refresh();
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Filtrar pedidos" className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const count = t.id === 'all' ? orders.length : orders.filter((o) => stageOf(o) === t.id).length;
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors',
                  selected ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:bg-slate-100',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-bold',
                    selected ? 'bg-bronze text-ink' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm text-slate-500 focus-within:border-bronze lg:w-72">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou telefone"
            aria-label="Buscar pedido"
            className="w-full bg-transparent text-ink outline-none placeholder:text-slate-400"
          />
        </label>
      </div>

      <div className={cn(card, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.06em] text-slate-600">
              <tr>
                <th className="px-5 py-4 font-semibold">Data</th>
                <th className="px-3 py-4 font-semibold">Cliente</th>
                <th className="px-3 py-4 font-semibold">Itens</th>
                <th className="px-3 py-4 font-semibold">Pagamento</th>
                <th className="px-3 py-4 text-right font-semibold">Total</th>
                <th className="px-3 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((order) => {
                const stage = stageOf(order);
                const badge = badgeOf(order);
                const isPickup = order.deliveryMethod === 'pickup';
                const phoneDigits = order.customerPhone?.replace(/\D/g, '');
                const busy = busyId === order.id;
                return (
                  <tr key={order.id} className="border-t border-slate-100 align-middle hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {new Date(order.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => setDetailsId(order.id)}
                          className="w-fit text-left font-semibold text-ink hover:text-bronze-text hover:underline"
                        >
                          {order.customerName || '—'}
                        </button>
                        {order.deliveryMethod && (
                          <span className="text-xs font-medium text-bronze-text">
                            {order.deliveryMethod === 'pickup' ? 'Retirada na loja' : 'Entrega'}
                          </span>
                        )}
                        {phoneDigits && (
                          <a
                            href={whatsappLink(phoneDigits, '')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-emerald-700 hover:underline"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="min-w-56 px-3 py-4 text-slate-700">
                      {order.items
                        .map((item) => `${item.quantity}x ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''}`)
                        .join(', ')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-600">
                      {order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-bold text-ink">
                      {formatPrice(order.total + (order.shippingCost ?? 0))}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
                          badge.className,
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailsId(order.id)}
                        title="Ver detalhes do pedido"
                        aria-label={`Ver detalhes do pedido de ${order.customerName || 'cliente'}`}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-white text-slate-600 hover:bg-slate-100 hover:text-ink"
                      >
                        <Eye size={16} />
                      </button>
                      {stage === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirm(order)}
                            disabled={busy}
                            className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-ink px-3.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            title="Confirmar venda"
                          >
                            <Check size={14} /> Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(order)}
                            disabled={busy}
                            className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-line bg-white px-3.5 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                            title="Venda não confirmada"
                          >
                            <X size={14} /> Não confirmada
                          </button>
                        </div>
                      ) : stage === 'toShip' && isPickup ? (
                        <button
                          type="button"
                          onClick={() => handleMarkReady(order)}
                          disabled={busy}
                          className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-ink px-3.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          title="Pedido separado, o cliente já pode buscar"
                        >
                          <Store size={14} /> Pronto para retirada
                        </button>
                      ) : stage === 'ready' ? (
                        <button
                          type="button"
                          onClick={() => handleMarkShipped(order)}
                          disabled={busy}
                          className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-ink px-3.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          title="O cliente buscou o pedido"
                        >
                          <PackageCheck size={14} /> Marcar como retirado
                        </button>
                      ) : stage === 'toShip' ? (
                        <button
                          type="button"
                          onClick={() => handleMarkShipped(order)}
                          disabled={busy}
                          className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-ink px-3.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          title="Marcar como enviado"
                        >
                          <Truck size={14} /> Marcar como enviado
                        </button>
                      ) : stage === 'shipped' ? (
                        <span className="whitespace-nowrap text-xs text-slate-500">
                          {isPickup ? 'Retirado' : 'Enviado'} em {new Date(order.shippedAt!).toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {total === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-500">
                    {orders.length === 0 ? 'Nenhum pedido recebido ainda.' : 'Nenhum pedido nesse filtro.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="pedidos"
        />
      </div>

      {detailsOrder && (
        <OrderDetailsModal
          order={detailsOrder}
          stageLabel={badgeOf(detailsOrder).label}
          stageClassName={badgeOf(detailsOrder).className}
          storefrontUrl={storefrontUrl}
          busy={busyId === detailsOrder.id}
          onEditTracking={() => handleSaveTracking(detailsOrder)}
          onClose={closeDetails}
        />
      )}
    </div>
  );
}
