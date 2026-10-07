import type {
  AboutPlace,
  AroundMeta,
  AroundResponse,
  AroundSectionName,
  AroundSectionResponse,
  EssentialPlace,
  PlaceCard,
  PlaceSearchHit,
  Section,
} from '@around/shared-types';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  aroundCacheKey,
  encodeGeohash,
  geohashPrecisionForRadius,
} from '../cache/geohash.js';
import { AroundCache } from '../cache/around-cache.service.js';
import { EtymologyRepository } from '../db/etymology.repository.js';
import { PlacesRepository } from '../db/places.repository.js';
import { distanceMeters, mapsUrl } from '../geo/distance.js';
import type { EncyclopediaProvider } from '../providers/encyclopedia/encyclopedia.provider.js';
import {
  groundedEtymology,
  type SummaryClient,
} from '../providers/encyclopedia/grounded-etymology.js';
import { excerpt } from '../providers/encyclopedia/wiki-text.js';
import type { GeocodingProvider } from '../providers/geocoding/geocoding.provider.js';
import type {
  NearbyPlace,
  PlaceCategory,
  PlacesProvider,
} from '../providers/places/places.provider.js';
import {
  ENCYCLOPEDIA,
  GEOCODING,
  PLACES,
  SUMMARIZER,
} from '../providers/tokens.js';
import { ProviderNotConfiguredError } from '../resilience/errors.js';
import {
  nothingWithinMessage,
  rankPlaces,
  selectNearestEssentials,
} from '../ranking/rank.js';
import { ResilienceService } from '../resilience/resilience.service.js';
import type { AroundQueryDto } from './around.query.dto.js';

const SECTION_TTL_SECONDS: Record<AroundSectionName, number> = {
  essentials: 7 * 24 * 60 * 60,
  famous: 7 * 24 * 60 * 60,
  eat: 24 * 60 * 60,
  stay: 24 * 60 * 60,
  coffee: 24 * 60 * 60,
  about: 30 * 24 * 60 * 60,
};

const RANKED_SECTIONS = ['famous', 'eat', 'stay', 'coffee'] as const;

@Injectable()
export class AroundService {
  private readonly logger = new Logger(AroundService.name);

  constructor(
    @Inject(GEOCODING) private readonly geocoding: GeocodingProvider,
    @Inject(PLACES) private readonly places: PlacesProvider,
    @Inject(ENCYCLOPEDIA) private readonly encyclopedia: EncyclopediaProvider,
    @Inject(SUMMARIZER)
    private readonly summarizer: SummaryClient & { model: string },
    private readonly cache: AroundCache,
    private readonly resilience: ResilienceService,
    private readonly placeStore: PlacesRepository,
    private readonly etymologyStore: EtymologyRepository,
  ) {}

  async getAround(query: AroundQueryDto): Promise<AroundResponse> {
    const radiusKm = query.radius_km ?? 10;
    const [about, famous, essentials, eat, stay, coffee] = await Promise.all([
      this.cachedSection('about', query.lat, query.lng, radiusKm),
      this.cachedSection('famous', query.lat, query.lng, radiusKm),
      this.cachedSection('essentials', query.lat, query.lng, radiusKm),
      this.cachedSection('eat', query.lat, query.lng, radiusKm),
      this.cachedSection('stay', query.lat, query.lng, radiusKm),
      this.cachedSection('coffee', query.lat, query.lng, radiusKm),
    ]);
    return {
      meta: this.meta(query.lat, query.lng, radiusKm),
      about: asAbout(about),
      famous: asCards(famous),
      essentials: asEssentials(essentials),
      eat: asCards(eat),
      stay: asCards(stay),
      coffee: asCards(coffee),
    };
  }

  async getSection(
    name: AroundSectionName,
    query: AroundQueryDto,
  ): Promise<AroundSectionResponse<AboutPlace | PlaceCard | EssentialPlace>> {
    const radiusKm = query.radius_km ?? 10;
    const section = await this.cachedSection(
      name,
      query.lat,
      query.lng,
      radiusKm,
    );
    return { meta: this.meta(query.lat, query.lng, radiusKm), section };
  }

  async search(query: string): Promise<PlaceSearchHit[]> {
    try {
      const places = await this.resilience.run('nominatim', () =>
        this.geocoding.search(query),
      );
      return places.map((place) => ({
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        hierarchy: place.hierarchy,
      }));
    } catch (error) {
      this.logger.warn(`nominatim search failed: ${messageOf(error)}`);
      throw new ServiceUnavailableException(
        'Place search is temporarily unavailable',
      );
    }
  }

  private async cachedSection(
    name: AroundSectionName,
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Section<AboutPlace | PlaceCard | EssentialPlace>> {
    const precision =
      name === 'about' ? 6 : geohashPrecisionForRadius(radiusKm);
    const key = aroundCacheKey(
      name,
      encodeGeohash(lat, lng, precision),
      radiusKm,
    );
    const cached =
      await this.cache.get<Section<AboutPlace | PlaceCard | EssentialPlace>>(
        key,
      );
    if (cached) return cached;
    const loaded = await this.loadSection(name, lat, lng, radiusKm);
    if (loaded.status === 'ok' || loaded.status === 'empty') {
      await this.cache.set(key, loaded, SECTION_TTL_SECONDS[name]);
    }
    return loaded;
  }

  private loadSection(
    name: AroundSectionName,
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Section<AboutPlace | PlaceCard | EssentialPlace>> {
    if (name === 'about') return this.loadAbout(lat, lng);
    if (name === 'essentials') return this.loadEssentials(lat, lng);
    if ((RANKED_SECTIONS as readonly string[]).includes(name)) {
      return this.loadRanked(
        name as (typeof RANKED_SECTIONS)[number],
        lat,
        lng,
        radiusKm,
      );
    }
    return Promise.resolve({ status: 'error', message: 'Unknown section' });
  }

  private async loadAbout(
    lat: number,
    lng: number,
  ): Promise<Section<AboutPlace>> {
    try {
      const place = await this.resilience.run('nominatim', () =>
        this.geocoding.reverse(lat, lng),
      );
      void this.placeStore.save(place).catch((error: unknown) => {
        this.logger.warn(`place save skipped: ${messageOf(error)}`);
      });
      const story = await this.loadStory(lat, lng, place.name);
      return {
        status: 'ok',
        data: {
          name: place.name,
          hierarchy: place.hierarchy,
          significance: story.significance,
          etymology: story.etymology,
        },
      };
    } catch (error) {
      this.logger.warn(`nominatim failed: ${messageOf(error)}`);
      return { status: 'error', message: messageOf(error) };
    }
  }

  private async loadStory(
    lat: number,
    lng: number,
    name: string,
  ): Promise<{ significance?: string; etymology: AboutPlace['etymology'] }> {
    try {
      const article = await this.resilience.run('wikipedia', () =>
        this.encyclopedia.lookup({ lat, lng, name }),
      );
      if (!article) return { etymology: { status: 'not_found' } };
      const cached = await this.etymologyStore.get(article.placeKey);
      if (cached) {
        return {
          significance: article.extract
            ? excerpt(article.extract, 500)
            : undefined,
          etymology: {
            status: 'ok',
            summary: cached.summary,
            source_url: cached.sourceUrl,
          },
        };
      }
      const etymology = await groundedEtymology(
        article.etymologyText,
        article.sourceUrl,
        this.summarizer,
      );
      if (
        etymology.status === 'ok' &&
        etymology.summary &&
        etymology.source_url
      ) {
        void this.etymologyStore
          .save({
            placeKey: article.placeKey,
            summary: etymology.summary,
            sourceUrl: etymology.source_url,
            sourceText: article.etymologyText ?? etymology.summary,
            model: this.summarizer.model,
          })
          .catch((error: unknown) => {
            this.logger.warn(`etymology save skipped: ${messageOf(error)}`);
          });
      }
      return {
        significance: article.extract
          ? excerpt(article.extract, 500)
          : undefined,
        etymology,
      };
    } catch (error) {
      this.logger.warn(`wikipedia failed: ${messageOf(error)}`);
      return { etymology: { status: 'not_found' } };
    }
  }

  private async loadRanked(
    category: (typeof RANKED_SECTIONS)[number],
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Section<PlaceCard>> {
    try {
      let searched = radiusKm;
      let places = await this.fetchPlaces(lat, lng, radiusKm * 1000, category);
      if (places.length < 3) {
        const expanded = Math.min(radiusKm * 2, 50);
        if (expanded > searched) {
          searched = expanded;
          places = await this.fetchPlaces(lat, lng, expanded * 1000, category);
        }
      }
      const items = this.rankedCards(places, lat, lng, searched).slice(0, 20);
      if (items.length === 0) {
        return {
          status: 'empty',
          message: nothingWithinMessage(searched),
          searched_radius_km: searched,
          items: [],
        };
      }
      return { status: 'ok', searched_radius_km: searched, items };
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) {
        return { status: 'error', message: error.message };
      }
      this.logger.warn(`${category} failed: ${messageOf(error)}`);
      return { status: 'error', message: messageOf(error) };
    }
  }

  private async loadEssentials(
    lat: number,
    lng: number,
  ): Promise<Section<EssentialPlace>> {
    try {
      const places = await this.fetchPlaces(lat, lng, 50_000, 'essentials');
      const located = places.flatMap((place) => {
        if (!place.kind) return [];
        return [
          {
            kind: place.kind,
            distanceM: distanceMeters(lat, lng, place.lat, place.lng),
            card: { ...this.toCard(place, lat, lng), kind: place.kind },
          },
        ];
      });
      const selected = selectNearestEssentials(located);
      const items = selected.items.map((item) => item.card);
      if (items.length === 0) {
        return {
          status: 'empty',
          message: nothingWithinMessage(50),
          searched_radius_km: 50,
          items: [],
        };
      }
      const missing = selected.missing.map(essentialLabel).join(', ');
      return {
        status: 'ok',
        searched_radius_km: selected.searchedRadiusKm,
        message: missing ? `No ${missing} within 50 km` : undefined,
        items,
      };
    } catch (error) {
      this.logger.warn(`overpass essentials failed: ${messageOf(error)}`);
      return { status: 'error', message: messageOf(error) };
    }
  }

  private fetchPlaces(
    lat: number,
    lng: number,
    radiusM: number,
    category: PlaceCategory,
  ): Promise<NearbyPlace[]> {
    const provider =
      category === 'essentials' || category === 'famous'
        ? 'overpass'
        : 'google';
    return this.resilience.run(provider, () =>
      this.places.nearby({ lat, lng, radiusM, category }),
    );
  }

  private rankedCards(
    places: NearbyPlace[],
    lat: number,
    lng: number,
    radiusKm: number,
  ): PlaceCard[] {
    const ranked = rankPlaces(
      places.map((place) => ({
        place,
        distanceM: distanceMeters(lat, lng, place.lat, place.lng),
        rating: place.rating,
        reviewCount: place.reviewCount,
      })),
      radiusKm,
    );
    return ranked.map((entry) => this.toCard(entry.place, lat, lng));
  }

  private toCard(place: NearbyPlace, lat: number, lng: number): PlaceCard {
    return {
      id: place.id,
      name: place.name,
      category: place.category,
      lat: place.lat,
      lng: place.lng,
      distance_m: Math.round(distanceMeters(lat, lng, place.lat, place.lng)),
      rating: place.rating,
      review_count: place.reviewCount,
      open_now: place.openNow,
      phone: place.phone,
      maps_url: mapsUrl(place.lat, place.lng),
    };
  }

  private meta(lat: number, lng: number, radiusKm: number): AroundMeta {
    return {
      lat,
      lng,
      radius_km: radiusKm,
      geohash: encodeGeohash(lat, lng, geohashPrecisionForRadius(radiusKm)),
      generated_at: new Date().toISOString(),
    };
  }
}

function asAbout(
  section: Section<AboutPlace | PlaceCard | EssentialPlace>,
): Section<AboutPlace> {
  return section as Section<AboutPlace>;
}

function asCards(
  section: Section<AboutPlace | PlaceCard | EssentialPlace>,
): Section<PlaceCard> {
  return section as Section<PlaceCard>;
}

function asEssentials(
  section: Section<AboutPlace | PlaceCard | EssentialPlace>,
): Section<EssentialPlace> {
  return section as Section<EssentialPlace>;
}

function essentialLabel(kind: EssentialPlace['kind']): string {
  if (kind === 'hospital') return 'hospital';
  if (kind === 'police') return 'police station';
  return 'pharmacy';
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message === 'timeout') {
    return 'This section took too long. Pull to refresh to try again.';
  }
  return error instanceof Error ? error.message : 'unknown error';
}
