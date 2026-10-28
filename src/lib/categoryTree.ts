import type { Category } from '@/types';
import { slugify } from './slug';

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

/** Ordem entre irmãs: a posição definida no arrastar e soltar, depois o nome. */
export function compareCategories(a: Category, b: Category): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'pt-BR');
}

/**
 * Monta a árvore (quantos níveis houver) a partir da lista plana do banco.
 * Categoria cujo pai não está na lista aparece na raiz, pra nunca sumir.
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const ids = new Set(categories.map((c) => c.id));
  const childrenOf = new Map<string | null, Category[]>();
  for (const c of categories) {
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : null;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), c]);
  }

  const seen = new Set<string>();
  const build = (parentId: string | null): CategoryNode[] =>
    (childrenOf.get(parentId) ?? [])
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .sort(compareCategories)
      .map((c) => ({ ...c, children: build(c.id) }));

  return build(null);
}

/** Árvore achatada em pré-ordem, com a profundidade de cada item (0 = principal). */
export function flattenCategoryTree(tree: CategoryNode[], depth = 0): { category: CategoryNode; depth: number }[] {
  return tree.flatMap((node) => [{ category: node, depth }, ...flattenCategoryTree(node.children, depth + 1)]);
}

/** ids da categoria e de tudo que está dentro dela, em qualquer nível. */
export function descendantIds(categories: Category[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id);
        grew = true;
      }
    }
  }
  return out;
}

/** slugs da categoria e das subcategorias dela — filtrar por "Camisetas" inclui "Camisetas › Oversized". */
export function descendantSlugs(categories: Category[], slug: string): Set<string> {
  const root = categories.find((c) => c.slug === slug);
  if (!root) return new Set([slug]);
  const ids = descendantIds(categories, root.id);
  return new Set(categories.filter((c) => ids.has(c.id)).map((c) => c.slug));
}

/**
 * Lista para <select>: a árvore em ordem, com o caminho no rótulo
 * ("Camisetas › Oversized").
 */
export function categoryOptions(categories: Category[]): { value: string; label: string; id: string }[] {
  const walk = (nodes: CategoryNode[], prefix: string): { value: string; label: string; id: string }[] =>
    nodes.flatMap((node) => {
      const label = prefix ? `${prefix} › ${node.name}` : node.name;
      return [{ value: node.slug, label, id: node.id }, ...walk(node.children, label)];
    });
  return walk(buildCategoryTree(categories), '');
}

/**
 * Slug de uma categoria nova. Subcategoria leva o slug do pai na frente
 * ("camisetas-oversized"), assim "Oversized" pode existir em Camisetas e em Regatas.
 */
export function categorySlug(name: string, parent?: Pick<Category, 'slug'> | null): string {
  const own = slugify(name);
  return parent ? `${parent.slug}-${own}` : own;
}

export interface CategoryPlacement {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

/**
 * Calcula o que muda no banco ao mover `id` para dentro de `parentId`
 * (null = principal) na posição `index` entre as novas irmãs.
 * Devolve só as linhas que mudaram, ou um erro se o destino estiver dentro
 * da própria categoria (criaria um ciclo).
 */
export function planCategoryMove(
  categories: Category[],
  id: string,
  parentId: string | null,
  index: number,
): { updates: CategoryPlacement[] } | { error: string } {
  const moving = categories.find((c) => c.id === id);
  if (!moving) return { error: 'Categoria não encontrada.' };
  if (parentId && descendantIds(categories, id).has(parentId)) {
    return { error: 'Não dá para colocar uma categoria dentro dela mesma ou de uma subcategoria dela.' };
  }
  if (parentId && !categories.some((c) => c.id === parentId)) return { error: 'Categoria pai não encontrada.' };

  const ids = new Set(categories.map((c) => c.id));
  const effectiveParent = (c: Category) => (c.parentId && ids.has(c.parentId) ? c.parentId : null);
  const siblings = categories
    .filter((c) => c.id !== id && effectiveParent(c) === parentId)
    .sort(compareCategories);
  const position = Math.max(0, Math.min(index, siblings.length));
  const ordered = [...siblings.slice(0, position), moving, ...siblings.slice(position)];

  const updates = ordered
    .map((c, i) => ({ id: c.id, parentId, sortOrder: i, before: c }))
    .filter(({ before, sortOrder }) => before.id === id || (before.sortOrder ?? 0) !== sortOrder)
    .map(({ id: rowId, sortOrder }) => ({ id: rowId, parentId, sortOrder }));

  return { updates };
}
