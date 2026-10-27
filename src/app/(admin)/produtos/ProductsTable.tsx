'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Search, Trash2 } from 'lucide-react';
import type { Category, Product } from '@/types';
import { deleteProduct, updateStock } from './actions';
import { cn } from '@/lib/cn';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { card } from '@/components/ui/PageHeader';

interface ProductsTableProps {
  initialProducts: Product[];
  categories: Category[];
}

const fieldClass =
  'min-h-11 rounded-xl border border-line bg-white px-3.5 text-sm text-ink focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze';

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

  const { page, pageCount, pageItems, setPage, total, pageSize } = usePagination(
    filtered,
    `${search}|${categoryFilter}|${onlyLowStock}`,
  );

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm text-slate-500 focus-within:border-bronze">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            aria-label="Buscar produto"
            className="w-full bg-transparent text-ink outline-none placeholder:text-slate-400"
          />
        </label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filtrar por categoria"
          className={fieldClass}
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-3.5 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-bronze"
          />
          Só esgotados
        </label>
      </div>

      <div className={cn(card, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.06em] text-slate-600">
              <tr>
                <th className="px-5 py-4 font-semibold">Produto</th>
                <th className="px-3 py-4 font-semibold">Categoria</th>
                <th className="px-3 py-4 font-semibold">Preço</th>
                <th className="px-3 py-4 font-semibold">Estoque</th>
                <th className="px-3 py-4 font-semibold">Status</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((product) => (
                <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {product.images[0] && (
                          <Image src={product.images[0]} alt={product.name} fill sizes="48px" className="object-cover" />
                        )}
                      </div>
                      <span className="font-semibold text-ink">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{categoryName(product.category)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-ink">
                    {(product.promoPrice ?? product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min={0}
                      defaultValue={product.stockQuantity}
                      aria-label={`Estoque de ${product.name}`}
                      onBlur={(e) => {
                        const value = Math.max(0, Number(e.target.value) || 0);
                        if (value !== product.stockQuantity) handleStockChange(product.id, value);
                      }}
                      className="h-10 w-20 rounded-[10px] border border-line px-2.5 text-sm text-ink focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                        product.stockQuantity > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700',
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {product.stockQuantity > 0 ? 'Disponível' : 'Esgotado'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/produtos/${product.id}`}
                        aria-label={`Editar ${product.name}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-ink"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id, product.name)}
                        aria-label={`Excluir ${product.name}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {total === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                    Nenhum produto encontrado.
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
          itemLabel="produtos"
        />
      </div>
    </div>
  );
}
