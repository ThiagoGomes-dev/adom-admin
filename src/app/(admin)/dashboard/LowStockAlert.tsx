import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { Product } from '@/types';

const LOW_STOCK_THRESHOLD = 5;

export function LowStockAlert({ products }: { products: Product[] }) {
  const lowStock = products
    .filter((p) => p.stockQuantity <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stockQuantity - b.stockQuantity);

  if (lowStock.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
        <AlertTriangle size={16} /> Estoque baixo
      </h2>
      <ul className="mt-3 space-y-2">
        {lowStock.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <Link href={`/produtos/${p.id}`} className="text-slate-900 hover:underline">
              {p.name}
            </Link>
            <span className={`font-semibold ${p.stockQuantity === 0 ? 'text-red-600' : 'text-amber-700'}`}>
              {p.stockQuantity === 0 ? 'Esgotado' : `${p.stockQuantity} unid.`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
