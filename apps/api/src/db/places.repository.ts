import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { GeocodedPlace } from '../providers/geocoding/geocoding.provider.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_key text NOT NULL UNIQUE,
  osm_id text,
  wikidata_id text,
  name text NOT NULL,
  locality text,
  city text,
  district text,
  state text,
  country text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geog geography(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS places_geog_idx ON places USING GIST (geog);
`;

@Injectable()
export class PlacesRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady = false;
  private unavailableUntil = 0;
  private readonly logger = new Logger(PlacesRepository.name);

  constructor(private readonly config: ConfigService) {}

  async save(place: GeocodedPlace): Promise<void> {
    const pool = await this.ready();
    if (!pool) return;
    await pool.query(
      `INSERT INTO places (
         place_key, osm_id, name, locality, city, district, state, country, lat, lng, geog, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         ST_SetSRID(ST_MakePoint($10, $9), 4326)::geography,
         now()
       )
       ON CONFLICT (place_key) DO UPDATE SET
         osm_id = EXCLUDED.osm_id,
         name = EXCLUDED.name,
         locality = EXCLUDED.locality,
         city = EXCLUDED.city,
         district = EXCLUDED.district,
         state = EXCLUDED.state,
         country = EXCLUDED.country,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         geog = EXCLUDED.geog,
         updated_at = now()`,
      [
        place.placeKey,
        place.osmId ?? null,
        place.name,
        place.hierarchy.locality ?? null,
        place.hierarchy.city ?? null,
        place.hierarchy.district ?? null,
        place.hierarchy.state ?? null,
        place.hierarchy.country ?? null,
        place.lat,
        place.lng,
      ],
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  private async ready(): Promise<Pool | null> {
    if (Date.now() < this.unavailableUntil) return null;
    try {
      if (!this.pool) {
        this.pool = new Pool({
          connectionString: this.config.get<string>(
            'DATABASE_URL',
            'postgresql://around:around@localhost:5433/around',
          ),
          connectionTimeoutMillis: 2_000,
          max: 2,
        });
      }
      if (!this.schemaReady) {
        await this.pool.query(SCHEMA);
        this.schemaReady = true;
      }
      return this.pool;
    } catch (error) {
      this.unavailableUntil = Date.now() + 30_000;
      this.logger.warn(
        `postgres unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      await this.pool?.end().catch(() => undefined);
      this.pool = null;
      this.schemaReady = false;
      return null;
    }
  }
}
