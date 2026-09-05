'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { rowToCategory, type CategoryRow } from '@/lib/mappers';
import type { Category } from '@/types';

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data as CategoryRow[]).map(rowToCategory);
}

export async function createCategory(input: { name: string; slug: string; icon?: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('categories').insert({ name: input.name, slug: input.slug, icon: input.icon || null });
  if (error) return { error: error.message };
  revalidatePath('/categorias');
  return {};
}

export async function updateCategory(
  id: string,
  input: { name: string; slug: string; icon?: string },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('categories')
    .update({ name: input.name, slug: input.slug, icon: input.icon || null })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/categorias');
  return {};
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/categorias');
  return {};
}
