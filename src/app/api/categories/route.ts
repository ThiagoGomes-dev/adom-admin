import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rowToCategory, type CategoryRow } from '@/lib/mappers';
import { compareCategories } from '@/lib/categoryTree';

const ALLOWED_ORIGIN = process.env.STOREFRONT_ORIGIN ?? '*';

function withCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return response;
}

/**
 * Rota pública (só leitura) consumida pelo site — não exige login.
 * Lista plana; o site monta a árvore pelo `parentId` e ordena pelo `sortOrder`.
 * É dinâmica (lê cookies), então mudanças no painel aparecem no site no próximo carregamento.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*');

  if (error) {
    return withCors(NextResponse.json({ error: error.message }, { status: 500 }));
  }

  const categories = (data as CategoryRow[]).map(rowToCategory).sort(compareCategories);
  return withCors(NextResponse.json(categories));
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
