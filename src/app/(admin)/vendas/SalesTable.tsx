'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { Sale } from '@/types';
import { formatPrice } from '@/lib/currency';
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
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Itens</th>
            <th className="px-4 py-3">Pagamento</th>
            <th className="px-4 py-3">Observação</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {new Date(sale.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td className="px-4 py-3 text-slate-900">
                {sale.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {sale.paymentMethod ? PAYMENT_LABELS[sale.paymentMethod] : '—'}
              </td>
              <td className="px-4 py-3 text-slate-500">{sale.note || '—'}</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatPrice(sale.total)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => handleDelete(sale)}
                  disabled={deletingId === sale.id}
                  className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Excluir venda"
                >
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
          {sales.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                Nenhuma venda registrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
