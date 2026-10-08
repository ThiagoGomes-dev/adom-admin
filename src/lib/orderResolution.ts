import type { ProductVariantSkuRow } from './mappers';

/**
 * Resolve o `sku_id` real de uma combinação de variantes enviada pelo site
 * (por nome do grupo/opção, nunca por id — o carrinho do storefront não
 * conhece ids de SKU) — mesma comparação que `findComboEntry` já faz no
 * storefront (`src/lib/stock.ts`), portada pro servidor porque é aqui que a
 * reserva de estoque de fato acontece. `null` quando o produto não tem
 * variação nenhuma (usa-se o estoque do produto direto, sem sku) ou quando
 * nenhuma combinação bate (o item fica inválido — a rota deve rejeitar).
 */
export function resolveSkuId(
  productId: string,
  skuRows: ProductVariantSkuRow[],
  selectedVariants: Record<string, string> | undefined | null,
): string | null {
  const rows = skuRows.filter((r) => r.product_id === productId);
  if (rows.length === 0) return null;

  const entries = Object.entries(selectedVariants ?? {});
  if (entries.length === 0) return null;

  const match = rows.find((row) => {
    const selection = Object.fromEntries((row.combo ?? []).map((c) => [c.groupName, c.optionLabel]));
    return (
      entries.every(([group, option]) => selection[group] === option) &&
      Object.keys(selection).length === entries.length
    );
  });

  return match?.id ?? null;
}
