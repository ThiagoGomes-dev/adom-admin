import { PageHeader } from '@/components/ui/PageHeader';
import { listCategories } from './actions';
import { CategoriesManager } from './CategoriesManager';

export default async function CategoriasPage() {
  const categories = await listCategories();

  return (
    <div>
      <PageHeader
        eyebrow="Catálogo"
        title="Categorias"
        description="Organize os produtos por categoria (ex: Camisetas, Regatas)."
      />

      <div className="mt-6">
        <CategoriesManager initialCategories={categories} />
      </div>
    </div>
  );
}
