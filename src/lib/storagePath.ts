const BUCKET_SEGMENT = '/product-images/';

/** Extrai o caminho do arquivo dentro do bucket a partir da URL pública do Supabase Storage. */
export function extractStoragePath(url: string): string | null {
  const idx = url.indexOf(BUCKET_SEGMENT);
  if (idx === -1) return null;
  return url.slice(idx + BUCKET_SEGMENT.length);
}
