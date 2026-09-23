import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { attachVariantStock, rowToProduct, type ProductRow, type ProductVariantSkuRow } from '@/lib/mappers';

const ALLOWED_ORIGIN = process.env.STOREFRONT_ORIGIN ?? '*';

function withCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return response;
}

/** Rota pública (só leitura) consumida pelo site — não exige login. */
export async function GET() {
  const supabase = await createClient();
  const [{ data, error }, { data: skuData, error: skuError }] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('product_variant_skus').select('*'),
  ]);

  if (error) {
    return withCors(NextResponse.json({ error: error.message }, { status: 500 }));
  }
  if (skuError) {
    return withCors(NextResponse.json({ error: skuError.message }, { status: 500 }));
  }

  const products = (data as ProductRow[]).map(rowToProduct);
  const withVariantStock = attachVariantStock(products, (skuData as ProductVariantSkuRow[]) ?? []);
  return withCors(NextResponse.json(withVariantStock));
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
