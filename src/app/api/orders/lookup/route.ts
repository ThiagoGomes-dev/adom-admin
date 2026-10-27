import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withCors } from '@/lib/cors';
import { matchesOrderCode } from '@/lib/orderTracking';

const NOT_FOUND = 'Não achamos um pedido com esse número e telefone. Confira e tente de novo.';

/**
 * "Acompanhar pedido" do site: o cliente digita o número curto do pedido
 * (#7F3A2C1D) e o telefone usado na compra, e recebe o id completo pra abrir
 * a página do pedido. Exigir os dois juntos evita que alguém descubra
 * pedidos de outra pessoa só chutando números.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string; phone?: string } | null;
  const code = typeof body?.code === 'string' ? body.code : '';
  const phoneDigits = typeof body?.phone === 'string' ? body.phone.replace(/\D/g, '') : '';

  if (!/^#?[0-9a-f]{8}$/i.test(code.trim()) || phoneDigits.length < 10 || phoneDigits.length > 11) {
    return withCors(NextResponse.json({ error: NOT_FOUND }, { status: 404 }));
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('orders')
    .select('id')
    .eq('customer_phone', phoneDigits)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    return withCors(NextResponse.json({ error: 'Não foi possível consultar agora. Tente em instantes.' }, { status: 500 }));
  }

  const match = (data ?? []).find((row: { id: string }) => matchesOrderCode(row.id, code));
  if (!match) {
    return withCors(NextResponse.json({ error: NOT_FOUND }, { status: 404 }));
  }
  return withCors(NextResponse.json({ orderId: match.id }));
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
