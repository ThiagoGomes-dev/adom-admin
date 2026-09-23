'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Trash2, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Category, Product, ProductVariantGroup, ProductVariantSku } from '@/types';
import { slugify } from '@/lib/slug';
import { compressImage } from '@/lib/compressImage';
import { extractStoragePath } from '@/lib/storagePath';
import { createClient } from '@/lib/supabase/client';
import { cartesianCombos, comboKeyOf, comboLabelOf } from '@/lib/variantCombos';
import { createProduct, updateProduct, listProductVariantSkus, restockProductVariants, setVariantSkuPricing } from './actions';
import { createCategory } from '../categorias/actions';
import { VariantStockAllocator, allocatorCanSubmit, type VariantStockAllocatorRow } from './VariantStockAllocator';
import type { ProductInput } from '@/lib/mappers';

interface ProductFormProps {
  categories: Category[];
  product?: Product;
  /** true quando o produto já tem estoque distribuído em SKUs de variação — nesse caso, estoque/custo são gerenciados só pelo painel "Repor estoque por variação". */
  hasVariantStock?: boolean;
  /** SKUs já existentes do produto (edição) — usado pra pré-preencher o preço por variação. */
  skus?: ProductVariantSku[];
}

let tempId = 0;
const nextTempId = () => `tmp-${Date.now()}-${tempId++}`;

/** string do input -> número, ou undefined quando vazio (undefined = herda o preço do produto) */
const parseOptionalNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export function ProductForm({ categories, product, hasVariantStock = false, skus = [] }: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(product);

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
  // Guardamos o custo TOTAL pago pelo lote (ex: R$ 10.000 por 200 camisetas),
  // não o custo por peça — é assim que o lojista realmente compra. O custo
  // por unidade (o que de fato é salvo em `cost_price` no banco, usado nas
  // vendas e no dashboard) é derivado dividindo pelo estoque logo abaixo.
  const [totalCost, setTotalCost] = useState(
    product ? String(Number((product.costPrice * product.stockQuantity).toFixed(2))) : '',
  );
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [promoPrice, setPromoPrice] = useState(product?.promoPrice ? String(product.promoPrice) : '');
  const [stockQuantity, setStockQuantity] = useState(String(product?.stockQuantity ?? 0));
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [available, setAvailable] = useState(product?.available ?? true);
  const [tags, setTags] = useState(product?.tags?.join(', ') ?? '');
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [variants, setVariants] = useState<ProductVariantGroup[]>(product?.variants ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preço por variação (independente do fluxo de estoque): liga campos de
  // Preço/Promo por combinação, editável a qualquer momento — não precisa de
  // uma "reposição" pra mudar preço.
  const [pricePerVariant, setPricePerVariant] = useState(skus.some((s) => s.price != null || s.promoPrice != null));
  // Preço por variação já existente (edição) — chave = sku.id
  const [skuPrices, setSkuPrices] = useState<Record<string, string>>(
    Object.fromEntries(skus.map((s) => [s.id, s.price != null ? String(s.price) : ''])),
  );
  const [skuPromoPrices, setSkuPromoPrices] = useState<Record<string, string>>(
    Object.fromEntries(skus.map((s) => [s.id, s.promoPrice != null ? String(s.promoPrice) : ''])),
  );

  // Distribuição do estoque inicial ao cadastrar um produto novo com
  // variação — mesma mecânica de "Repor estoque", num passo só (ver
  // VariantStockAllocator). Chaveado por comboKey porque o produto (e os
  // SKUs) ainda não existem.
  const [initialTotalQuantity, setInitialTotalQuantity] = useState('');
  const [initialTotalCost, setInitialTotalCost] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [initialAllocations, setInitialAllocations] = useState<Record<string, string>>({});
  const [initialPrices, setInitialPrices] = useState<Record<string, string>>({});
  const [initialPromoPrices, setInitialPromoPrices] = useState<Record<string, string>>({});

  const filteredVariants = useMemo(() => variants.filter((g) => g.name.trim() && g.options.length > 0), [variants]);
  const draftAllocatorRows: VariantStockAllocatorRow[] = useMemo(
    () => cartesianCombos(filteredVariants).map((combo) => ({ key: comboKeyOf(combo), label: comboLabelOf(combo) })),
    [filteredVariants],
  );
  const hasVariants = filteredVariants.length > 0;
  const isCreatingWithVariants = !isEditing && hasVariants;

  // Linhas/valores de preço por variação — em edição usam o sku.id real; ao
  // cadastrar (produto ainda não existe) usam o comboKey do rascunho.
  const variantPriceRows: { key: string; label: string }[] = isEditing
    ? skus.map((s) => ({ key: s.id, label: s.label }))
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

  const isColorGroup = (groupName: string) => /cor/i.test(groupName);

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

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim() || !slug.trim() || !category) {
      setError('Preencha nome, slug e categoria.');
      return;
    }

    if (hasVariantStock && filteredVariants.length === 0) {
      setError('Este produto tem estoque distribuído por variação — remova o estoque das variações (no painel "Repor estoque por variação") antes de apagar todos os grupos.');
      return;
    }

    if (isCreatingWithVariants && !allocatorCanSubmit(draftAllocatorRows, initialTotalQuantity, initialTotalCost, initialAllocations)) {
      setError('Informe a quantidade total do lote, o valor pago e distribua entre as variações (a soma precisa bater com o total).');
      return;
    }

    if (hasVariants && pricePerVariant) {
      const missingPrice =
        variantPriceRows.length === 0 || variantPriceRows.some((row) => !(variantPrices[row.key] ?? '').trim());
      if (missingPrice) {
        setError('Preencha o preço de todas as variações, ou selecione "Preço único".');
        return;
      }
    }

    const stock = isCreatingWithVariants ? 0 : Number(stockQuantity) || 0;
    const unitCost = isCreatingWithVariants ? 0 : stock > 0 ? (Number(totalCost) || 0) / stock : 0;

    // Com preço por variação, o preço "do produto" nunca é mostrado nem
    // editado diretamente — vira só o menor preço entre as variações, usado
    // como referência em listas (ex: card do produto) que ainda não sabem
    // qual variação o cliente vai escolher.
    const resolvedPrice = hasVariants && pricePerVariant
      ? Math.min(...variantPriceRows.map((row) => Number(variantPrices[row.key]) || 0).filter((n) => n > 0))
      : Number(price) || 0;
    const resolvedPromoPrice = hasVariants && pricePerVariant ? undefined : promoPrice ? Number(promoPrice) : undefined;

    const input: ProductInput = {
      slug: slugify(slug),
      name,
      description,
      shortDescription: shortDescription || undefined,
      costPrice: unitCost,
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
      stockQuantity: stock,
    };

    setSaving(true);

    if (isEditing) {
      const result = await updateProduct(product!.id, input);
      if (result.error) {
        setSaving(false);
        setError(result.error);
        return;
      }

      if (filteredVariants.length > 0 && skus.length > 0) {
        const pricingResult = await setVariantSkuPricing(
          skus.map((sku) => ({
            skuId: sku.id,
            price: pricePerVariant ? parseOptionalNumber(skuPrices[sku.id] ?? '') : undefined,
            promoPrice: pricePerVariant ? parseOptionalNumber(skuPromoPrices[sku.id] ?? '') : undefined,
          })),
        );
        if (pricingResult.error) {
          setSaving(false);
          setError(pricingResult.error);
          return;
        }
      }
    } else {
      const result = await createProduct(input);
      if (result.error || !result.id) {
        setSaving(false);
        setError(result.error ?? 'Erro ao criar produto.');
        return;
      }

      if (isCreatingWithVariants) {
        const { skus: createdSkus } = await listProductVariantSkus(result.id);
        const byComboKey = new Map(createdSkus.map((s) => [s.comboKey, s]));

        const allocations = draftAllocatorRows
          .map((row) => ({ sku: byComboKey.get(row.key), quantity: Number(initialAllocations[row.key]) || 0 }))
          .filter((a): a is { sku: ProductVariantSku; quantity: number } => Boolean(a.sku) && a.quantity > 0)
          .map((a) => ({ skuId: a.sku.id, quantity: a.quantity }));

        const restockResult = await restockProductVariants({
          productId: result.id,
          totalQuantity: Number(initialTotalQuantity) || 0,
          totalCost: Number(initialTotalCost) || 0,
          allocations,
          note: initialNote.trim() || 'Estoque inicial',
        });
        if (restockResult.error) {
          setSaving(false);
          setError(restockResult.error);
          return;
        }

        if (pricePerVariant) {
          const pricingEntries = draftAllocatorRows
            .map((row) => ({
              sku: byComboKey.get(row.key),
              price: parseOptionalNumber(initialPrices[row.key] ?? ''),
              promoPrice: parseOptionalNumber(initialPromoPrices[row.key] ?? ''),
            }))
            .filter((e): e is { sku: ProductVariantSku; price: number | undefined; promoPrice: number | undefined } => Boolean(e.sku))
            .map((e) => ({ skuId: e.sku.id, price: e.price, promoPrice: e.promoPrice }));

          const pricingResult = await setVariantSkuPricing(pricingEntries);
          if (pricingResult.error) {
            setSaving(false);
            setError(pricingResult.error);
            return;
          }
        }
      }
    }

    setSaving(false);
    router.push('/produtos');
    router.refresh();
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Dados básicos */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Dados básicos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Slug (URL)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Descrição curta</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Categoria</label>
              <button
                type="button"
                onClick={openCategoryModal}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <Plus size={13} /> nova categoria
              </button>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {categoryList.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tags (separadas por vírgula)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="mais vendido, promoção"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>
      </section>

      {/* Imagens */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fotos</h2>
        <p className="mt-1 text-xs text-slate-400">A primeira foto é a capa — a que aparece na lista e no site.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {images.map((url, index) => (
            <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
              <Image src={url} alt="" fill sizes="96px" className="object-cover" />
              {index === 0 && (
                <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Capa
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={12} />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveImage(index, -1)}
                  className="rounded-full bg-white/90 p-1 text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                  title="Mover pra trás"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  disabled={index === images.length - 1}
                  onClick={() => moveImage(index, 1)}
                  className="rounded-full bg-white/90 p-1 text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                  title="Mover pra frente"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500">
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            <span className="text-xs">{uploading ? 'Enviando...' : 'Adicionar'}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleImageUpload(e.target.files)}
            />
          </label>
        </div>
      </section>

      {/* Variantes */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Variantes</h2>
          <button
            type="button"
            onClick={addVariantGroup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus size={14} /> Adicionar grupo
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {variants.map((group) => (
            <div key={group.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={group.name}
                  onChange={(e) => updateVariantGroupName(group.id, e.target.value)}
                  placeholder="Nome do grupo (ex: Cor, Tamanho)"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <button type="button" onClick={() => removeVariantGroup(group.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {group.options.map((option) => (
                  <div key={option.id} className="rounded-lg border border-slate-100 p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => updateVariantOption(group.id, option.id, 'label', e.target.value)}
                        placeholder="Ex: Azul Marinho"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                      {isColorGroup(group.name) && (
                        <input
                          type="color"
                          value={option.meta || '#000000'}
                          onChange={(e) => updateVariantOption(group.id, option.id, 'meta', e.target.value)}
                          className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-300"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeVariantOption(group.id, option.id)}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {isColorGroup(group.name) && (
                      <div className="mt-2">
                        {images.length === 0 ? (
                          <p className="text-xs text-slate-400">Adicione fotos acima para poder vincular a esta cor.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {images.map((url) => {
                              const selected = option.image === url;
                              return (
                                <button
                                  key={url}
                                  type="button"
                                  onClick={() =>
                                    updateVariantOption(group.id, option.id, 'image', selected ? '' : url)
                                  }
                                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 ${
                                    selected ? 'border-slate-900' : 'border-transparent opacity-60 hover:opacity-100'
                                  }`}
                                  title={selected ? 'Foto vinculada a esta cor (clique para remover)' : 'Vincular esta foto a esta cor'}
                                >
                                  <Image src={url} alt="" fill sizes="48px" className="object-cover" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addVariantOption(group.id)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  + Adicionar opção
                </button>
              </div>
            </div>
          ))}
          {variants.length === 0 && <p className="text-sm text-slate-500">Nenhum grupo de variante — o produto não terá seleção de cor/tamanho.</p>}
        </div>
      </section>

      {/* Preço (e estoque, quando o produto não tem variantes) — depois de Variantes, porque preço/estoque por variação depende delas */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{hasVariants ? 'Preço' : 'Preço e estoque'}</h2>
        {hasVariants && (
          <p className="mt-1 text-xs text-slate-400">
            Estoque e custo são geridos {isCreatingWithVariants ? 'na seção "Estoque inicial por variação" abaixo' : 'pelo painel "Repor estoque por variação" acima'} — aqui é só o preço.
          </p>
        )}

        {hasVariants && (
          <div className="mt-3 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={!pricePerVariant}
                onChange={() => setPricePerVariant(false)}
                className="h-4 w-4 border-slate-300"
              />
              Preço único
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={pricePerVariant}
                onChange={() => setPricePerVariant(true)}
                className="h-4 w-4 border-slate-300"
              />
              Preço por variação
            </label>
          </div>
        )}

        {(!hasVariants || !pricePerVariant) && (
          <div className={`mt-4 grid gap-4 sm:grid-cols-2 ${hasVariants ? '' : 'lg:grid-cols-4'}`}>
            {!hasVariants && (
              <div>
                <label className="text-sm font-medium text-slate-700">Custo total do lote (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  placeholder="quanto pagou no total por essa quantidade"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700">Preço (R$)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Preço promocional</label>
              <input
                type="number"
                step="0.01"
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                placeholder="opcional"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            {!hasVariants && (
              <div>
                <label className="text-sm font-medium text-slate-700">Estoque</label>
                <input
                  type="number"
                  min={0}
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            )}
          </div>
        )}

        {hasVariants && pricePerVariant && (
          variantPriceRows.length > 0 ? (
            <VariantPriceRows
              rows={variantPriceRows}
              prices={variantPrices}
              onPriceChange={setVariantPrice}
              promoPrices={variantPromoPrices}
              onPromoPriceChange={setVariantPromoPrice}
            />
          ) : (
            <p className="mt-3 text-xs text-slate-400">Defina ao menos um grupo de variante acima para poder definir o preço de cada combinação.</p>
          )
        )}

        {!hasVariants && Number(totalCost) > 0 && Number(stockQuantity) > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Custo por unidade:{' '}
            <span className="font-semibold text-slate-700">
              {(Number(totalCost) / Number(stockQuantity)).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </span>
            {Number(price) > 0 && (
              <>
                {' '}
                · Lucro por unidade:{' '}
                <span className="font-semibold text-slate-700">
                  {(
                    (Number(promoPrice) || Number(price)) -
                    Number(totalCost) / Number(stockQuantity)
                  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </>
            )}
          </p>
        )}
        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Produto em destaque
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Visível no site
          </label>
        </div>
      </section>

      {/* Estoque inicial por variação — só ao cadastrar um produto novo com variantes; mesma mecânica do "Repor estoque" */}
      {isCreatingWithVariants && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Estoque inicial por variação</h2>
          <p className="mt-1 text-xs text-slate-400">
            Informe o valor total do lote e distribua a quantidade entre cor/tamanho — a soma precisa bater com o
            total.
          </p>
          <div className="mt-4">
            <VariantStockAllocator
              rows={draftAllocatorRows}
              totalQuantity={initialTotalQuantity}
              onTotalQuantityChange={setInitialTotalQuantity}
              totalCost={initialTotalCost}
              onTotalCostChange={setInitialTotalCost}
              allocations={initialAllocations}
              onAllocationChange={(key, value) => setInitialAllocations((prev) => ({ ...prev, [key]: value }))}
              note={initialNote}
              onNoteChange={setInitialNote}
            />
          </div>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar produto'}
        </button>
        <button type="button" onClick={() => router.push('/produtos')} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          Cancelar
        </button>
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

/** Linhas de Preço/Promo por variação — usada tanto ao cadastrar (chave = comboKey) quanto ao editar (chave = sku.id). */
function VariantPriceRows({
  rows,
  prices,
  onPriceChange,
  promoPrices,
  onPromoPriceChange,
}: {
  rows: { key: string; label: string }[];
  prices: Record<string, string>;
  onPriceChange: (key: string, value: string) => void;
  promoPrices: Record<string, string>;
  onPromoPriceChange: (key: string, value: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-2.5">
          <span className="flex-1 text-sm text-slate-700">{row.label}</span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={prices[row.key] ?? ''}
            onChange={(e) => onPriceChange(row.key, e.target.value)}
            placeholder="Preço"
            className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <input
            type="number"
            step="0.01"
            min={0}
            value={promoPrices[row.key] ?? ''}
            onChange={(e) => onPromoPriceChange(row.key, e.target.value)}
            placeholder="Promo"
            className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
      ))}
    </div>
  );
}
