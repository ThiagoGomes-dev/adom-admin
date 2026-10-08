'use client';

import Image from 'next/image';
import { Plus, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Category } from '@/types';

interface ProductInfoStepProps {
  name: string;
  onNameChange: (value: string) => void;
  slug: string;
  onSlugChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  shortDescription: string;
  onShortDescriptionChange: (value: string) => void;
  categoryList: Category[];
  category: string;
  onCategoryChange: (value: string) => void;
  onOpenCategoryModal: () => void;
  tags: string;
  onTagsChange: (value: string) => void;
  featured: boolean;
  onFeaturedChange: (value: boolean) => void;
  available: boolean;
  onAvailableChange: (value: boolean) => void;
  images: string[];
  uploading: boolean;
  onImageUpload: (files: FileList | null) => void;
  onRemoveImage: (url: string) => void;
  onMoveImage: (index: number, direction: -1 | 1) => void;
}

/** Passo 1 do cadastro/edição de produto: dados básicos + fotos. Extraído de `ProductForm.tsx` 1:1 (sem mudança de lógica), só pra caber no wizard. */
export function ProductInfoStep({
  name,
  onNameChange,
  slug,
  onSlugChange,
  description,
  onDescriptionChange,
  shortDescription,
  onShortDescriptionChange,
  categoryList,
  category,
  onCategoryChange,
  onOpenCategoryModal,
  tags,
  onTagsChange,
  featured,
  onFeaturedChange,
  available,
  onAvailableChange,
  images,
  uploading,
  onImageUpload,
  onRemoveImage,
  onMoveImage,
}: ProductInfoStepProps) {
  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Dados básicos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Slug (URL)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Descrição curta</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => onShortDescriptionChange(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Categoria</label>
              <button
                type="button"
                onClick={onOpenCategoryModal}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <Plus size={13} /> nova categoria
              </button>
            </div>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
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
              onChange={(e) => onTagsChange(e.target.value)}
              placeholder="mais vendido, promoção"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => onFeaturedChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Produto em destaque
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => onAvailableChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Visível no site
          </label>
        </div>
      </section>

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
                onClick={() => onRemoveImage(url)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={12} />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMoveImage(index, -1)}
                  className="rounded-full bg-white/90 p-1 text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                  title="Mover pra trás"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  disabled={index === images.length - 1}
                  onClick={() => onMoveImage(index, 1)}
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
              onChange={(e) => onImageUpload(e.target.files)}
            />
          </label>
        </div>
      </section>
    </>
  );
}
