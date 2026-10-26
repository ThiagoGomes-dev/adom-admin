/**
 * Regra de frete da loja — calculada SEMPRE no servidor. O site mostra a
 * mesma conta só pra exibir (src/lib/shipping.ts no projeto do site), mas o
 * valor cobrado no Mercado Pago é o daqui: nada que venha do navegador
 * define quanto se paga de frete.
 */

export type DeliveryMethod = 'delivery' | 'pickup';

export const LOCAL_SHIPPING_CITY = 'Campina Grande';
export const LOCAL_SHIPPING_COST = 12;
export const REMOTE_SHIPPING_COST = 49.9;
/** mesmo valor anunciado na faixa do site ("FRETE GRÁTIS A PARTIR DE R$ 399,90") */
export const FREE_SHIPPING_MIN_SUBTOTAL = 399.9;

function normalizeCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Cidade do CEP via ViaCEP. `null` quando o CEP não existe; lança se o ViaCEP estiver fora do ar. */
export async function lookupCepCity(cep: string): Promise<string | null> {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ViaCEP respondeu ${res.status}`);
  const data = (await res.json()) as { erro?: boolean | string; localidade?: string };
  if (data.erro || !data.localidade) return null;
  return data.localidade;
}

/** Frete pra um pedido. `subtotal` é o total dos produtos já recalculado no banco. */
export function computeShippingCost(params: {
  method: DeliveryMethod;
  city: string | null;
  subtotal: number;
}): number {
  if (params.method === 'pickup') return 0;
  if (params.subtotal >= FREE_SHIPPING_MIN_SUBTOTAL) return 0;
  if (params.city && normalizeCity(params.city) === normalizeCity(LOCAL_SHIPPING_CITY)) {
    return LOCAL_SHIPPING_COST;
  }
  return REMOTE_SHIPPING_COST;
}
