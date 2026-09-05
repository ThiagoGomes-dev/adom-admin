'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import type { Category, Product } from '@/types';
import { deleteProduct, updateStock } from './actions';
import { cn } from '@/lib/cn';

interface ProductsTableProps {
  initialProducts: Product[];
  categories: Category[];
}

export function ProductsTable({ initialProducts, categories }: ProductsTableProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (onlyLowStock && p.stockQuantity > 0) return false;
      return true;
    });
  }, [products, search, categoryFilter, onlyLowStock]);

  const handleStockChange = async (id: string, value: number) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stockQuantity: value, available: value > 0 } : p)));
    await updateStock(id, value);
    router.refresh();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Essa ação não pode ser desfeita.`)) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    await deleteProduct(id);
    router.refresh();
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Só esgotados
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Estoque</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((product) => (
              <tr key={product.id}>
                <td className="flex items-center gap-3 px-4 py-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {product.images[0] && (
                      <Image src={product.images[0]} alt={product.name} fill sizes="40px" className="object-cover" />
                    )}
                  </div>
                  <span className="font-medium text-slate-900">{product.name}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{categoryName(product.category)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(product.promoPrice ?? product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={product.stockQuantity}
                    onBlur={(e) => {
                      const value = Math.max(0, Number(e.target.value) || 0);
                      if (value !== product.stockQuantity) handleStockChange(product.id, value);
                    }}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                      product.stockQuantity > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
                    )}
                  >
                    {product.stockQuantity > 0 ? 'Disponível' : 'Esgotado'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/produtos/${product.id}`}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id, product.name)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
