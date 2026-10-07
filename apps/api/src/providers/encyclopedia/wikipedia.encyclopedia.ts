import { HttpError } from '../../resilience/retry.js';
import type {
  EncyclopediaLookup,
  EncyclopediaProvider,
  SourceArticle,
} from './encyclopedia.provider.js';
import { extractGroundingText } from './wiki-text.js';

const TIMEOUT_MS = 3_000;

interface GeoHit {
  pageid?: number;
  title?: string;
}

interface ParseResponse {
  parse?: { title?: string; wikitext?: string };
}

interface QueryResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid?: number;
        title?: string;
        missing?: string | boolean;
        extract?: string;
        pageprops?: { wikibase_item?: string };
      }
    >;
    geosearch?: GeoHit[];
    search?: Array<{ pageid?: number; title?: string }>;
  };
}

export class WikipediaEncyclopediaProvider implements EncyclopediaProvider {
  readonly name = 'wikipedia';

  constructor(
    private readonly apiUrl: string,
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async lookup(input: EncyclopediaLookup): Promise<SourceArticle | null> {
    const hit =
      (await this.matchingName(input.names ?? [])) ??
      (await this.nearest(input.lat, input.lng));
    if (!hit?.pageid || !hit.title) return null;

    const [wikitext, details] = await Promise.all([
      this.wikitext(hit.pageid),
      this.details(hit.pageid),
    ]);
    const title = details.title || hit.title;
    return {
      placeKey: details.wikibaseItem ?? `wiki:${hit.pageid}`,
      title,
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      extract: details.extract,
      etymologyText: wikitext ? extractGroundingText(wikitext) : null,
    };
  }

  private async nearest(lat: number, lng: number): Promise<GeoHit | null> {
    const payload = await this.get<QueryResponse>({
      action: 'query',
      list: 'geosearch',
      gscoord: `${lat}|${lng}`,
      gsradius: '10000',
      gslimit: '1',
    });
    return payload.query?.geosearch?.[0] ?? null;
  }

  private async matchingName(names: string[]): Promise<GeoHit | null> {
    const seen = new Set<string>();
    for (const name of names) {
      const trimmed = name.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      const hit = await this.byTitle(trimmed);
      if (hit) return hit;
    }
    return null;
  }

  private async byTitle(name: string): Promise<GeoHit | null> {
    const payload = await this.get<QueryResponse>({
      action: 'query',
      titles: name,
      redirects: '1',
    });
    const page = Object.values(payload.query?.pages ?? {})[0];
    if (
      !page?.pageid ||
      page.pageid < 1 ||
      page.missing != null ||
      !page.title
    ) {
      return null;
    }
    return { pageid: page.pageid, title: page.title };
  }

  private async wikitext(pageId: number): Promise<string | null> {
    const payload = await this.get<ParseResponse>({
      action: 'parse',
      pageid: String(pageId),
      prop: 'wikitext',
      formatversion: '2',
    });
    return payload.parse?.wikitext ?? null;
  }

  private async details(pageId: number): Promise<{
    title: string;
    extract?: string;
    wikibaseItem?: string;
  }> {
    const payload = await this.get<QueryResponse>({
      action: 'query',
      pageids: String(pageId),
      prop: 'extracts|pageprops',
      exintro: '1',
      explaintext: '1',
      ppprop: 'wikibase_item',
    });
    const page = payload.query?.pages?.[String(pageId)];
    return {
      title: '',
      extract: page?.extract,
      wikibaseItem: page?.pageprops?.wikibase_item,
    };
  }

  private async get<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(this.apiUrl);
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
