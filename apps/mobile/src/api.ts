import type {
  AboutPlace,
  AroundSectionName,
  AroundSectionResponse,
  EssentialPlace,
  PlaceCard,
  PlaceSearchHit,
} from '@around/shared-types';
import { API_URL } from './config';

export type SectionPayload = AboutPlace | PlaceCard | EssentialPlace;

export async function fetchSection(
  section: AroundSectionName,
  lat: number,
  lng: number,
  radiusKm: number,
  deviceId: string,
): Promise<AroundSectionResponse<SectionPayload>> {
  const url = new URL(`${API_URL}/v1/around/${section}`);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lng));
  url.searchParams.set('radius_km', String(radiusKm));
  return readJson<AroundSectionResponse<SectionPayload>>(url, deviceId);
}

export async function searchPlaces(
  query: string,
  deviceId: string,
): Promise<PlaceSearchHit[]> {
  const url = new URL(`${API_URL}/v1/places/search`);
  url.searchParams.set('q', query);
  return readJson<PlaceSearchHit[]>(url, deviceId);
}

async function readJson<T>(url: URL, deviceId: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Device-Id': deviceId },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}
