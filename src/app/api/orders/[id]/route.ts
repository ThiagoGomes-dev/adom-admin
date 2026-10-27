import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withCors } from '@/lib/cors';
import { rowToOrder, type OrderRow } from '@/lib/mappers';
import { toPublicOrder } from '@/lib/orderTracking';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHODS = 'GET, OPTIONS';

/**
 * Rota pública que a página "Meu pedido" do site consulta. O id completo do
 * pedido (uuid) funciona como chave do link: não dá pra adivinhar, e a
 * resposta só traz o que `toPublicOrder` libera (sem telefone, e-mail ou
 * endereço). Lê com a chave secreta porque a RLS de `orders` não libera
 * leitura pro papel anônimo.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return withCors(NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 }), METHODS);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) {
    return withCors(NextResponse.json({ error: 'Não foi possível consultar o pedido agora.' }, { status: 500 }), METHODS);
  }
  if (!data) {
    return withCors(NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 }), METHODS);
  }

  const response = NextResponse.json(toPublicOrder(rowToOrder(data as OrderRow)));
  response.headers.set('Cache-Control', 'no-store');
  return withCors(response, METHODS);
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }), METHODS);
}
