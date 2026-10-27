import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader, primaryButton } from '@/components/ui/PageHeader';
import { listProducts } from './actions';
import { listCategories } from '../categorias/actions';
import { ProductsTable } from './ProductsTable';

export default async function ProdutosPage() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);

  const total = products.length;
  const outOfStock = products.filter((p) => p.stockQuantity <= 0).length;

  return (
    <div>
      <PageHeader
        eyebrow="Catálogo"
        title="Produtos"
        description={`${total} ${total === 1 ? 'produto' : 'produtos'} · ${outOfStock} esgotado${outOfStock === 1 ? '' : 's'}`}
        actions={
          <Link href="/produtos/novo" className={primaryButton}>
            <Plus size={16} /> Novo produto
          </Link>
        }
      />

      <div className="mt-6">
        <ProductsTable initialProducts={products} categories={categories} />
      </div>
    </div>
  );
}
