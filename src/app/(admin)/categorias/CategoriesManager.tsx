'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { Trash2, Pencil, Plus, X, Loader2, ImagePlus, GripVertical, CornerDownRight } from 'lucide-react';
import type { Category } from '@/types';
import { slugify } from '@/lib/slug';
import { compressImage } from '@/lib/compressImage';
import { extractStoragePath } from '@/lib/storagePath';
import { createClient } from '@/lib/supabase/client';
import {
  buildCategoryTree,
  categoryOptions,
  categorySlug,
  compareCategories,
  descendantIds,
  flattenCategoryTree,
  planCategoryMove,
} from '@/lib/categoryTree';
import { cn } from '@/lib/cn';
import { card, primaryButton } from '@/components/ui/PageHeader';
import { createCategory, updateCategory, deleteCategory, moveCategory } from './actions';

const ROOT_DROP_ID = '__root__';

type DropZone = 'before' | 'inside' | 'after';
interface DropTarget {
  overId: string;
  zone: DropZone;
}

export function CategoriesManager({ initialCategories }: { initialCategories: Category[] }) {
  const router = useRouter();
  const supabase = createClient();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [parentId, setParentId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const rows = useMemo(() => flattenCategoryTree(tree), [tree]);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Onde a categoria em edição pode ir: qualquer lugar fora dela mesma e das subcategorias dela.
  const blockedIds = useMemo(
    () => (editingId ? descendantIds(categories, editingId) : new Set<string>()),
    [categories, editingId],
  );
  const parentOptions = useMemo(
    () => categoryOptions(categories).filter((o) => !blockedIds.has(o.id)),
    [categories, blockedIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setImage('');
    setParentId('');
    setError(null);
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setImage(category.image ?? '');
    setParentId(category.parentId && byId.has(category.parentId) ? category.parentId : '');
    setError(null);
    nameInputRef.current?.focus();
  };

  const startNewSubcategory = (parent: Category) => {
    resetForm();
    setParentId(parent.id);
    nameInputRef.current?.focus();
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

  /** Aplica o movimento na tela na hora e salva; se o servidor recusar, volta como estava. */
  const applyMove = async (id: string, newParentId: string | null, index: number) => {
    const plan = planCategoryMove(categories, id, newParentId, index);
    if ('error' in plan) {
      setError(plan.error);
      return false;
    }
    const previous = categories;
    const changes = new Map(plan.updates.map((u) => [u.id, u]));
    setCategories((prev) =>
      prev.map((c) => {
        const u = changes.get(c.id);
        return u ? { ...c, parentId: u.parentId ?? undefined, sortOrder: u.sortOrder } : c;
      }),
    );
    const result = await moveCategory(id, newParentId, index).catch(() => ({
      error: 'Não foi possível salvar a nova posição. Tente de novo.',
    }));
    if (result.error) {
      setError(result.error);
      setCategories(previous);
      return false;
    }
    router.refresh();
    return true;
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const parent = parentId ? byId.get(parentId) : null;
    const slug = categorySlug(name, parent);

    if (editingId) {
      const current = byId.get(editingId);
      const result = await updateCategory(editingId, { name, slug, image });
      if (result.error) {
        setSaving(false);
        setError(result.error);
        return;
      }
      setCategories((prev) => prev.map((c) => (c.id === editingId ? { ...c, name, slug, image } : c)));
      const currentParent = current?.parentId && byId.has(current.parentId) ? current.parentId : '';
      if (currentParent !== parentId) {
        await applyMove(editingId, parentId || null, Infinity);
      }
    } else {
      const result = await createCategory({ name, slug, image, parentId: parentId || null });
      if (result.error) {
        setSaving(false);
        setError(result.error);
        return;
      }
      const siblings = categories.filter((c) => (c.parentId ?? '') === parentId);
      setCategories((prev) => [
        ...prev,
        {
          id: result.id ?? crypto.randomUUID(),
          name,
          slug,
          image,
          parentId: parentId || undefined,
          sortOrder: siblings.reduce((max, c) => Math.max(max, (c.sortOrder ?? 0) + 1), 0),
        },
      ]);
    }

    setSaving(false);
    resetForm();
    router.refresh();
  };

  const handleDelete = async (category: Category) => {
    const childCount = categories.filter((c) => c.parentId === category.id).length;
    const message = childCount
      ? `Excluir "${category.name}"? As ${childCount} subcategorias dela sobem um nível. Produtos desta categoria ficarão sem categoria.`
      : `Excluir "${category.name}"? Produtos que a usam ficarão sem categoria.`;
    if (!confirm(message)) return;

    const previous = categories;
    setCategories((prev) =>
      prev
        .filter((c) => c.id !== category.id)
        .map((c) => (c.parentId === category.id ? { ...c, parentId: category.parentId } : c)),
    );
    if (editingId === category.id) resetForm();
    const result = await deleteCategory(category.id).catch(() => ({ error: 'Não foi possível excluir. Tente de novo.' }));
    if (result.error) {
      setError(result.error);
      setCategories(previous);
    }
    router.refresh();
  };

  // ---- arrastar e soltar -------------------------------------------------

  const zoneFor = (event: DragMoveEvent | DragEndEvent): DropTarget | null => {
    const { active, over, delta } = event;
    if (!over || !pointerStart.current) return null;
    const overId = String(over.id);
    if (overId === ROOT_DROP_ID) return { overId, zone: 'inside' };
    if (descendantIds(categories, String(active.id)).has(overId)) return null;

    const y = pointerStart.current.y + delta.y;
    const ratio = (y - over.rect.top) / over.rect.height;
    const zone: DropZone = ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'inside';
    return { overId, zone };
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    pointerStart.current = getEventCoordinates(event.activatorEvent);
    setError(null);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const next = zoneFor(event);
    setDropTarget((prev) => (prev?.overId === next?.overId && prev?.zone === next?.zone ? prev : next));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const target = zoneFor(event);
    const id = String(event.active.id);
    setActiveId(null);
    setDropTarget(null);
    pointerStart.current = null;
    if (!target) return;

    if (target.overId === ROOT_DROP_ID) {
      await applyMove(id, null, Infinity);
      return;
    }
    if (target.zone === 'inside') {
      await applyMove(id, target.overId, Infinity);
      return;
    }

    const over = byId.get(target.overId);
    if (!over) return;
    const newParent = over.parentId && byId.has(over.parentId) ? over.parentId : null;
    const siblings = categories
      .filter((c) => c.id !== id && (c.parentId && byId.has(c.parentId) ? c.parentId : null) === newParent)
      .sort(compareCategories);
    const overIndex = siblings.findIndex((c) => c.id === over.id);
    await applyMove(id, newParent, target.zone === 'before' ? overIndex : overIndex + 1);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDropTarget(null);
    pointerStart.current = null;
  };

  const activeCategory = activeId ? byId.get(activeId) : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className={cn(card, 'p-5')}>
        <p className="font-display text-lg font-medium text-ink">
          {editingId ? 'Editar categoria' : parentId ? 'Nova subcategoria' : 'Nova categoria'}
        </p>

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
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={parentId ? 'Nome da subcategoria' : 'Nome da categoria'}
            aria-label="Nome da categoria"
            className="min-h-11 rounded-xl border border-line px-3.5 text-sm text-ink focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
          <label className="mt-1 text-xs font-medium text-slate-600" htmlFor="category-parent">
            Fica dentro de
          </label>
          <select
            id="category-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="min-h-11 rounded-xl border border-line bg-white px-3.5 text-sm text-ink focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          >
            <option value="">Nenhuma (categoria principal)</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || uploading || !name.trim()}
              className={cn(primaryButton, 'flex-1')}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {editingId ? 'Salvar' : 'Adicionar'}
            </button>
            {(editingId || parentId) && (
              <button
                type="button"
                onClick={resetForm}
                aria-label="Cancelar"
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
        <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
          Arraste pelo <GripVertical size={12} className="inline align-[-2px]" /> e solte <strong>em cima</strong> de
          uma categoria para ela virar subcategoria, ou <strong>entre</strong> duas para mudar a ordem. A loja mostra
          o menu nesta mesma ordem.
        </p>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <ul>
            {rows.map(({ category, depth }, i) => (
              <CategoryRow
                key={category.id}
                category={category}
                depth={depth}
                first={i === 0}
                childCount={category.children.length}
                dragging={activeId === category.id}
                dropZone={dropTarget?.overId === category.id ? dropTarget.zone : null}
                onEdit={() => startEdit(category)}
                onAddChild={() => startNewSubcategory(category)}
                onDelete={() => handleDelete(category)}
              />
            ))}
            {rows.length === 0 && (
              <li className="px-5 py-14 text-center text-sm text-slate-500">Nenhuma categoria ainda.</li>
            )}
          </ul>
          {activeCategory?.parentId && <RootDropZone active={dropTarget?.overId === ROOT_DROP_ID} />}
          <DragOverlay dropAnimation={null}>
            {activeCategory && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-bronze bg-white px-3 py-2 text-sm font-semibold text-ink shadow-lg">
                <GripVertical size={14} className="text-slate-400" />
                {activeCategory.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  depth,
  first,
  childCount,
  dragging,
  dropZone,
  onEdit,
  onAddChild,
  onDelete,
}: {
  category: Category;
  depth: number;
  first: boolean;
  childCount: number;
  dragging: boolean;
  dropZone: DropZone | null;
  onEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef: setDragRef, setActivatorNodeRef, listeners, attributes } = useDraggable({ id: category.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: category.id });

  return (
    <li
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={cn(
        'relative flex items-center justify-between gap-2 py-2.5 pr-3',
        !first && 'border-t border-slate-100',
        dragging && 'opacity-40',
        dropZone === 'inside' && 'bg-bronze-soft/30 ring-2 ring-inset ring-bronze',
      )}
      style={{ paddingLeft: 8 + depth * 28 }}
    >
      {dropZone === 'before' && <span className="absolute inset-x-3 -top-px h-0.5 rounded bg-bronze" />}
      {dropZone === 'after' && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded bg-bronze" />}

      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label={`Arrastar ${category.name}`}
          className="inline-flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        {depth > 0 && <CornerDownRight size={14} className="shrink-0 text-slate-300" />}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
          {category.image ? (
            <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={14} className="text-slate-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{category.name}</p>
          <p className="truncate text-xs text-slate-500">
            {childCount > 0 ? `${childCount} ${childCount === 1 ? 'subcategoria' : 'subcategorias'} · ` : ''}
            {category.slug}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={onAddChild}
          aria-label={`Nova subcategoria em ${category.name}`}
          title="Nova subcategoria"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-ink"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${category.name}`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-ink"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Excluir ${category.name}`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-slate-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}

/** Aparece ao arrastar uma subcategoria: soltar aqui faz ela voltar a ser categoria principal. */
function RootDropZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: ROOT_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'm-3 rounded-xl border-2 border-dashed px-4 py-4 text-center text-xs font-medium',
        active ? 'border-bronze bg-bronze-soft/30 text-bronze-text' : 'border-slate-200 text-slate-500',
      )}
    >
      Solte aqui para virar categoria principal
    </div>
  );
}
