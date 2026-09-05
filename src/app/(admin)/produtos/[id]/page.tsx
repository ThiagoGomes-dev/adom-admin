import { notFound } from 'next/navigation';
import { getProduct } from '../actions';
import { listCategories } from '../../categorias/actions';
import { ProductForm } from '../ProductForm';

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), listCategories()]);

  if (!product) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Editar produto</h1>
      <div className="mt-6">
        <ProductForm categories={categories} product={product} />
      </div>
    </div>
  );
}
