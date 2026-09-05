'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Pencil, Plus, X } from 'lucide-react';
import type { Category } from '@/types';
import { slugify } from '@/lib/slug';
import { createCategory, updateCategory, deleteCategory } from './actions';

export function CategoriesManager({ initialCategories }: { initialCategories: Category[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setError(null);
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const slug = slugify(name);
    const result = editingId ? await updateCategory(editingId, { name, slug }) : await createCategory({ name, slug });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    resetForm();
    router.refresh();
    setCategories((prev) =>
      editingId
        ? prev.map((c) => (c.id === editingId ? { ...c, name, slug } : c))
        : [...prev, { id: crypto.randomUUID(), name, slug }],
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
    <div className="max-w-lg">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{editingId ? 'Editar categoria' : 'Nova categoria'}</p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da categoria"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus size={16} /> {editingId ? 'Salvar' : 'Adicionar'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <X size={16} />
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{category.name}</p>
              <p className="text-xs text-slate-500">{category.slug}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => startEdit(category)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(category.id)}
                className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
        {categories.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma categoria ainda.</li>}
      </ul>
    </div>
  );
}
