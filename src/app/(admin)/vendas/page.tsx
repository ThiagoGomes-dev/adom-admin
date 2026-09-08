import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listSales } from './actions';
import { SalesTable } from './SalesTable';

export default async function VendasPage() {
  const sales = await listSales();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendas</h1>
          <p className="mt-1 text-sm text-slate-500">
            {sales.length} venda{sales.length === 1 ? '' : 's'} registrada{sales.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          href="/vendas/nova"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={16} /> Registrar venda
        </Link>
      </div>

      <SalesTable initialSales={sales} />
    </div>
  );
}
