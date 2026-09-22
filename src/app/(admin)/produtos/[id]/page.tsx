import { notFound } from 'next/navigation';
import { getProduct, listStockEntries } from '../actions';
import { listCategories } from '../../categorias/actions';
import { ProductForm } from '../ProductForm';
import { RestockPanel } from '../RestockPanel';

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), listCategories()]);

  if (!product) notFound();

  const stockEntries = await listStockEntries(id);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Editar produto</h1>
      <div className="mt-6 space-y-8">
        <div className="max-w-3xl">
          <RestockPanel product={product} entries={stockEntries} />
        </div>
        <ProductForm categories={categories} product={product} />
      </div>
    </div>
  );
}
