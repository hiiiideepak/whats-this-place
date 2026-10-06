import type { EssentialKind } from '@around/shared-types';

export interface Rankable {
  rating?: number;
  reviewCount?: number;
  distanceM: number;
}

const ESSENTIAL_KINDS = ['hospital', 'police', 'pharmacy'] as const;
const ESSENTIAL_RINGS_KM = [5, 10, 25, 50];

export function rankScore(place: Rankable, radiusKm: number): number {
  const decay = Math.exp(-place.distanceM / 1000 / radiusKm);
  // OSM features usually have no rating. Distance decay still orders them.
  // A present rating with zero reviews scores 0, matching rating × log(reviews) × decay.
  if (place.rating == null || place.reviewCount == null) {
    return decay;
  }
  return place.rating * Math.log10(1 + place.reviewCount) * decay;
}

export function rankPlaces<T extends Rankable>(
  places: T[],
  radiusKm: number,
): T[] {
  return [...places].sort(
    (a, b) => rankScore(b, radiusKm) - rankScore(a, radiusKm),
  );
}

export function selectNearestEssentials<
  T extends { kind: EssentialKind; distanceM: number },
>(
  places: T[],
): { items: T[]; searchedRadiusKm: number; missing: EssentialKind[] } {
  const items: T[] = [];
  const missing: EssentialKind[] = [];
  let searchedRadiusKm = ESSENTIAL_RINGS_KM[0] ?? 5;

  for (const kind of ESSENTIAL_KINDS) {
    const nearest = places
      .filter((place) => place.kind === kind)
      .sort((a, b) => a.distanceM - b.distanceM)[0];
    if (!nearest) {
      missing.push(kind);
      continue;
    }
    items.push(nearest);
    const distanceKm = nearest.distanceM / 1000;
    const ring =
      ESSENTIAL_RINGS_KM.find((candidate) => distanceKm <= candidate) ?? 50;
    searchedRadiusKm = Math.max(searchedRadiusKm, ring);
  }

  return { items, searchedRadiusKm, missing };
}

export function nothingWithinMessage(radiusKm: number): string {
  const label = Number.isInteger(radiusKm)
    ? String(radiusKm)
    : radiusKm.toFixed(1);
  return `Nothing within ${label} km`;
}
