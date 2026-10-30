import { NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { fetchGoogleReviews, type GoogleReviewsPayload } from '@/lib/googleReviews';

// lê variáveis de ambiente a cada execução; o cache fica por conta da CDN e da memória
export const dynamic = 'force-dynamic';

/** Guarda as avaliações por 1 dia: ~30 chamadas ao Google por mês, dentro da cota grátis. */
const CACHE_SECONDS = 60 * 60 * 24;

let cached: { at: number; data: GoogleReviewsPayload } | null = null;

function respond(data: GoogleReviewsPayload, maxAge: number) {
  const res = withCors(NextResponse.json(data), 'GET, OPTIONS');
  // a CDN da Vercel segura a resposta; o navegador não precisa guardar
  res.headers.set('Cache-Control', `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}`);
  return res;
}

/**
 * Rota pública consumida pela seção "Depoimentos" da loja. Sem chave
 * configurada (ou se o Google falhar) devolve lista vazia, e a loja mostra
 * os depoimentos fixos dela.
 */
export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const empty: GoogleReviewsPayload = { placeName: null, placeUrl: null, rating: null, totalReviews: null, reviews: [] };
  if (!apiKey) return respond(empty, 300);

  if (cached && Date.now() - cached.at < CACHE_SECONDS * 1000) {
    return respond(cached.data, CACHE_SECONDS);
  }

  try {
    const data = await fetchGoogleReviews({
      apiKey,
      placeId: process.env.GOOGLE_PLACE_ID || undefined,
      query: process.env.GOOGLE_PLACE_QUERY || 'ADOM formen, Campina Grande - PB',
      minRating: Number(process.env.GOOGLE_REVIEWS_MIN_RATING) || 4,
    });
    cached = { at: Date.now(), data };
    return respond(data, CACHE_SECONDS);
  } catch (err) {
    console.error('[reviews] falha ao buscar avaliações do Google', err);
    // se já tinha algo guardado, segue mostrando; senão a loja cai nos depoimentos fixos
    return respond(cached?.data ?? empty, 300);
  }
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }), 'GET, OPTIONS');
}
