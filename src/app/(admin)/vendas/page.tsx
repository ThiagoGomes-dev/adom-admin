import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader, primaryButton } from '@/components/ui/PageHeader';
import { listSales } from './actions';
import { SalesTable } from './SalesTable';

export default async function VendasPage() {
  const sales = await listSales();

  return (
    <div>
      <PageHeader
        eyebrow="Financeiro"
        title="Vendas"
        description={`${sales.length} venda${sales.length === 1 ? '' : 's'} registrada${sales.length === 1 ? '' : 's'}`}
        actions={
          <Link href="/vendas/nova" className={primaryButton}>
            <Plus size={16} /> Registrar venda
          </Link>
        }
      />

      <SalesTable initialSales={sales} />
    </div>
  );
}
