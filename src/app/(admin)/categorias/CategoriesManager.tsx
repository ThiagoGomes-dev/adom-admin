'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Pencil, Plus, X, Loader2, ImagePlus } from 'lucide-react';
import type { Category } from '@/types';
import { slugify } from '@/lib/slug';
import { compressImage } from '@/lib/compressImage';
import { extractStoragePath } from '@/lib/storagePath';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { card, primaryButton } from '@/components/ui/PageHeader';
import { createCategory, updateCategory, deleteCategory } from './actions';

export function CategoriesManager({ initialCategories }: { initialCategories: Category[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { page, pageCount, pageItems, setPage, total, pageSize } = usePagination(categories);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setImage('');
    setError(null);
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setImage(category.image ?? '');
  };

  const handleImageUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    let toUpload: File;
    try {
      toUpload = await compressImage(file);
    } catch {
      toUpload = file; // se a compressão falhar por algum motivo, sobe o arquivo original
    }

    const path = `categories/${Date.now()}-${slugify(file.name)}`;
    const { error: uploadError } = await supabase.storage.from('product-images').upload(path, toUpload);
    if (uploadError) {
      setError(`Erro ao enviar imagem: ${uploadError.message}`);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    setImage(data.publicUrl);
    setUploading(false);
  };

  const removeImage = async () => {
    const path = image ? extractStoragePath(image) : null;
    setImage('');
    if (path) {
      await supabase.storage.from('product-images').remove([path]);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const slug = slugify(name);
    const result = editingId
      ? await updateCategory(editingId, { name, slug, image })
      : await createCategory({ name, slug, image });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    const savedImage = image;
    resetForm();
    router.refresh();
    setCategories((prev) =>
      editingId
        ? prev.map((c) => (c.id === editingId ? { ...c, name, slug, image: savedImage } : c))
        : [...prev, { id: crypto.randomUUID(), name, slug, image: savedImage }],
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta categoria? Produtos que a usam ficarão sem categoria.')) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    const result = await deleteCategory(id);
    if (result.error) setError(result.error);
    router.refresh();
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className={cn(card, 'p-5')}>
        <p className="font-display text-lg font-medium text-ink">{editingId ? 'Editar categoria' : 'Nova categoria'}</p>

        <div className="mt-4 flex items-center gap-3">
          <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-bronze hover:text-bronze-text">
            {uploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : image ? (
              <img src={image} alt="Capa da categoria" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus size={20} />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleImageUpload(e.target.files)}
            />
          </label>
          {image && !uploading ? (
            <button type="button" onClick={removeImage} className="text-xs font-medium text-slate-500 hover:text-red-600">
              Remover imagem
            </button>
          ) : (
            <p className="text-xs text-slate-500">Imagem de capa (opcional)</p>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da categoria"
            aria-label="Nome da categoria"
            className="min-h-11 rounded-xl border border-line px-3.5 text-sm text-ink focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || uploading || !name.trim()}
              className={cn(primaryButton, 'flex-1')}
            >
              <Plus size={16} /> {editingId ? 'Salvar' : 'Adicionar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                aria-label="Cancelar edição"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line text-slate-500 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className={cn(card, 'overflow-hidden')}>
        <ul>
          {pageItems.map((category, i) => (
            <li
              key={category.id}
              className={cn('flex items-center justify-between gap-3 px-5 py-3', i > 0 && 'border-t border-slate-100')}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                  {category.image ? (
                    <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus size={16} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{category.name}</p>
                  <p className="truncate text-xs text-slate-500">{category.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(category)}
                  aria-label={`Editar ${category.name}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-ink"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(category.id)}
                  aria-label={`Excluir ${category.name}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
          {total === 0 && <li className="px-5 py-14 text-center text-sm text-slate-500">Nenhuma categoria ainda.</li>}
        </ul>
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="categorias"
        />
      </div>
    </div>
  );
}
