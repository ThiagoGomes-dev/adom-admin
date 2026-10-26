import { describe, expect, it } from 'vitest';
import { slugify } from '../slug';

describe('slugify', () => {
  it('remove acentos e troca espaços por hífen', () => {
    expect(slugify('Camiseta Básica')).toBe('camiseta-basica');
  });

  it('remove hífens nas pontas e junta separadores repetidos', () => {
    expect(slugify('  --Calça  Jeans!! ')).toBe('calca-jeans');
  });
});
