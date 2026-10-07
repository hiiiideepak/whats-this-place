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
  name?: string;
}

export interface EncyclopediaProvider {
  readonly name: string;
  lookup(input: EncyclopediaLookup): Promise<SourceArticle | null>;
}
