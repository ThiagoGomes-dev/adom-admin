import { describe, expect, it } from 'vitest';
import { extractStoragePath } from '../storagePath';

describe('extractStoragePath', () => {
  it('extrai o caminho dentro do bucket', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/product-images/camisetas/foto.webp';
    expect(extractStoragePath(url)).toBe('camisetas/foto.webp');
  });

  it('devolve null para URL de outro lugar', () => {
    expect(extractStoragePath('https://example.com/foto.webp')).toBeNull();
  });
});
