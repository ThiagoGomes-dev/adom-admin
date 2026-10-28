import { describe, expect, it } from 'vitest';
import {
  buildCategoryTree,
  categoryOptions,
  categorySlug,
  descendantSlugs,
  flattenCategoryTree,
  planCategoryMove,
} from '../categoryTree';
import type { Category } from '@/types';

const categories: Category[] = [
  { id: 'r', name: 'Regatas', slug: 'regatas', sortOrder: 1 },
  { id: 'c', name: 'Camisetas', slug: 'camisetas', sortOrder: 0 },
  { id: 'c2', name: 'Oversized', slug: 'camisetas-oversized', parentId: 'c', sortOrder: 0 },
  { id: 'c1', name: 'Básicas', slug: 'camisetas-basicas', parentId: 'c', sortOrder: 1 },
  { id: 'c21', name: 'Estampadas', slug: 'camisetas-oversized-estampadas', parentId: 'c2', sortOrder: 0 },
  { id: 'x', name: 'Órfã', slug: 'orfa', parentId: 'apagada', sortOrder: 2 },
];

describe('buildCategoryTree', () => {
  it('monta vários níveis respeitando a ordem salva', () => {
    const flat = flattenCategoryTree(buildCategoryTree(categories)).map(({ category, depth }) => [category.name, depth]);
    expect(flat).toEqual([
      ['Camisetas', 0],
      ['Oversized', 1],
      ['Estampadas', 2],
      ['Básicas', 1],
      ['Regatas', 0],
      ['Órfã', 0],
    ]);
  });

  it('não entra em loop se o banco tiver um ciclo', () => {
    const loop: Category[] = [
      { id: 'a', name: 'A', slug: 'a', parentId: 'b' },
      { id: 'b', name: 'B', slug: 'b', parentId: 'a' },
    ];
    expect(buildCategoryTree(loop)).toEqual([]);
  });
});

describe('categoryOptions', () => {
  it('lista a árvore com o caminho no rótulo', () => {
    expect(categoryOptions(categories).slice(0, 4).map((o) => o.label)).toEqual([
      'Camisetas',
      'Camisetas › Oversized',
      'Camisetas › Oversized › Estampadas',
      'Camisetas › Básicas',
    ]);
  });
});

describe('descendantSlugs', () => {
  it('inclui a categoria e todas as subcategorias abaixo dela', () => {
    expect([...descendantSlugs(categories, 'camisetas')].sort()).toEqual([
      'camisetas',
      'camisetas-basicas',
      'camisetas-oversized',
      'camisetas-oversized-estampadas',
    ]);
  });
});

describe('categorySlug', () => {
  it('prefixa o slug do pai nas subcategorias', () => {
    expect(categorySlug('Oversized', { slug: 'camisetas' })).toBe('camisetas-oversized');
    expect(categorySlug('Camisetas Polo')).toBe('camisetas-polo');
  });
});

describe('planCategoryMove', () => {
  it('soltar em cima de outra categoria vira a última subcategoria dela', () => {
    expect(planCategoryMove(categories, 'r', 'c', Infinity)).toEqual({
      updates: [{ id: 'r', parentId: 'c', sortOrder: 2 }],
    });
  });

  it('reordena as irmãs ao soltar entre elas', () => {
    expect(planCategoryMove(categories, 'c1', 'c', 0)).toEqual({
      updates: [
        { id: 'c1', parentId: 'c', sortOrder: 0 },
        { id: 'c2', parentId: 'c', sortOrder: 1 },
      ],
    });
  });

  it('subcategoria arrastada para a raiz vira categoria principal', () => {
    const result = planCategoryMove(categories, 'c21', null, 1);
    expect(result).toEqual({
      updates: [
        { id: 'c21', parentId: null, sortOrder: 1 },
        { id: 'r', parentId: null, sortOrder: 2 },
        { id: 'x', parentId: null, sortOrder: 3 },
      ],
    });
  });

  it('impede colocar uma categoria dentro de uma subcategoria dela', () => {
    expect(planCategoryMove(categories, 'c', 'c21', 0)).toHaveProperty('error');
    expect(planCategoryMove(categories, 'c', 'c', 0)).toHaveProperty('error');
  });
});
