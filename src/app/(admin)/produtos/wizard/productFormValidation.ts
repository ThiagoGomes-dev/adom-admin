import type { ProductVariantGroup } from '@/types';
import { allocatorCanSubmit, type VariantStockAllocatorRow } from '../VariantStockAllocator';

/**
 * Validação por passo do cadastro/edição de produto — usada tanto pelo botão
 * "Avançar" do wizard (gate entre passos, só na criação) quanto pelo submit
 * final (edição, ou o clique em "Criar produto" no último passo), pra nunca
 * ter duas implementações da mesma regra que podem ficar dessincronizadas.
 */

export function validateInfoStep(input: { name: string; slug: string; category: string }): string | null {
  if (!input.name.trim() || !input.slug.trim() || !input.category) {
    return 'Preencha nome, slug e categoria.';
  }
  return null;
}

export function validateVariantsStep(input: {
  hasVariantStock: boolean;
  filteredVariants: ProductVariantGroup[];
  hasVariants: boolean;
  variantPriceRows: { key: string }[];
  variantPrices: Record<string, string>;
}): string | null {
  if (input.hasVariantStock && input.filteredVariants.length === 0) {
    return 'Este produto tem estoque distribuído por variação — remova o estoque das variações (no passo Estoque) antes de apagar todos os grupos.';
  }

  if (input.hasVariants) {
    const missingPrice =
      input.variantPriceRows.length === 0 ||
      input.variantPriceRows.some((row) => !(input.variantPrices[row.key] ?? '').trim());
    if (missingPrice) {
      return 'Preencha o preço de todas as variações no passo "Variações".';
    }
  }

  return null;
}

export function validateStockStep(input: {
  isEditing: boolean;
  isCreatingWithVariants: boolean;
  hasVariants: boolean;
  draftAllocatorRows: VariantStockAllocatorRow[];
  initialTotalQuantity: string;
  initialTotalCost: string;
  initialAllocations: Record<string, string>;
  initialSimpleQuantity: string;
  initialSimpleCost: string;
}): string | null {
  const attemptingInitialVariantStock =
    input.isCreatingWithVariants && (Number(input.initialTotalQuantity) > 0 || Number(input.initialTotalCost) > 0);
  if (
    attemptingInitialVariantStock &&
    !allocatorCanSubmit(input.draftAllocatorRows, input.initialTotalQuantity, input.initialTotalCost, input.initialAllocations)
  ) {
    return 'No passo Estoque: informe a quantidade total do lote, o valor pago e distribua entre as variações (a soma precisa bater) — ou deixe tudo em branco pra cadastrar sem estoque ainda.';
  }

  const attemptingInitialSimpleStock =
    !input.isEditing &&
    !input.hasVariants &&
    (Number(input.initialSimpleQuantity) > 0 || Number(input.initialSimpleCost) > 0);
  if (attemptingInitialSimpleStock && (Number(input.initialSimpleQuantity) <= 0 || Number(input.initialSimpleCost) <= 0)) {
    return 'No passo Estoque: informe quantidade e valor total pago do estoque inicial — ou deixe os dois em branco pra cadastrar sem estoque ainda.';
  }

  return null;
}
