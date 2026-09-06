import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listSales } from './actions';
import { formatPrice } from '@/lib/currency';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  dinheiro: 'Dinheiro',
};

export default async function VendasPage() {
  const sales = await listSales();

  const today = new Date().toDateString();
  const totalHoje = sales
    .filter((s) => new Date(s.createdAt).toDateString() === today)
    .reduce((sum, s) => sum + s.total, 0);
  const totalGeral = sales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hoje: {formatPrice(totalHoje)} · Total registrado: {formatPrice(totalGeral)}
          </p>
        </div>
        <Link
          href="/vendas/nova"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={16} /> Registrar venda
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Itens</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3 text-right">Total</th>
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
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Nenhuma venda registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
