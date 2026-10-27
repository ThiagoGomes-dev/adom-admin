import { describe, expect, it } from 'vitest';
import type { ProductVariantSkuRow } from '../mappers';
import { resolveSkuId } from '../orderResolution';

function sku(id: string, productId: string, combo: Record<string, string>): ProductVariantSkuRow {
  return {
    id,
    product_id: productId,
    combo: Object.entries(combo).map(([groupName, optionLabel]) => ({
      groupId: groupName,
      groupName,
      optionId: optionLabel,
      optionLabel,
    })),
  } as ProductVariantSkuRow;
}

const rows = [
  sku('sku-preta-p', 'camiseta', { Cor: 'Preta', Tamanho: 'P' }),
  sku('sku-preta-m', 'camiseta', { Cor: 'Preta', Tamanho: 'M' }),
  sku('sku-outro', 'bermuda', { Tamanho: 'P' }),
];

describe('resolveSkuId', () => {
  it('acha o sku pela combinação de nomes enviada pelo site', () => {
    expect(resolveSkuId('camiseta', rows, { Tamanho: 'M', Cor: 'Preta' })).toBe('sku-preta-m');
  });

  it('não aceita seleção incompleta', () => {
    expect(resolveSkuId('camiseta', rows, { Cor: 'Preta' })).toBeNull();
  });

  it('não mistura skus de outro produto', () => {
    expect(resolveSkuId('camiseta', rows, { Tamanho: 'P' })).toBeNull();
  });

  it('produto sem variação devolve null', () => {
    expect(resolveSkuId('meia', rows, { Cor: 'Preta' })).toBeNull();
    expect(resolveSkuId('camiseta', rows, null)).toBeNull();
  });
});
