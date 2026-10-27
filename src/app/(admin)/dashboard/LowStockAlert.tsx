import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { Product } from '@/types';
import { cn } from '@/lib/cn';
import { card } from '@/components/ui/PageHeader';

const LOW_STOCK_THRESHOLD = 5;
const MAX_ITEMS = 6;

export function LowStockAlert({ products }: { products: Product[] }) {
  const lowStock = products
    .filter((p) => p.stockQuantity <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stockQuantity - b.stockQuantity);

  return (
    <div className={cn(card, 'flex flex-col gap-2 p-6')}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-amber-100 text-amber-800">
          <AlertTriangle size={18} />
        </span>
        <h2 className="flex-1 font-display text-xl font-medium text-ink">Estoque baixo</h2>
        <Link href="/produtos" className="text-sm font-semibold text-bronze-text hover:text-bronze-dark">
          Ver produtos
        </Link>
      </div>
      {lowStock.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">Nenhum produto com {LOW_STOCK_THRESHOLD} unidades ou menos.</p>
      ) : (
        <ul>
          {lowStock.slice(0, MAX_ITEMS).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5">
              <Link href={`/produtos/${p.id}`} className="truncate text-sm font-semibold text-ink hover:underline">
                {p.name}
              </Link>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
                  p.stockQuantity === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800',
                )}
              >
                {p.stockQuantity === 0 ? 'Esgotado' : `${p.stockQuantity} unid.`}
              </span>
            </li>
          ))}
          {lowStock.length > MAX_ITEMS && (
            <li className="border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              e mais {lowStock.length - MAX_ITEMS} produto{lowStock.length - MAX_ITEMS === 1 ? '' : 's'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
