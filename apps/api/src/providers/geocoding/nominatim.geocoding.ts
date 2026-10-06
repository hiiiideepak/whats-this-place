import type { PlaceHierarchy } from '@around/shared-types';
import { encodeGeohash } from '../../cache/geohash.js';
import { HttpError } from '../../resilience/retry.js';
import type { GeocodedPlace } from './geocoding.provider.js';

const PROVIDER_TIMEOUT_MS = 3_000;
const MIN_INTERVAL_MS = 1_100;

interface NominatimResult {
  display_name?: string;
  lat?: string;
  lon?: string;
  osm_type?: string;
  osm_id?: number;
  address?: Record<string, string>;
}

let nextAllowedAt = 0;
let nominatimQueue: Promise<void> = Promise.resolve();

export function mapNominatimPlace(result: NominatimResult): GeocodedPlace {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('invalid geocoding response');
  }
  const address = result.address ?? {};
  const hierarchy: PlaceHierarchy = {
    locality: first(address, ['suburb', 'neighbourhood', 'village', 'hamlet']),
    city: first(address, ['city', 'town', 'municipality']),
    district: first(address, ['state_district', 'county']),
    state: first(address, ['state']),
    country: first(address, ['country']),
  };
  const name =
    hierarchy.locality ??
    hierarchy.city ??
    hierarchy.district ??
    hierarchy.state ??
    result.display_name?.split(',')[0]?.trim() ??
    'Unknown place';
  return {
    name,
    lat,
    lng,
    hierarchy,
    osmId:
      result.osm_type && result.osm_id != null
        ? `${result.osm_type}/${result.osm_id}`
        : undefined,
    placeKey: encodeGeohash(lat, lng, 7),
  };
}

export class NominatimGeocodingProvider {
  readonly name = 'nominatim';

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  reverse(lat: number, lng: number): Promise<GeocodedPlace> {
    const url = new URL('/reverse', this.baseUrl);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    return this.getOne(url);
  }

  async search(query: string): Promise<GeocodedPlace[]> {
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    const results = await this.request<NominatimResult[]>(url);
    return results.map((result) => mapNominatimPlace(result));
  }

  private async getOne(url: URL): Promise<GeocodedPlace> {
    return mapNominatimPlace(await this.request<NominatimResult>(url));
  }

  private async request<T>(url: URL): Promise<T> {
    await waitForNominatimSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new HttpError(response.status);
      return (await response.json()) as T;
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

function first(
  address: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = address[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function waitForNominatimSlot(): Promise<void> {
  const run = nominatimQueue.then(async () => {
    const wait = Math.max(0, nextAllowedAt - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    nextAllowedAt = Date.now() + MIN_INTERVAL_MS;
  });
  nominatimQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
