import type { AroundResponse, PlaceSearchHit } from '@around/shared-types';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AroundModule } from '../src/around/around.module.js';
import { AroundCache } from '../src/cache/around-cache.service.js';
import { PlacesRepository } from '../src/db/places.repository.js';
import type { GeocodingProvider } from '../src/providers/geocoding/geocoding.provider.js';
import type {
  NearbyQuery,
  PlacesProvider,
} from '../src/providers/places/places.provider.js';
import { GEOCODING, PLACES } from '../src/providers/tokens.js';

class MemoryCache {
  private readonly store = new Map<string, string>();

  async get<T>(key: string): Promise<T | null> {
    const raw = this.store.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }

  async hit(): Promise<boolean> {
    return true;
  }
}

describe('Around (e2e)', () => {
  let app: INestApplication<App>;
  const essentialCalls = { count: 0 };

  const geocoding: GeocodingProvider = {
    name: 'fake',
    reverse: vi.fn((lat: number) => {
      if (lat === 1) return Promise.reject(new Error('geocoder down'));
      return Promise.resolve({
        name: 'Shivajinagar',
        lat,
        lng: 77.5946,
        hierarchy: {
          locality: 'Shivajinagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          country: 'India',
        },
        placeKey: 'tdr1y2z',
      });
    }),
    search: vi.fn(() =>
      Promise.resolve([
        {
          name: 'Mysuru',
          lat: 12.2958,
          lng: 76.6394,
          hierarchy: { city: 'Mysuru', state: 'Karnataka' },
          placeKey: 'tdr4',
        },
      ]),
    ),
  };

  const places: PlacesProvider = {
    name: 'fake',
    nearby: vi.fn((query: NearbyQuery) => {
      if (query.category === 'essentials') {
        essentialCalls.count += 1;
        return Promise.resolve([
          {
            id: 'hospital-1',
            name: 'City Hospital',
            category: 'hospital',
            kind: 'hospital' as const,
            lat: query.lat + 0.08,
            lng: query.lng,
          },
          {
            id: 'pharmacy-1',
            name: 'Corner Pharmacy',
            category: 'pharmacy',
            kind: 'pharmacy' as const,
            lat: query.lat + 0.001,
            lng: query.lng,
          },
        ]);
      }
      if (query.category === 'famous') {
        if (query.lat === 0 || query.radiusM < 10_000)
          return Promise.resolve([]);
        return Promise.resolve([
          {
            id: 'lalbagh',
            name: 'Lalbagh',
            category: 'attraction',
            lat: query.lat - 0.02,
            lng: query.lng,
          },
        ]);
      }
      return Promise.resolve([]);
    }),
  };

  beforeEach(async () => {
    essentialCalls.count = 0;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AroundModule],
    })
      .overrideProvider(GEOCODING)
      .useValue(geocoding)
      .overrideProvider(PLACES)
      .useValue(places)
      .overrideProvider(AroundCache)
      .useClass(MemoryCache)
      .overrideProvider(PlacesRepository)
      .useValue({ save: () => Promise.resolve() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /v1/around returns sections and keeps essentials beyond the radius', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/around')
      .query({ lat: 12.9716, lng: 77.5946, radius_km: 5 })
      .expect(200);
    const body = response.body as AroundResponse;

    expect(body.about.status).toBe('ok');
    expect(body.about.data?.name).toBe('Shivajinagar');
    expect(body.about.data?.etymology.status).toBe('not_found');
    expect(body.famous.status).toBe('ok');
    expect(body.famous.items?.[0]?.name).toBe('Lalbagh');
    expect(body.famous.searched_radius_km).toBe(10);
    expect(body.essentials.status).toBe('ok');
    const hospital = body.essentials.items?.find(
      (item) => item.kind === 'hospital',
    );
    expect(hospital?.distance_m).toBeGreaterThan(5_000);
    expect(body.essentials.message).toContain('police station');
    expect(body.eat.status).toBe('error');
    expect(body.meta.radius_km).toBe(5);
  });

  it('says nothing is nearby when famous stays empty after one expansion', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/around/famous')
      .query({ lat: 0, lng: 0, radius_km: 10 })
      .expect(200);
    const body = response.body as { section: AroundResponse['famous'] };
    expect(body.section.status).toBe('empty');
    expect(body.section.message).toBe('Nothing within 20 km');
  });

  it('keeps essentials when reverse geocoding fails', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/around')
      .query({ lat: 1, lng: 77.5, radius_km: 10 })
      .expect(200);
    const body = response.body as AroundResponse;
    expect(body.about.status).toBe('error');
    expect(body.essentials.status).toBe('ok');
  });

  it('serves a repeated essentials request from cache', async () => {
    await request(app.getHttpServer())
      .get('/v1/around/essentials')
      .query({ lat: 12.9716, lng: 77.5946, radius_km: 10 })
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/around/essentials')
      .query({ lat: 12.9716, lng: 77.5946, radius_km: 10 })
      .expect(200);
    expect(essentialCalls.count).toBe(1);
  });

  it('rejects an invalid coordinate', async () => {
    await request(app.getHttpServer())
      .get('/v1/around')
      .query({ lat: 999, lng: 77.5 })
      .expect(400);
  });

  it('searches a place name', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/places/search')
      .query({ q: 'Mysuru' })
      .expect(200);
    const body = response.body as PlaceSearchHit[];
    expect(body[0]?.name).toBe('Mysuru');
  });
});
