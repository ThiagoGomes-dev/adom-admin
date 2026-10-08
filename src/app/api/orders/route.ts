import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveSkuId } from '@/lib/orderResolution';
import { createPreferenceForOrder } from '@/lib/mercadopago';
import { rowToOrder, type OrderRow, type ProductRow, type ProductVariantSkuRow } from '@/lib/mappers';

const ALLOWED_ORIGIN = process.env.STOREFRONT_ORIGIN ?? '*';

const MAX_ITEMS = 30;
const MAX_QTY_PER_ITEM = 50;
const MAX_TOTAL_QTY = 200;
const MAX_SHIPPING_COST = 500;

function withCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

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
  /** frete em reais — a forma de pagamento em si é escolhida no próprio Checkout Pro do Mercado Pago. */
  shippingCost?: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
}

/**
 * Rota pública (sem login) que o site chama ao finalizar a compra — cria um
 * pedido pendente e já reserva/debita o estoque na hora (via RPC
 * `create_order`, security definer no banco). Preço e sku_id NUNCA são
 * aceitos do corpo da requisição: sempre recalculados aqui a partir do
 * banco, pra ninguém manipular o fetch do navegador e mandar preço zero.
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

  const shippingCost = body.shippingCost ?? 0;
  if (!Number.isFinite(shippingCost) || shippingCost < 0 || shippingCost > MAX_SHIPPING_COST) {
    return badRequest('Valor de frete inválido.');
  }

  const phoneDigits = (body.customerPhone ?? '').replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    return badRequest('Telefone do cliente inválido.');
  }
  if (!body.customerName || !body.customerName.trim()) {
    return badRequest('Nome do cliente é obrigatório.');
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

  const { data: orderId, error: rpcError } = await supabase.rpc('create_order', {
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

  // O estoque já foi reservado em create_order — agora cria a preference do
  // Checkout Pro pra esse pedido. Se isso falhar (Mercado Pago fora do ar,
  // credencial inválida etc.), cancela o pedido pra devolver o estoque em
  // vez de deixar uma reserva "fantasma" sem ninguém conseguir pagar.
  const { data: orderRows, error: orderFetchError } = await supabase.from('orders').select('*').eq('id', orderId).limit(1);

  if (orderFetchError || !orderRows || orderRows.length === 0) {
    await supabase.rpc('cancel_order', { p_order_id: orderId });
    return withCors(
      NextResponse.json({ error: 'Pedido criado, mas não foi possível carregá-lo pra iniciar o pagamento. Tente novamente.' }, { status: 500 }),
    );
  }

  const order = rowToOrder(orderRows[0] as OrderRow);

  try {
    const { preferenceId, checkoutUrl } = await createPreferenceForOrder(order.id, order.items, shippingCost);
    await supabase.from('orders').update({ payment_reference: preferenceId }).eq('id', order.id);
    return withCors(NextResponse.json({ orderId: order.id, checkoutUrl }, { status: 201 }));
  } catch (mpError) {
    await supabase.rpc('cancel_order', { p_order_id: order.id });
    const message = mpError instanceof Error ? mpError.message : 'Não foi possível iniciar o pagamento.';
    return withCors(NextResponse.json({ error: `Não foi possível iniciar o pagamento: ${message}` }, { status: 502 }));
  }
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
