import { describe, expect, it } from 'vitest';
import { placeToReviews } from '../googleReviews';

describe('placeToReviews', () => {
  const place = {
    displayName: { text: 'ADOM formen' },
    rating: 4.9,
    userRatingCount: 37,
    googleMapsUri: 'https://maps.google.com/?cid=1',
    reviews: [
      {
        name: 'places/x/reviews/a',
        rating: 5,
        text: { text: '  Atendimento excelente!  ' },
        relativePublishTimeDescription: 'há 2 semanas',
        googleMapsUri: 'https://maps.google.com/review/a',
        authorAttribution: { displayName: 'João', uri: 'https://maps.google.com/contrib/1', photoUri: 'https://lh3/j.png' },
      },
      { name: 'b', rating: 2, text: { text: 'Demorou' }, authorAttribution: { displayName: 'Ana' } },
      { name: 'c', rating: 5, authorAttribution: { displayName: 'Sem texto' } },
      { name: 'd', rating: 4, originalText: { text: 'Gostei' } },
    ],
  };

  it('mantém só as notas boas com texto, com autoria e link', () => {
    const out = placeToReviews(place);
    expect(out).toMatchObject({ placeName: 'ADOM formen', rating: 4.9, totalReviews: 37 });
    expect(out.reviews).toEqual([
      {
        id: 'places/x/reviews/a',
        name: 'João',
        content: 'Atendimento excelente!',
        rating: 5,
        avatar: 'https://lh3/j.png',
        authorUrl: 'https://maps.google.com/contrib/1',
        reviewUrl: 'https://maps.google.com/review/a',
        relativeTime: 'há 2 semanas',
        publishedAt: undefined,
      },
      expect.objectContaining({ id: 'd', name: 'Cliente Google', content: 'Gostei', rating: 4 }),
    ]);
  });

  it('aceita nota mínima diferente e lugar sem avaliações', () => {
    expect(placeToReviews(place, 1).reviews).toHaveLength(3);
    expect(placeToReviews({}).reviews).toEqual([]);
  });
});
