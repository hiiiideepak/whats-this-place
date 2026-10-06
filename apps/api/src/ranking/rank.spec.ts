import {
  nothingWithinMessage,
  rankPlaces,
  rankScore,
  selectNearestEssentials,
} from './rank.js';

describe('rankScore', () => {
  it('orders unrated places by distance decay', () => {
    const near = rankScore({ distanceM: 500 }, 10);
    const far = rankScore({ distanceM: 8_000 }, 10);
    expect(near).toBeGreaterThan(far);
  });

  it('scores a rated place with zero reviews at zero', () => {
    expect(rankScore({ rating: 5, reviewCount: 0, distanceM: 100 }, 10)).toBe(
      0,
    );
  });

  it('prefers more reviews when rating and distance match', () => {
    const popular = rankScore(
      { rating: 4.5, reviewCount: 200, distanceM: 1_000 },
      10,
    );
    const quiet = rankScore(
      { rating: 4.5, reviewCount: 2, distanceM: 1_000 },
      10,
    );
    expect(popular).toBeGreaterThan(quiet);
  });
});

describe('rankPlaces', () => {
  it('puts the higher score first', () => {
    const ranked = rankPlaces(
      [
        { id: 'far', distanceM: 9_000 },
        { id: 'near', distanceM: 200 },
      ],
      10,
    );
    expect(ranked.map((place) => place.id)).toEqual(['near', 'far']);
  });
});

describe('selectNearestEssentials', () => {
  it('keeps the nearest of each kind even past the user radius', () => {
    const selected = selectNearestEssentials([
      { kind: 'hospital' as const, distanceM: 12_000, id: 'far-hospital' },
      { kind: 'hospital' as const, distanceM: 40_000, id: 'farther' },
      { kind: 'pharmacy' as const, distanceM: 800, id: 'pharmacy' },
    ]);
    expect(selected.items.map((place) => place.id)).toEqual([
      'far-hospital',
      'pharmacy',
    ]);
    expect(selected.missing).toEqual(['police']);
    expect(selected.searchedRadiusKm).toBe(25);
  });
});

describe('nothingWithinMessage', () => {
  it('formats whole and fractional kilometres', () => {
    expect(nothingWithinMessage(10)).toBe('Nothing within 10 km');
    expect(nothingWithinMessage(12.5)).toBe('Nothing within 12.5 km');
  });
});
