'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { Sale } from '@/types';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { card } from '@/components/ui/PageHeader';
import { deleteSale } from './actions';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  dinheiro: 'Dinheiro',
};

export function SalesTable({ initialSales }: { initialSales: Sale[] }) {
  const router = useRouter();
  const [sales, setSales] = useState(initialSales);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { page, pageCount, pageItems, setPage, total, pageSize } = usePagination(sales);

  const handleDelete = async (sale: Sale) => {
    if (
      !confirm(
        `Excluir esta venda de ${formatPrice(sale.total)}? O estoque dos itens será devolvido automaticamente. Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setDeletingId(sale.id);
    const result = await deleteSale(sale.id);
    setDeletingId(null);

    if (result.error) {
      alert(result.error);
      return;
    }

    setSales((prev) => prev.filter((s) => s.id !== sale.id));
    router.refresh();
  };

  return (
    <div className={cn(card, 'mt-6 overflow-hidden')}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.06em] text-slate-600">
            <tr>
              <th className="px-5 py-4 font-semibold">Data</th>
              <th className="px-3 py-4 font-semibold">Itens</th>
              <th className="px-3 py-4 font-semibold">Pagamento</th>
              <th className="px-3 py-4 font-semibold">Observação</th>
              <th className="px-3 py-4 text-right font-semibold">Total</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((sale) => (
              <tr key={sale.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {new Date(sale.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="min-w-56 px-3 py-4 font-medium text-ink">
                  {sale.items
                    .map((item) => `${item.quantity}x ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''}`)
                    .join(', ')}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-slate-600">
                  {sale.paymentMethod ? PAYMENT_LABELS[sale.paymentMethod] : '—'}
                </td>
                <td className="px-3 py-4 text-slate-500">{sale.note || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-bold text-ink">{formatPrice(sale.total)}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(sale)}
                    disabled={deletingId === sale.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Excluir venda"
                    aria-label="Excluir venda"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {total === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                  Nenhuma venda registrada ainda.
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
        itemLabel="vendas"
      />
    </div>
  );
}
