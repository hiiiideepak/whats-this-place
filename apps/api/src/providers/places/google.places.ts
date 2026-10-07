import { ProviderNotConfiguredError } from '../../resilience/errors.js';
import { HttpError } from '../../resilience/retry.js';
import type { NearbyPlace, NearbyQuery } from './places.provider.js';

const TIMEOUT_MS = 3_000;

const INCLUDED_TYPES: Record<'eat' | 'stay' | 'coffee', string[]> = {
  eat: ['restaurant'],
  stay: ['lodging'],
  coffee: ['cafe'],
};

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  currentOpeningHours?: { openNow?: boolean };
  primaryType?: string;
}

interface GoogleResponse {
  places?: GooglePlace[];
}

export function mapGooglePlace(
  place: GooglePlace,
  category: string,
): NearbyPlace | null {
  const name = place.displayName?.text?.trim();
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (!place.id || !name || lat == null || lng == null) return null;
  return {
    id: place.id,
    name,
    category: place.primaryType ?? category,
    lat,
    lng,
    phone: place.nationalPhoneNumber,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    openNow: place.currentOpeningHours?.openNow,
  };
}

export class GooglePlacesProvider {
  readonly name = 'google';

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async nearby(query: NearbyQuery): Promise<NearbyPlace[]> {
    if (
      query.category !== 'eat' &&
      query.category !== 'stay' &&
      query.category !== 'coffee'
    ) {
      return [];
    }
    if (!this.apiKey) {
      throw new ProviderNotConfiguredError('Google Places is not configured.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.nationalPhoneNumber,places.primaryType',
          },
          body: JSON.stringify({
            includedTypes: INCLUDED_TYPES[query.category],
            maxResultCount: 10,
            rankPreference: 'POPULARITY',
            locationRestriction: {
              circle: {
                center: { latitude: query.lat, longitude: query.lng },
                radius: Math.min(query.radiusM, 50_000),
              },
            },
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new HttpError(response.status);
      const body = (await response.json()) as GoogleResponse;
      return (body.places ?? [])
        .map((place) => mapGooglePlace(place, query.category))
        .filter((place): place is NearbyPlace => place != null);
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
