import { describe, expect, it } from 'vitest';
import type { ProductVariantGroup } from '@/types';
import { cartesianCombos, comboKeyOf, comboLabelOf } from '../variantCombos';

const groups = [
  { id: 'cor', name: 'Cor', options: [{ id: 'preta', label: 'Preta' }, { id: 'branca', label: 'Branca' }] },
  { id: 'tam', name: 'Tamanho', options: [{ id: 'p', label: 'P' }, { id: 'm', label: 'M' }, { id: 'g', label: 'G' }] },
] as ProductVariantGroup[];

describe('cartesianCombos', () => {
  it('gera todas as combinações dos grupos', () => {
    const combos = cartesianCombos(groups);
    expect(combos).toHaveLength(6);
    expect(comboLabelOf(combos[0])).toBe('Preta / P');
  });

  it('sem grupos devolve uma combinação vazia', () => {
    expect(cartesianCombos([])).toEqual([[]]);
  });
});

describe('comboKeyOf', () => {
  it('é igual independente da ordem dos grupos', () => {
    const [combo] = cartesianCombos(groups);
    expect(comboKeyOf([...combo].reverse())).toBe(comboKeyOf(combo));
  });
});
