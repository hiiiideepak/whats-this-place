export interface SourceArticle {
  placeKey: string;
  title: string;
  sourceUrl: string;
  extract?: string;
  etymologyText: string | null;
}

export interface EncyclopediaLookup {
  lat: number;
  lng: number;
  /** Most specific place name first: locality, city, district, state. */
  names?: string[];
}

export interface EncyclopediaProvider {
  readonly name: string;
  lookup(input: EncyclopediaLookup): Promise<SourceArticle | null>;
}
