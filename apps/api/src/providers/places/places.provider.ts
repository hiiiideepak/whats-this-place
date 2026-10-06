import type { EssentialKind } from '@around/shared-types';

export type PlaceCategory = 'essentials' | 'famous' | 'eat' | 'stay' | 'coffee';

export interface NearbyQuery {
  lat: number;
  lng: number;
  radiusM: number;
  category: PlaceCategory;
}

export interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  kind?: EssentialKind;
  lat: number;
  lng: number;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  openNow?: boolean;
}

export interface PlacesProvider {
  readonly name: string;
  nearby(query: NearbyQuery): Promise<NearbyPlace[]>;
}
