import type { PlaceHierarchy } from '@around/shared-types';

export interface GeocodedPlace {
  name: string;
  lat: number;
  lng: number;
  hierarchy: PlaceHierarchy;
  osmId?: string;
  placeKey: string;
}

export interface GeocodingProvider {
  readonly name: string;
  reverse(lat: number, lng: number): Promise<GeocodedPlace>;
  search(query: string): Promise<GeocodedPlace[]>;
}
