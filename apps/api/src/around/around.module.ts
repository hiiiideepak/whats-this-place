import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AroundCache } from '../cache/around-cache.service.js';
import { EtymologyRepository } from '../db/etymology.repository.js';
import { PlacesRepository } from '../db/places.repository.js';
import { AnthropicSummarizer } from '../providers/encyclopedia/anthropic.summarizer.js';
import { WikipediaEncyclopediaProvider } from '../providers/encyclopedia/wikipedia.encyclopedia.js';
import { NominatimGeocodingProvider } from '../providers/geocoding/nominatim.geocoding.js';
import { GooglePlacesProvider } from '../providers/places/google.places.js';
import { OverpassPlacesProvider } from '../providers/places/overpass.places.js';
import { RoutingPlacesProvider } from '../providers/places/routing.places.js';
import {
  ENCYCLOPEDIA,
  GEOCODING,
  PLACES,
  SUMMARIZER,
} from '../providers/tokens.js';
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
    EtymologyRepository,
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
      useFactory: (config: ConfigService) => {
        const userAgent = config.get<string>(
          'NOMINATIM_USER_AGENT',
          'Around/0.1 (https://github.com/hiiiideepak/whats-this-place)',
        );
        return new RoutingPlacesProvider(
          new OverpassPlacesProvider(
            config.get<string>(
              'OVERPASS_URL',
              'https://overpass-api.de/api/interpreter',
            ),
            userAgent,
          ),
          new GooglePlacesProvider(
            config.get<string>('GOOGLE_PLACES_API_KEY', ''),
          ),
        );
      },
    },
    {
      provide: ENCYCLOPEDIA,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new WikipediaEncyclopediaProvider(
          config.get<string>(
            'WIKIPEDIA_API_URL',
            'https://en.wikipedia.org/w/api.php',
          ),
          config.get<string>(
            'NOMINATIM_USER_AGENT',
            'Around/0.1 (https://github.com/hiiiideepak/whats-this-place)',
          ),
        ),
    },
    {
      provide: SUMMARIZER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new AnthropicSummarizer(
          config.get<string>('ANTHROPIC_API_KEY', ''),
          config.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-4-5'),
        ),
    },
  ],
})
export class AroundModule {}
