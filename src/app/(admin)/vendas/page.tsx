import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listSales } from './actions';
import { listProducts } from '../produtos/actions';
import { formatPrice } from '@/lib/currency';
import { MonthlyRevenueChart, type MonthlyRevenuePoint } from './MonthlyRevenueChart';
import { TopProductsChart } from './TopProductsChart';
import { LowStockAlert } from './LowStockAlert';

const MONTHS_TO_SHOW = 6;

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  dinheiro: 'Dinheiro',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

export default async function VendasPage() {
  const [sales, products] = await Promise.all([listSales(), listProducts()]);

  const now = new Date();
  const isToday = (d: Date) => d.toDateString() === now.toDateString();
  const isThisMonth = (d: Date) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

  const salesToday = sales.filter((s) => isToday(new Date(s.createdAt)));
  const salesMonth = sales.filter((s) => isThisMonth(new Date(s.createdAt)));

  const totalHoje = salesToday.reduce((sum, s) => sum + s.total, 0);
  const totalMes = salesMonth.reduce((sum, s) => sum + s.total, 0);
  const totalGeral = sales.reduce((sum, s) => sum + s.total, 0);

  const topProdutosMes = Object.entries(
    salesMonth
      .flatMap((s) => s.items)
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.name] = (acc[item.name] ?? 0) + item.quantity;
        return acc;
      }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }));

  const monthKeys: string[] = [];
  for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
  }
  const monthLabels: Record<string, string> = {};
  monthKeys.forEach((key) => {
    const [year, month] = key.split('-').map(Number);
    monthLabels[key] = new Date(year, month, 1)
      .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace('.', '');
  });

  const revenueByMonth = sales.reduce<Record<string, number>>((acc, s) => {
    const d = new Date(s.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key in monthLabels) acc[key] = (acc[key] ?? 0) + s.total;
    return acc;
  }, {});

  const monthlyRevenue: MonthlyRevenuePoint[] = monthKeys.map((key) => ({
    label: monthLabels[key],
    total: revenueByMonth[key] ?? 0,
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Vendas</h1>
        <Link
          href="/vendas/nova"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={16} /> Registrar venda
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Hoje" value={formatPrice(totalHoje)} sub={`${salesToday.length} venda(s)`} />
        <StatCard label="Este mês" value={formatPrice(totalMes)} sub={`${salesMonth.length} venda(s)`} />
        <StatCard label="Total registrado" value={formatPrice(totalGeral)} sub={`${sales.length} venda(s) no total`} />
      </div>

      <LowStockAlert products={products} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Faturamento por mês (últimos {MONTHS_TO_SHOW})
          </h2>
          <div className="mt-3">
            <MonthlyRevenueChart data={monthlyRevenue} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mais vendidos no mês</h2>
          {topProdutosMes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Nenhuma venda registrada este mês ainda.</p>
          ) : (
            <div className="mt-3">
              <TopProductsChart data={topProdutosMes} />
            </div>
          )}
        </div>
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
