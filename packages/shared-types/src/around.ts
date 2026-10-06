export type SectionStatus = 'ok' | 'empty' | 'error' | 'not_found';

export interface AroundMeta {
  lat: number;
  lng: number;
  radius_km: number;
  geohash: string;
  generated_at: string;
}

export interface Section<T> {
  status: SectionStatus;
  message?: string;
  searched_radius_km?: number;
  data?: T;
  items?: T[];
}

export interface PlaceHierarchy {
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
}

export interface Etymology {
  status: 'ok' | 'not_found';
  summary?: string;
  source_url?: string;
}

export interface AboutPlace {
  name: string;
  hierarchy: PlaceHierarchy;
  significance?: string;
  etymology: Etymology;
}

export interface PlaceCard {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distance_m: number;
  rating?: number;
  review_count?: number;
  open_now?: boolean;
  phone?: string;
  maps_url: string;
}

export type EssentialKind = 'hospital' | 'police' | 'pharmacy';

export interface EssentialPlace extends PlaceCard {
  kind: EssentialKind;
}

export interface AroundResponse {
  meta: AroundMeta;
  about: Section<AboutPlace>;
  famous: Section<PlaceCard>;
  essentials: Section<EssentialPlace>;
  eat: Section<PlaceCard>;
  stay: Section<PlaceCard>;
  coffee: Section<PlaceCard>;
}

export type AroundSectionName =
  'about' | 'famous' | 'essentials' | 'eat' | 'stay' | 'coffee';
