import type { PlaceHierarchy } from '@around/shared-types';

export type DistanceUnit = 'km' | 'mi';

export function formatDistance(meters: number, unit: DistanceUnit): string {
  if (unit === 'mi') {
    const miles = meters / 1609.344;
    return miles < 0.1
      ? `${Math.round(meters * 3.28084)} ft`
      : `${miles.toFixed(1)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function hierarchyLine(hierarchy: PlaceHierarchy): string {
  return [
    hierarchy.locality,
    hierarchy.city,
    hierarchy.district,
    hierarchy.state,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' > ');
}

export function distanceMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
