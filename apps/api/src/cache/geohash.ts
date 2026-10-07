const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

// Approximate cell width in km at the equator, precision 1 through 8.
const CELL_WIDTH_KM = [5_000, 1_250, 156, 39.1, 4.89, 1.22, 0.153, 0.0382];

export function encodeGeohash(
  lat: number,
  lng: number,
  precision: number,
): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = '';
  let bit = 0;
  let value = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        value = (value << 1) | 1;
        lngMin = mid;
      } else {
        value <<= 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        value = (value << 1) | 1;
        latMin = mid;
      } else {
        value <<= 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    bit += 1;
    if (bit === 5) {
      hash += BASE32[value] ?? '';
      bit = 0;
      value = 0;
    }
  }

  return hash;
}

export function geohashPrecisionForRadius(radiusKm: number): number {
  if (radiusKm <= 5) return 6;
  if (radiusKm <= 10) return 5;
  if (radiusKm <= 25) return 4;
  const targetKm = radiusKm / 2;
  const index = CELL_WIDTH_KM.findIndex((width) => width <= targetKm);
  return index === -1 ? 4 : index + 1;
}

export function aroundCacheKey(
  section: string,
  geohash: string,
  radiusKm: number,
): string {
  // v2 includes etymology in the about payload. Older v1 entries are left to expire.
  return `around:v2:${geohash}:${section}:${radiusKm}`;
}
