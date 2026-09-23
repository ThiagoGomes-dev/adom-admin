import { notFound } from 'next/navigation';
import { getProduct, listProductVariantSkus, listStockEntries } from '../actions';
import { listCategories } from '../../categorias/actions';
import { ProductForm } from '../ProductForm';
import { RestockPanel } from '../RestockPanel';

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), listCategories()]);

  if (!product) notFound();

  const hasVariants = product.variants.length > 0;
  const [stockEntries, variantSkus] = await Promise.all([
    listStockEntries(id),
    hasVariants ? listProductVariantSkus(id) : Promise.resolve(null),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Editar produto</h1>
      <div className="mt-6 space-y-8">
        <div className="max-w-3xl">
          <RestockPanel
            product={product}
            entries={stockEntries}
            skus={variantSkus?.skus}
            orphanSkus={variantSkus?.orphanSkus}
          />
        </div>
        <ProductForm
          categories={categories}
          product={product}
          hasVariantStock={Boolean(variantSkus?.skus.some((sku) => sku.stockQuantity > 0))}
          skus={variantSkus?.skus}
        />
      </div>
    </div>
  );
}
