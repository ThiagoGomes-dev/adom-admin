import type { ProductVariantGroup, VariantSkuComboEntry } from '@/types';

/** Todas as combinações possíveis dos grupos de variação (produto cartesiano). */
export function cartesianCombos(variants: ProductVariantGroup[]): VariantSkuComboEntry[][] {
  return variants.reduce<VariantSkuComboEntry[][]>(
    (acc, group) =>
      acc.flatMap((combo) =>
        group.options.map((option) => [
          ...combo,
          { groupId: group.id, groupName: group.name, optionId: option.id, optionLabel: option.label },
        ]),
      ),
    [[]],
  );
}

/** Chave estável e independente da ordem dos grupos, pra identificar a mesma combinação. */
export function comboKeyOf(combo: VariantSkuComboEntry[]): string {
  return combo
    .map((c) => `${c.groupId}:${c.optionId}`)
    .sort()
    .join('|');
}

/** Rótulo pronto pra exibição, ex: "Preta / P". */
export function comboLabelOf(combo: VariantSkuComboEntry[]): string {
  return combo.map((c) => c.optionLabel).join(' / ');
}
