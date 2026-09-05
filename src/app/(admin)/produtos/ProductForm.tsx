'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';
import type { Category, Product, ProductVariantGroup } from '@/types';
import { slugify } from '@/lib/slug';
import { createClient } from '@/lib/supabase/client';
import { createProduct, updateProduct } from './actions';
import type { ProductInput } from '@/lib/mappers';

interface ProductFormProps {
  categories: Category[];
  product?: Product;
}

let tempId = 0;
const nextTempId = () => `tmp-${Date.now()}-${tempId++}`;

export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(product);

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [description, setDescription] = useState(product?.description ?? '');
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? '');
  const [category, setCategory] = useState(product?.category ?? categories[0]?.slug ?? '');
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
      const path = `${Date.now()}-${slugify(file.name)}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file);
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

  const removeImage = (url: string) => setImages((prev) => prev.filter((img) => img !== url));

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

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim() || !slug.trim() || !category) {
      setError('Preencha nome, slug e categoria.');
      return;
    }

    const input: ProductInput = {
      slug: slugify(slug),
      name,
      description,
      shortDescription: shortDescription || undefined,
      price: Number(price) || 0,
      promoPrice: promoPrice ? Number(promoPrice) : undefined,
      images,
      category,
      variants: variants.filter((g) => g.name.trim() && g.options.length > 0),
      available,
      featured,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      stockQuantity: Number(stockQuantity) || 0,
    };

    setSaving(true);
    const result = isEditing ? await updateProduct(product!.id, input) : await createProduct(input);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

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
            <label className="text-sm font-medium text-slate-700">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {categories.map((c) => (
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

      {/* Preço e estoque */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Preço e estoque</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
        </div>
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

      {/* Imagens */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fotos</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {images.map((url) => (
            <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
              <Image src={url} alt="" fill sizes="96px" className="object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={12} />
              </button>
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
    </div>
  );
}
