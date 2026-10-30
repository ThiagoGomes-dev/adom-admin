/**
 * Avaliações do Google (Places API New) para a seção "Depoimentos" da loja.
 *
 * O Google devolve no máximo 5 avaliações, escolhidas por ele. Aqui só
 * filtramos (nota mínima e com texto) e mantemos o que a política do Google
 * exige mostrar: nome e foto do autor, link da avaliação e a marca Google.
 */

const PLACES_URL = 'https://places.googleapis.com/v1';
const REVIEW_FIELDS = ['id', 'displayName', 'rating', 'userRatingCount', 'googleMapsUri', 'reviews'];

export interface GoogleReview {
  id: string;
  name: string;
  content: string;
  rating: number;
  avatar?: string;
  authorUrl?: string;
  reviewUrl?: string;
  relativeTime?: string;
  publishedAt?: string;
}

export interface GoogleReviewsPayload {
  placeName: string | null;
  placeUrl: string | null;
  rating: number | null;
  totalReviews: number | null;
  reviews: GoogleReview[];
}

interface PlaceReview {
  name?: string;
  rating?: number;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  googleMapsUri?: string;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
}

export interface PlaceResponse {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlaceReview[];
}

/** Converte a resposta do Google no formato que a loja usa, já filtrado. */
export function placeToReviews(place: PlaceResponse, minRating = 4): GoogleReviewsPayload {
  const reviews = (place.reviews ?? [])
    .map((r, i): GoogleReview | null => {
      const content = (r.text?.text ?? r.originalText?.text ?? '').trim();
      const rating = r.rating ?? 0;
      if (!content || rating < minRating) return null;
      return {
        id: r.name ?? `google-${i}`,
        name: r.authorAttribution?.displayName?.trim() || 'Cliente Google',
        content,
        rating,
        avatar: r.authorAttribution?.photoUri,
        authorUrl: r.authorAttribution?.uri,
        reviewUrl: r.googleMapsUri,
        relativeTime: r.relativePublishTimeDescription,
        publishedAt: r.publishTime,
      };
    })
    .filter((r): r is GoogleReview => r !== null);

  return {
    placeName: place.displayName?.text ?? null,
    placeUrl: place.googleMapsUri ?? null,
    rating: place.rating ?? null,
    totalReviews: place.userRatingCount ?? null,
    reviews,
  };
}

/**
 * Busca as avaliações. Usa `GOOGLE_PLACE_ID` quando definido; senão procura a
 * loja pelo nome (`GOOGLE_PLACE_QUERY`) — custa o mesmo e traz as avaliações
 * na mesma chamada.
 */
export async function fetchGoogleReviews(opts: {
  apiKey: string;
  placeId?: string;
  query?: string;
  minRating?: number;
}): Promise<GoogleReviewsPayload> {
  const headers = { 'X-Goog-Api-Key': opts.apiKey, 'Content-Type': 'application/json' };
  let place: PlaceResponse | undefined;

  if (opts.placeId) {
    const res = await fetch(`${PLACES_URL}/places/${encodeURIComponent(opts.placeId)}?languageCode=pt-BR`, {
      headers: { ...headers, 'X-Goog-FieldMask': REVIEW_FIELDS.join(',') },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Google Places ${res.status}: ${await res.text()}`);
    place = await res.json();
  } else if (opts.query) {
    const res = await fetch(`${PLACES_URL}/places:searchText`, {
      method: 'POST',
      headers: { ...headers, 'X-Goog-FieldMask': REVIEW_FIELDS.map((f) => `places.${f}`).join(',') },
      body: JSON.stringify({ textQuery: opts.query, languageCode: 'pt-BR', pageSize: 1 }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Google Places ${res.status}: ${await res.text()}`);
    place = (await res.json()).places?.[0];
  } else {
    throw new Error('Defina GOOGLE_PLACE_ID ou GOOGLE_PLACE_QUERY.');
  }

  if (!place) throw new Error('Loja não encontrada no Google.');
  return placeToReviews(place, opts.minRating);
}
