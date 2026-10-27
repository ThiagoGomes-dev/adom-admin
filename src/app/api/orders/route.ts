import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveSkuId } from '@/lib/orderResolution';
import { createPreferenceForOrder } from '@/lib/mercadopago';
import { computeShippingCost, lookupCepCity, type DeliveryMethod } from '@/lib/shipping';
import { rowToOrder, type OrderRow, type ProductRow, type ProductVariantSkuRow } from '@/lib/mappers';
import { withCors } from '@/lib/cors';
import { isValidEmail } from '@/lib/orderTracking';

const MAX_ITEMS = 30;
const MAX_QTY_PER_ITEM = 50;
const MAX_TOTAL_QTY = 200;

function badRequest(message: string) {
  return withCors(NextResponse.json({ error: message }, { status: 400 }));
}

interface OrderItemInput {
  productId: string;
  selectedVariants?: Record<string, string>;
  quantity: number;
}

interface CreateOrderBody {
  items: OrderItemInput[];
  /** entrega no endereço ou retirada na loja — o frete é calculado aqui, nunca aceito do navegador */
  deliveryMethod?: DeliveryMethod;
  /** CEP de entrega (só dígitos ou 00000-000); obrigatório quando `deliveryMethod` é 'delivery' */
  cep?: string;
  customerName?: string;
  customerPhone?: string;
  /** contato alternativo ao WhatsApp — a loja manda as atualizações do pedido manualmente */
  customerEmail?: string;
  note?: string;
}

/**
 * Rota pública (sem login) que o site chama ao finalizar a compra — cria um
 * pedido pendente e já reserva/debita o estoque na hora (via RPC
 * `create_order`, security definer no banco). Preço e sku_id NUNCA são
 * aceitos do corpo da requisição: sempre recalculados aqui a partir do
 * banco, pra ninguém manipular o fetch do navegador e mandar preço zero.
 * O frete segue a mesma regra: calculado aqui (src/lib/shipping.ts) a partir
 * do tipo de entrega, da cidade do CEP e do subtotal.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateOrderBody | null;
  if (!body) {
    return badRequest('Corpo da requisição inválido.');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return badRequest('Pedido sem itens.');
  }
  if (body.items.length > MAX_ITEMS) {
    return badRequest('Pedido com muitos itens.');
  }

  let totalQty = 0;
  for (const item of body.items) {
    if (typeof item.productId !== 'string' || !item.productId) {
      return badRequest('Item do pedido sem produto.');
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QTY_PER_ITEM) {
      return badRequest('Quantidade inválida para um dos itens.');
    }
    totalQty += item.quantity;
  }
  if (totalQty > MAX_TOTAL_QTY) {
    return badRequest('Pedido excede o limite de itens permitido.');
  }

  const deliveryMethod = body.deliveryMethod;
  if (deliveryMethod !== 'delivery' && deliveryMethod !== 'pickup') {
    return badRequest('Escolha entre entrega e retirada na loja (atualize a página e tente de novo).');
  }
  const cepDigits = (body.cep ?? '').replace(/\D/g, '');
  let deliveryCity: string | null = null;
  if (deliveryMethod === 'delivery') {
    if (cepDigits.length !== 8) {
      return badRequest('CEP de entrega inválido.');
    }
    try {
      deliveryCity = await lookupCepCity(cepDigits);
    } catch {
      return withCors(
        NextResponse.json({ error: 'Não foi possível consultar o CEP agora. Tente novamente em instantes.' }, { status: 502 }),
      );
    }
    if (!deliveryCity) {
      return badRequest('CEP não encontrado — confira e tente novamente.');
    }
  }

  const phoneDigits = (body.customerPhone ?? '').replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    return badRequest('Telefone do cliente inválido.');
  }
  if (!body.customerName || !body.customerName.trim()) {
    return badRequest('Nome do cliente é obrigatório.');
  }
  // O site exige o e-mail, mas aqui ele ainda é opcional: o painel pode ser
  // publicado antes do site, e o site antigo não manda o campo.
  const customerEmail = (body.customerEmail ?? '').trim().toLowerCase() || null;
  if (customerEmail && !isValidEmail(customerEmail)) {
    return badRequest('E-mail do cliente inválido.');
  }

  const supabase = await createClient();
  const productIds = [...new Set(body.items.map((i) => i.productId))];

  const [{ data: productRows, error: productsError }, { data: skuRows, error: skusError }] = await Promise.all([
    supabase.from('products').select('*').in('id', productIds),
    supabase.from('product_variant_skus').select('*').in('product_id', productIds),
  ]);

  if (productsError) return withCors(NextResponse.json({ error: productsError.message }, { status: 500 }));
  if (skusError) return withCors(NextResponse.json({ error: skusError.message }, { status: 500 }));

  const products = (productRows ?? []) as ProductRow[];
  const skus = (skuRows ?? []) as ProductVariantSkuRow[];

  const resolvedItems: { product_id: string; sku_id: string | null; quantity: number }[] = [];
  for (const item of body.items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      return badRequest(`Produto não encontrado: ${item.productId}`);
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const skuId = resolveSkuId(product.id, skus, item.selectedVariants);
    if (hasVariants && !skuId) {
      return badRequest(`Variação não encontrada para "${product.name}" — atualize sua seleção.`);
    }

    resolvedItems.push({ product_id: product.id, sku_id: skuId, quantity: item.quantity });
  }

  // create_order devolve a linha inteira do pedido já criado (não só o id) —
  // chamar um select avulso depois pra reler o pedido não funciona aqui,
  // porque essa rota roda sem sessão (papel anon) e a RLS de `orders` só
  // libera leitura pra autenticado; a RPC, sendo security definer, não tem
  // esse problema.
  const { data: orderRow, error: rpcError } = await supabase.rpc('create_order', {
    p_items: resolvedItems,
    p_payment_method: null,
    p_customer_name: body.customerName.trim(),
    p_customer_phone: phoneDigits,
    p_note: body.note ?? null,
    p_confirmation_method: 'mercado_pago',
  });

  if (rpcError) {
    return badRequest(rpcError.message);
  }
  if (!orderRow) {
    return withCors(
      NextResponse.json({ error: 'Pedido criado, mas sem dados pra iniciar o pagamento. Tente novamente.' }, { status: 500 }),
    );
  }

  const order = rowToOrder(orderRow as OrderRow);
  const shippingCost = computeShippingCost({ method: deliveryMethod, city: deliveryCity, subtotal: order.total });
  // update em orders e cancel_order não são liberados pro papel anônimo — usa a chave secreta
  const admin = createAdminClient();

  const { error: deliveryError } = await admin
    .from('orders')
    .update({
      delivery_method: deliveryMethod,
      shipping_cost: shippingCost,
      delivery_cep: deliveryMethod === 'delivery' ? cepDigits : null,
      customer_email: customerEmail,
    })
    .eq('id', order.id);
  if (deliveryError) {
    await admin.rpc('cancel_order', { p_order_id: order.id });
    return withCors(
      NextResponse.json({ error: 'Não foi possível registrar a entrega do pedido. Tente novamente.' }, { status: 500 }),
    );
  }

  // O estoque já foi reservado em create_order — agora cria a preference do
  // Checkout Pro pra esse pedido. Se isso falhar (Mercado Pago fora do ar,
  // credencial inválida etc.), cancela o pedido pra devolver o estoque em
  // vez de deixar uma reserva "fantasma" sem ninguém conseguir pagar.
  try {
    const { checkoutUrl } = await createPreferenceForOrder(order.id, order.items, shippingCost);
    return withCors(NextResponse.json({ orderId: order.id, checkoutUrl, shippingCost }, { status: 201 }));
  } catch (mpError) {
    await admin.rpc('cancel_order', { p_order_id: order.id });
    const message = mpError instanceof Error ? mpError.message : 'Não foi possível iniciar o pagamento.';
    return withCors(NextResponse.json({ error: `Não foi possível iniciar o pagamento: ${message}` }, { status: 502 }));
  }
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
