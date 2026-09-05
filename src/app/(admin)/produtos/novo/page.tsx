import { listCategories } from '../../categorias/actions';
import { ProductForm } from '../ProductForm';

export default async function NovoProdutoPage() {
  const categories = await listCategories();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Novo produto</h1>
      <div className="mt-6">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
