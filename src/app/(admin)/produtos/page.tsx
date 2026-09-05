import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listProducts } from './actions';
import { listCategories } from '../categorias/actions';
import { ProductsTable } from './ProductsTable';

export default async function ProdutosPage() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);

  const total = products.length;
  const outOfStock = products.filter((p) => p.stockQuantity <= 0).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} {total === 1 ? 'produto' : 'produtos'} · {outOfStock} esgotado{outOfStock === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          href="/produtos/novo"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={16} /> Novo produto
        </Link>
      </div>

      <div className="mt-6">
        <ProductsTable initialProducts={products} categories={categories} />
      </div>
    </div>
  );
}
