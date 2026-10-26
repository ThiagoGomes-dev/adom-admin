import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listSales } from '../vendas/actions';
import { listProducts } from '../produtos/actions';
import { listOrders } from '../pedidos/actions';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { PageHeader, card, primaryButton } from '@/components/ui/PageHeader';
import { MonthlyRevenueChart, type MonthlyRevenuePoint } from './MonthlyRevenueChart';
import { TopProductsChart } from './TopProductsChart';
import { LowStockAlert } from './LowStockAlert';

const MONTHS_TO_SHOW = 6;
const RECENT_ORDERS = 5;
const TIME_ZONE = 'America/Sao_Paulo';

function StatCard({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className={cn(card, 'flex flex-col gap-2 p-5')}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="font-display text-[28px] font-medium leading-tight text-ink">{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: TIME_ZONE }).format(now));
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default async function DashboardPage() {
  const [sales, products, orders] = await Promise.all([listSales(), listProducts(), listOrders()]);

  const now = new Date();
  const isToday = (d: Date) => d.toDateString() === now.toDateString();
  const isThisMonth = (d: Date) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

  const salesToday = sales.filter((s) => isToday(new Date(s.createdAt)));
  const salesMonth = sales.filter((s) => isThisMonth(new Date(s.createdAt)));

  const totalHoje = salesToday.reduce((sum, s) => sum + s.total, 0);
  const totalMes = salesMonth.reduce((sum, s) => sum + s.total, 0);
  const totalGeral = sales.reduce((sum, s) => sum + s.total, 0);

  const custoHoje = salesToday.reduce((sum, s) => sum + s.totalCost, 0);
  const custoMes = salesMonth.reduce((sum, s) => sum + s.totalCost, 0);
  const custoGeral = sales.reduce((sum, s) => sum + s.totalCost, 0);

  const lucroHoje = totalHoje - custoHoje;
  const lucroMes = totalMes - custoMes;
  const lucroGeral = totalGeral - custoGeral;

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

  const toShip = orders.filter((o) => o.status === 'confirmed' && !o.shippedAt).length;
  const awaitingPayment = orders.filter((o) => o.status === 'pending').length;
  const recentOrders = orders.slice(0, RECENT_ORDERS);
  const margemMes = totalMes > 0 ? Math.round((lucroMes / totalMes) * 100) : 0;

  const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE }).format(now);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={today}
        title={`${greeting(now)}! Aqui está o resumo da loja.`}
        actions={
          <Link href="/vendas/nova" className={primaryButton}>
            <Plus size={16} /> Registrar venda
          </Link>
        }
      />

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-2 rounded-[18px] bg-ink p-5 text-white">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-300">Faturamento no mês</p>
            <span className="text-xs font-semibold text-bronze-soft">
              {salesMonth.length} venda{salesMonth.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="font-display text-[32px] font-medium leading-tight">{formatPrice(totalMes)}</p>
          <p className="text-xs text-slate-400">Total geral: {formatPrice(totalGeral)}</p>
        </div>
        <StatCard
          label="Faturamento hoje"
          value={formatPrice(totalHoje)}
          sub={`${salesToday.length} venda${salesToday.length === 1 ? '' : 's'} · lucro ${formatPrice(lucroHoje)}`}
        />
        <StatCard
          label="Lucro no mês"
          value={formatPrice(lucroMes)}
          sub={`Margem de ${margemMes}% · custo ${formatPrice(custoMes)}`}
        />
        <StatCard
          label="Pedidos para enviar"
          value={String(toShip)}
          sub={
            <Link href="/pedidos" className="font-semibold text-bronze-text hover:text-bronze-dark">
              {awaitingPayment} aguardando pagamento · ver pedidos →
            </Link>
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={cn(card, 'p-6')}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-medium text-ink">Faturamento por mês</h2>
            <span className="text-sm text-slate-500">Últimos {MONTHS_TO_SHOW} meses</span>
          </div>
          <div className="mt-4">
            <MonthlyRevenueChart data={monthlyRevenue} />
          </div>
        </div>

        <div className={cn(card, 'p-6')}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-medium text-ink">Mais vendidos no mês</h2>
            <span className="text-sm text-slate-500">Peças vendidas</span>
          </div>
          {topProdutosMes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhuma venda registrada este mês ainda.</p>
          ) : (
            <div className="mt-4">
              <TopProductsChart data={topProdutosMes} />
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <LowStockAlert products={products} />

        <div className={cn(card, 'flex flex-col gap-2 p-6')}>
          <div className="flex items-center gap-2.5">
            <h2 className="flex-1 font-display text-xl font-medium text-ink">Últimos pedidos do site</h2>
            <Link href="/pedidos" className="text-sm font-semibold text-bronze-text hover:text-bronze-dark">
              Ver todos
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">Nenhum pedido recebido ainda.</p>
          ) : (
            <ul>
              {recentOrders.map((order) => {
                const badge =
                  order.status === 'pending'
                    ? { label: 'Aguardando', className: 'bg-amber-100 text-amber-800' }
                    : order.status === 'cancelled'
                      ? { label: 'Cancelado', className: 'bg-slate-100 text-slate-600' }
                      : order.shippedAt
                        ? { label: 'Enviado', className: 'bg-indigo-100 text-indigo-800' }
                        : { label: 'Pago · enviar', className: 'bg-emerald-100 text-emerald-800' };
                const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <li key={order.id} className="flex items-center gap-3 border-t border-slate-100 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-ink">{order.customerName || 'Cliente'}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: TIME_ZONE,
                        })}{' '}
                        · {units} peça{units === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-ink">{formatPrice(order.total)}</span>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', badge.className)}>
                      {badge.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <p className="text-xs text-slate-500">Lucro total desde o início: {formatPrice(lucroGeral)} · custo {formatPrice(custoGeral)}</p>
    </div>
  );
}
