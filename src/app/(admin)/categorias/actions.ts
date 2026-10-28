'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { rowToCategory, type CategoryRow } from '@/lib/mappers';
import { compareCategories, planCategoryMove } from '@/lib/categoryTree';
import type { Category } from '@/types';

// Ordenado aqui (e não no SQL) para continuar funcionando antes da migration
// 2026-10-27_category_parent, que cria sort_order.
export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*');
  if (error) throw new Error(error.message);
  return (data as CategoryRow[]).map(rowToCategory).sort(compareCategories);
}

function revalidateCategoryPages() {
  revalidatePath('/categorias');
  revalidatePath('/produtos');
}

export async function createCategory(input: {
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  parentId?: string | null;
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const parentId = input.parentId || null;
  const row: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
    icon: input.icon || null,
    image: input.image || null,
  };

  // Só mexe nas colunas novas quando é subcategoria, para a criação simples
  // (ex.: modal "nova categoria" do produto) funcionar mesmo antes da migration.
  if (parentId) {
    const categories = await listCategories();
    const siblings = categories.filter((c) => c.parentId === parentId);
    row.parent_id = parentId;
    row.sort_order = siblings.reduce((max, c) => Math.max(max, (c.sortOrder ?? 0) + 1), 0);
  }

  const { data, error } = await supabase.from('categories').insert(row).select('id').single();
  if (error) return { error: friendlyError(error.message) };
  revalidateCategoryPages();
  return { id: data.id };
}

export async function updateCategory(
  id: string,
  input: { name: string; slug: string; icon?: string; image?: string },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('categories')
    .update({ name: input.name, slug: input.slug, icon: input.icon || null, image: input.image || null })
    .eq('id', id);
  if (error) return { error: friendlyError(error.message) };
  revalidateCategoryPages();
  return {};
}

/**
 * Move a categoria para dentro de `parentId` (null = categoria principal) na
 * posição `index` entre as irmãs — é o que o arrastar e soltar chama.
 */
export async function moveCategory(id: string, parentId: string | null, index: number): Promise<{ error?: string }> {
  const categories = await listCategories();
  const plan = planCategoryMove(categories, id, parentId, index);
  if ('error' in plan) return { error: plan.error };

  const supabase = await createClient();
  const results = await Promise.all(
    plan.updates.map((u) =>
      supabase.from('categories').update({ parent_id: u.parentId, sort_order: u.sortOrder }).eq('id', u.id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: friendlyError(failed.error.message) };
  revalidateCategoryPages();
  return {};
}

/** Exclui a categoria; as subcategorias dela sobem um nível (vão para o pai dela). */
export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const categories = await listCategories();
  const target = categories.find((c) => c.id === id);
  const supabase = await createClient();

  const children = categories.filter((c) => c.parentId === id);
  if (children.length && target) {
    const { error } = await supabase
      .from('categories')
      .update({ parent_id: target.parentId ?? null })
      .in('id', children.map((c) => c.id));
    if (error) return { error: friendlyError(error.message) };
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return { error: friendlyError(error.message) };
  revalidateCategoryPages();
  return {};
}


function friendlyError(message: string): string {
  if (/categories_slug_key|duplicate key/i.test(message)) return 'Já existe uma categoria com esse nome nesse lugar.';
  if (/parent_id|sort_order/i.test(message)) {
    return 'O banco ainda não tem suporte a subcategorias. Rode a migration 2026-10-27_category_parent no Supabase.';
  }
  return message;
}
