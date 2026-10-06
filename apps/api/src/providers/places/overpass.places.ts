import type { NearbyPlace } from './places.provider.js';
import { HttpError } from '../../resilience/retry.js';

// Public Overpass often answers after the 3s budget used for the other providers.
const PROVIDER_TIMEOUT_MS = 8_000;

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
  remark?: string;
}

export function overpassQuery(
  lat: number,
  lng: number,
  radiusM: number,
  category: 'essentials' | 'famous',
): string {
  const around = `(around:${Math.round(radiusM)},${lat},${lng})`;
  const filters =
    category === 'essentials'
      ? [
          '["amenity"="hospital"]',
          '["amenity"="police"]',
          '["amenity"="pharmacy"]',
        ]
      : [
          '["tourism"~"attraction|museum|viewpoint|gallery"]',
          '["historic"~"castle|fort|monument|ruins"]',
          '["amenity"="place_of_worship"]',
        ];
  const clauses = filters
    .flatMap((filter) => [`node${filter}${around};`, `way${filter}${around};`])
    .join('');
  return `[out:json][timeout:8];(${clauses});out center;`;
}

export function mapOverpassElement(
  element: OverpassElement,
): NearbyPlace | null {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (
    lat == null ||
    lng == null ||
    element.type == null ||
    element.id == null
  ) {
    return null;
  }
  const kind = essentialKind(tags);
  const category =
    kind ?? tags.tourism ?? tags.historic ?? tags.amenity ?? 'place';
  const name = (tags.name ?? tags['name:en'])?.trim();
  if (!name && !kind) return null;
  return {
    id: `${element.type}/${element.id}`,
    name: name || defaultEssentialName(kind),
    category,
    kind,
    lat,
    lng,
    phone: tags.phone ?? tags['contact:phone'],
  };
}

export class OverpassPlacesProvider {
  readonly name = 'overpass';

  constructor(
    private readonly endpoint: string,
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async nearby(query: {
    lat: number;
    lng: number;
    radiusM: number;
    category: 'essentials' | 'famous' | 'eat' | 'stay' | 'coffee';
  }): Promise<NearbyPlace[]> {
    if (query.category !== 'essentials' && query.category !== 'famous') {
      return [];
    }
    const body = overpassQuery(
      query.lat,
      query.lng,
      query.radiusM,
      query.category,
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: '*/*',
          'User-Agent': this.userAgent,
        },
        body: `data=${encodeURIComponent(body)}`,
        signal: controller.signal,
      });
      if (!response.ok) throw new HttpError(response.status);
      const payload = (await response.json()) as OverpassResponse;
      if (payload.remark && !payload.elements) {
        throw new Error(payload.remark);
      }
      return (payload.elements ?? [])
        .map((element) => mapOverpassElement(element))
        .filter((place): place is NearbyPlace => place != null)
        .slice(0, 40);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('timeout');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function essentialKind(tags: Record<string, string>) {
  if (tags.amenity === 'hospital') return 'hospital' as const;
  if (tags.amenity === 'police') return 'police' as const;
  if (tags.amenity === 'pharmacy') return 'pharmacy' as const;
  return undefined;
}

function defaultEssentialName(
  kind: 'hospital' | 'police' | 'pharmacy' | undefined,
): string {
  if (kind === 'hospital') return 'Hospital';
  if (kind === 'police') return 'Police station';
  if (kind === 'pharmacy') return 'Pharmacy';
  return 'Place';
}
