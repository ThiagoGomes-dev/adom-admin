'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { Category, Product, ProductVariantGroup, ProductVariantSku, StockEntry } from '@/types';
import { slugify } from '@/lib/slug';
import { compressImage } from '@/lib/compressImage';
import { extractStoragePath } from '@/lib/storagePath';
import { createClient } from '@/lib/supabase/client';
import { cartesianCombos, comboKeyOf, comboLabelOf } from '@/lib/variantCombos';
import { createProduct, updateProduct, createProductWithVariants, restockProduct, setVariantSkuPricing } from './actions';
import { createCategory } from '../categorias/actions';
import type { VariantStockAllocatorRow } from './VariantStockAllocator';
import { RestockPanel } from './RestockPanel';
import { WizardStepper } from './wizard/WizardStepper';
import { ProductInfoStep } from './wizard/ProductInfoStep';
import { ProductVariantsStep } from './wizard/ProductVariantsStep';
import { ProductStockStep } from './wizard/ProductStockStep';
import { validateInfoStep, validateVariantsStep, validateStockStep } from './wizard/productFormValidation';
import type { ProductInput } from '@/lib/mappers';

interface ProductFormProps {
  categories: Category[];
  product?: Product;
  /** true quando o produto já tem estoque distribuído em SKUs de variação — usado só pra impedir apagar todos os grupos de variante nesse estado. */
  hasVariantStock?: boolean;
  /** SKUs já existentes do produto (edição) — preço por variação e o passo Estoque usam isso. */
  skus?: ProductVariantSku[];
  /** combinações removidas do produto mas que ainda têm estoque/custo — repassado pro passo Estoque. */
  orphanSkus?: ProductVariantSku[];
  /** histórico de entradas de estoque (edição) — repassado pro passo Estoque. */
  entries?: StockEntry[];
}

let tempId = 0;
const nextTempId = () => `tmp-${Date.now()}-${tempId++}`;

/** string do input -> número, ou undefined quando vazio (undefined = herda o preço do produto) */
const parseOptionalNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const STEPS = ['Dados', 'Variações', 'Estoque'] as const;

export function ProductForm({ categories, product, hasVariantStock = false, skus = [], orphanSkus = [], entries = [] }: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(product);

  // Em edição, todos os passos ficam livres (o produto já existe, não há
  // nada pra travar); na criação, é um wizard guiado — só avança pelo botão
  // "Avançar" e só volta a um passo já alcançado.
  const [tabIndex, setTabIndex] = useState(0);
  const [furthestUnlocked, setFurthestUnlocked] = useState(0);

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [description, setDescription] = useState(product?.description ?? '');
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? '');
  const [categoryList, setCategoryList] = useState(categories);
  const [category, setCategory] = useState(product?.category ?? categories[0]?.slug ?? '');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [promoPrice, setPromoPrice] = useState(product?.promoPrice ? String(product.promoPrice) : '');
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [available, setAvailable] = useState(product?.available ?? true);
  const [tags, setTags] = useState(product?.tags?.join(', ') ?? '');
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [variants, setVariants] = useState<ProductVariantGroup[]>(product?.variants ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preço por variação (edição) — chave = sku.id. Sempre em tabela agora,
  // sem alternância "único vs por variação": o preço do produto é só o
  // menor preço entre as variações, derivado na hora de salvar.
  const [skuPrices, setSkuPrices] = useState<Record<string, string>>(
    Object.fromEntries(skus.map((s) => [s.id, s.price != null ? String(s.price) : ''])),
  );
  const [skuPromoPrices, setSkuPromoPrices] = useState<Record<string, string>>(
    Object.fromEntries(skus.map((s) => [s.id, s.promoPrice != null ? String(s.promoPrice) : ''])),
  );

  // Estoque inicial ao cadastrar um produto novo — opcional (pode cadastrar
  // sem estoque e repor depois no passo Estoque). Com variantes usa o mesmo
  // VariantStockAllocator do "Repor estoque"; sem variantes, os 3 campos
  // simples abaixo. Chaveado por comboKey porque o produto ainda não existe.
  const [initialTotalQuantity, setInitialTotalQuantity] = useState('');
  const [initialTotalCost, setInitialTotalCost] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [initialAllocations, setInitialAllocations] = useState<Record<string, string>>({});
  const [initialPrices, setInitialPrices] = useState<Record<string, string>>({});
  const [initialPromoPrices, setInitialPromoPrices] = useState<Record<string, string>>({});
  const [initialSimpleQuantity, setInitialSimpleQuantity] = useState('');
  const [initialSimpleCost, setInitialSimpleCost] = useState('');
  const [initialSimpleNote, setInitialSimpleNote] = useState('');

  const filteredVariants = useMemo(() => variants.filter((g) => g.name.trim() && g.options.length > 0), [variants]);
  const draftCombos = useMemo(() => cartesianCombos(filteredVariants), [filteredVariants]);
  const draftAllocatorRows: VariantStockAllocatorRow[] = useMemo(
    () => draftCombos.map((combo) => ({ key: comboKeyOf(combo), label: comboLabelOf(combo) })),
    [draftCombos],
  );
  const hasVariants = filteredVariants.length > 0;
  const isCreatingWithVariants = !isEditing && hasVariants;

  // Linhas/valores de preço por variação — em edição usam o sku.id real; ao
  // cadastrar (produto ainda não existe) usam o comboKey do rascunho.
  const variantPriceRows = isEditing
    ? skus.map((s) => ({ key: s.id, label: s.label, costPrice: s.costPrice, stockQuantity: s.stockQuantity }))
    : draftAllocatorRows;
  const variantPrices = isEditing ? skuPrices : initialPrices;
  const variantPromoPrices = isEditing ? skuPromoPrices : initialPromoPrices;
  const setVariantPrice = (key: string, value: string) => {
    if (isEditing) setSkuPrices((prev) => ({ ...prev, [key]: value }));
    else setInitialPrices((prev) => ({ ...prev, [key]: value }));
  };
  const setVariantPromoPrice = (key: string, value: string) => {
    if (isEditing) setSkuPromoPrices((prev) => ({ ...prev, [key]: value }));
    else setInitialPromoPrices((prev) => ({ ...prev, [key]: value }));
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(value);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const uploaded: string[] = [];

    for (const file of Array.from(files)) {
      let toUpload: File;
      try {
        toUpload = await compressImage(file);
      } catch {
        toUpload = file; // se a compressão falhar por algum motivo, sobe o arquivo original
      }

      const path = `${Date.now()}-${slugify(file.name)}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, toUpload);
      if (uploadError) {
        setError(`Erro ao enviar ${file.name}: ${uploadError.message}`);
        continue;
      }
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }

    setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const removeImage = async (url: string) => {
    setImages((prev) => prev.filter((img) => img !== url));
    // desvincula essa foto de qualquer opção de variante que a usava
    setVariants((prev) =>
      prev.map((g) => ({ ...g, options: g.options.map((o) => (o.image === url ? { ...o, image: '' } : o)) })),
    );

    const path = extractStoragePath(url);
    if (path) {
      const supabase = createClient();
      await supabase.storage.from('product-images').remove([path]);
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addVariantGroup = () => {
    setVariants((prev) => [...prev, { id: nextTempId(), name: '', options: [] }]);
  };

  const updateVariantGroupName = (groupId: string, name: string) => {
    setVariants((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
  };

  const removeVariantGroup = (groupId: string) => {
    setVariants((prev) => prev.filter((g) => g.id !== groupId));
  };

  const addVariantOption = (groupId: string) => {
    setVariants((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, options: [...g.options, { id: nextTempId(), label: '', meta: '' }] } : g)),
    );
  };

  const updateVariantOption = (groupId: string, optionId: string, field: 'label' | 'meta' | 'image', value: string) => {
    setVariants((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.map((o) => (o.id === optionId ? { ...o, [field]: value } : o)) }
          : g,
      ),
    );
  };

  const removeVariantOption = (groupId: string, optionId: string) => {
    setVariants((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g)),
    );
  };

  const openCategoryModal = () => {
    setNewCategoryName('');
    setCategoryError(null);
    setShowCategoryModal(true);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCategorySaving(true);
    setCategoryError(null);

    const slug = slugify(newCategoryName);
    const result = await createCategory({ name: newCategoryName, slug });

    setCategorySaving(false);

    if (result.error) {
      setCategoryError(result.error);
      return;
    }

    setCategoryList((prev) => [...prev, { id: crypto.randomUUID(), name: newCategoryName, slug }]);
    setCategory(slug);
    setShowCategoryModal(false);
  };

  // Validação por passo (ver wizard/productFormValidation.ts) — reaproveitada
  // tanto pelo "Avançar" (gate entre passos, só na criação) quanto pelo
  // submit final, pra nunca ter duas implementações da mesma regra.
  const runInfoValidation = () => validateInfoStep({ name, slug, category });
  const runVariantsValidation = () =>
    validateVariantsStep({ hasVariantStock, filteredVariants, hasVariants, variantPriceRows, variantPrices });
  const runStockValidation = () =>
    validateStockStep({
      isEditing,
      isCreatingWithVariants,
      hasVariants,
      draftAllocatorRows,
      initialTotalQuantity,
      initialTotalCost,
      initialAllocations,
      initialSimpleQuantity,
      initialSimpleCost,
    });

  const goNext = () => {
    setError(null);
    const err = tabIndex === 0 ? runInfoValidation() : tabIndex === 1 ? runVariantsValidation() : null;
    if (err) {
      setError(err);
      return;
    }
    const next = tabIndex + 1;
    setTabIndex(next);
    setFurthestUnlocked((f) => Math.max(f, next));
  };

  const goBack = () => {
    setError(null);
    setTabIndex((i) => Math.max(0, i - 1));
  };

  const handleStepClick = (i: number) => {
    if (isEditing || i <= furthestUnlocked) {
      setError(null);
      setTabIndex(i);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    const infoError = runInfoValidation();
    if (infoError) {
      setError(infoError);
      setTabIndex(0);
      return;
    }

    const variantsError = runVariantsValidation();
    if (variantsError) {
      setError(variantsError);
      setTabIndex(1);
      return;
    }

    const stockError = runStockValidation();
    if (stockError) {
      setError(stockError);
      setTabIndex(2);
      return;
    }

    // Com variação, o preço "do produto" nunca é editado diretamente — vira
    // o menor preço entre as variações, usado como referência em listas
    // (ex: card do produto) que ainda não sabem qual variação foi escolhida.
    const resolvedPrice = hasVariants
      ? Math.min(...variantPriceRows.map((row) => Number(variantPrices[row.key]) || 0).filter((n) => n > 0))
      : Number(price) || 0;
    const resolvedPromoPrice = hasVariants ? undefined : promoPrice ? Number(promoPrice) : undefined;

    const input: ProductInput = {
      slug: slugify(slug),
      name,
      description,
      shortDescription: shortDescription || undefined,
      // estoque/custo não são editados por aqui — cadastro novo começa
      // zerado (o passo Estoque registra a entrada inicial, se houver);
      // edição preserva o que já está salvo (o passo Estoque cuida do resto).
      costPrice: isEditing ? product!.costPrice : 0,
      price: resolvedPrice,
      promoPrice: resolvedPromoPrice,
      images,
      category,
      variants: filteredVariants,
      available,
      featured,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      stockQuantity: isEditing ? product!.stockQuantity : 0,
    };

    setSaving(true);

    if (isEditing) {
      const result = await updateProduct(product!.id, input);
      if (result.error) {
        setSaving(false);
        setError(result.error);
        return;
      }

      if (hasVariants && skus.length > 0) {
        const pricingResult = await setVariantSkuPricing(
          skus.map((sku) => ({
            skuId: sku.id,
            price: parseOptionalNumber(skuPrices[sku.id] ?? ''),
            promoPrice: parseOptionalNumber(skuPromoPrices[sku.id] ?? ''),
          })),
        );
        if (pricingResult.error) {
          setSaving(false);
          setError(pricingResult.error);
          return;
        }
      }
    } else if (hasVariants) {
      // Cadastro com variação: produto + SKUs + preço + lote inicial numa
      // única transação no banco (create_product_with_variants) — nunca
      // mais fica produto/SKU parcialmente salvo se algo falhar no meio.
      const attemptingInitialVariantStock =
        isCreatingWithVariants && (Number(initialTotalQuantity) > 0 || Number(initialTotalCost) > 0);

      const result = await createProductWithVariants({
        product: input,
        skus: draftCombos.map((combo) => {
          const key = comboKeyOf(combo);
          return {
            comboKey: key,
            combo,
            price: parseOptionalNumber(initialPrices[key] ?? ''),
            promoPrice: parseOptionalNumber(initialPromoPrices[key] ?? ''),
          };
        }),
        restock: attemptingInitialVariantStock
          ? {
              totalQuantity: Number(initialTotalQuantity) || 0,
              totalCost: Number(initialTotalCost) || 0,
              allocations: draftAllocatorRows
                .filter((row) => (Number(initialAllocations[row.key]) || 0) > 0)
                .map((row) => ({ comboKey: row.key, quantity: Number(initialAllocations[row.key]) || 0 })),
              note: initialNote.trim() || 'Estoque inicial',
            }
          : undefined,
      });

      if (result.error || !result.id) {
        setSaving(false);
        setError(result.error ?? 'Erro ao criar produto.');
        return;
      }
    } else {
      const result = await createProduct(input);
      if (result.error || !result.id) {
        setSaving(false);
        setError(result.error ?? 'Erro ao criar produto.');
        return;
      }

      const attemptingInitialSimpleStock = Number(initialSimpleQuantity) > 0 || Number(initialSimpleCost) > 0;
      if (attemptingInitialSimpleStock) {
        const restockResult = await restockProduct({
          productId: result.id,
          quantity: Number(initialSimpleQuantity) || 0,
          totalCost: Number(initialSimpleCost) || 0,
          note: initialSimpleNote.trim() || 'Estoque inicial',
        });
        if (restockResult.error) {
          // o produto já foi criado nesse ponto (sem o problema de SKU
          // dependente de ID que existe com variação) — fica na tela com um
          // erro explícito em vez de sumir pra lista com o estoque incompleto.
          setSaving(false);
          setError(
            `Produto criado, mas a entrada de estoque falhou: ${restockResult.error}. Edite o produto em "/produtos" para repor o estoque.`,
          );
          return;
        }
      }
    }

    setSaving(false);
    router.push('/produtos');
    router.refresh();
  };

  const isLastStep = tabIndex === STEPS.length - 1;
  const isFirstStep = tabIndex === 0;

  return (
    <div className="max-w-4xl">
      <WizardStepper
        steps={STEPS}
        currentIndex={tabIndex}
        furthestUnlocked={isEditing ? STEPS.length - 1 : furthestUnlocked}
        mode={isEditing ? 'tabs' : 'wizard'}
        onStepClick={handleStepClick}
      />

      <div className="space-y-6 py-6">
        {tabIndex === 0 && (
          <ProductInfoStep
            name={name}
            onNameChange={handleNameChange}
            slug={slug}
            onSlugChange={handleSlugChange}
            description={description}
            onDescriptionChange={setDescription}
            shortDescription={shortDescription}
            onShortDescriptionChange={setShortDescription}
            categoryList={categoryList}
            category={category}
            onCategoryChange={setCategory}
            onOpenCategoryModal={openCategoryModal}
            tags={tags}
            onTagsChange={setTags}
            featured={featured}
            onFeaturedChange={setFeatured}
            available={available}
            onAvailableChange={setAvailable}
            images={images}
            uploading={uploading}
            onImageUpload={handleImageUpload}
            onRemoveImage={removeImage}
            onMoveImage={moveImage}
          />
        )}

        {tabIndex === 1 && (
          <ProductVariantsStep
            variants={variants}
            images={images}
            onAddVariantGroup={addVariantGroup}
            onRemoveVariantGroup={removeVariantGroup}
            onUpdateVariantGroupName={updateVariantGroupName}
            onAddVariantOption={addVariantOption}
            onUpdateVariantOption={updateVariantOption}
            onRemoveVariantOption={removeVariantOption}
            hasVariants={hasVariants}
            isEditing={isEditing}
            variantPriceRows={variantPriceRows}
            variantPrices={variantPrices}
            onVariantPriceChange={setVariantPrice}
            variantPromoPrices={variantPromoPrices}
            onVariantPromoPriceChange={setVariantPromoPrice}
            price={price}
            onPriceChange={setPrice}
            promoPrice={promoPrice}
            onPromoPriceChange={setPromoPrice}
          />
        )}

        {tabIndex === 2 &&
          (isEditing ? (
            <RestockPanel product={product!} entries={entries} skus={skus} orphanSkus={orphanSkus} />
          ) : (
            <ProductStockStep
              hasVariants={hasVariants}
              draftAllocatorRows={draftAllocatorRows}
              initialTotalQuantity={initialTotalQuantity}
              onInitialTotalQuantityChange={setInitialTotalQuantity}
              initialTotalCost={initialTotalCost}
              onInitialTotalCostChange={setInitialTotalCost}
              initialAllocations={initialAllocations}
              onInitialAllocationChange={(key, value) => setInitialAllocations((prev) => ({ ...prev, [key]: value }))}
              onInitialAllocationsReplace={setInitialAllocations}
              initialNote={initialNote}
              onInitialNoteChange={setInitialNote}
              initialSimpleQuantity={initialSimpleQuantity}
              onInitialSimpleQuantityChange={setInitialSimpleQuantity}
              initialSimpleCost={initialSimpleCost}
              onInitialSimpleCostChange={setInitialSimpleCost}
              initialSimpleNote={initialSimpleNote}
              onInitialSimpleNoteChange={setInitialSimpleNote}
            />
          ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex items-center gap-3">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button type="button" onClick={() => router.push('/produtos')} className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Cancelar
            </button>
          </>
        ) : (
          <>
            {!isFirstStep && (
              <button
                type="button"
                onClick={goBack}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                ← Voltar
              </button>
            )}
            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Criando...' : 'Criar produto'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Avançar →
              </button>
            )}
            <button type="button" onClick={() => router.push('/produtos')} className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Cancelar
            </button>
          </>
        )}
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Nova categoria</h3>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
              placeholder="Nome da categoria"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            {categoryError && <p className="mt-2 text-sm text-red-600">{categoryError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={categorySaving || !newCategoryName.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {categorySaving ? 'Criando...' : 'Criar categoria'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
