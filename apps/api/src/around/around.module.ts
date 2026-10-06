import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AroundCache } from '../cache/around-cache.service.js';
import { PlacesRepository } from '../db/places.repository.js';
import { NominatimGeocodingProvider } from '../providers/geocoding/nominatim.geocoding.js';
import { OverpassPlacesProvider } from '../providers/places/overpass.places.js';
import { GEOCODING, PLACES } from '../providers/tokens.js';
import { ResilienceService } from '../resilience/resilience.service.js';
import { AroundController } from './around.controller.js';
import { AroundService } from './around.service.js';
import { DeviceRateLimitGuard } from './rate-limit.guard.js';

@Module({
  controllers: [AroundController],
  providers: [
    AroundService,
    AroundCache,
    PlacesRepository,
    ResilienceService,
    DeviceRateLimitGuard,
    {
      provide: GEOCODING,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new NominatimGeocodingProvider(
          config.get<string>(
            'NOMINATIM_BASE_URL',
            'https://nominatim.openstreetmap.org',
          ),
          config.get<string>(
            'NOMINATIM_USER_AGENT',
            'Around/0.1 (https://github.com/hiiiideepak/whats-this-place)',
          ),
        ),
    },
    {
      provide: PLACES,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OverpassPlacesProvider(
          config.get<string>(
            'OVERPASS_URL',
            'https://overpass-api.de/api/interpreter',
          ),
          config.get<string>(
            'NOMINATIM_USER_AGENT',
            'Around/0.1 (https://github.com/hiiiideepak/whats-this-place)',
          ),
        ),
    },
  ],
})
export class AroundModule {}
