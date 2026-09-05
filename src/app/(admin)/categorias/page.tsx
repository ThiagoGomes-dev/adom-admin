import { listCategories } from './actions';
import { CategoriesManager } from './CategoriesManager';

export default async function CategoriasPage() {
  const categories = await listCategories();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
      <p className="mt-1 text-sm text-slate-500">Organize os produtos por categoria (ex: Camisetas, Regatas).</p>

      <div className="mt-6">
        <CategoriesManager initialCategories={categories} />
      </div>
    </div>
  );
}
