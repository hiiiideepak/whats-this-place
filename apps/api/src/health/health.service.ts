import type { DependencyCheck, HealthResponse } from '@around/shared-types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Client } from 'pg';

const DEFAULT_DATABASE_URL = 'postgresql://around:around@localhost:5433/around';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';
const CONNECT_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService) {}

  async check(): Promise<HealthResponse> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);
    const status =
      postgres.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded';
    return { status, service: 'around-api', checks: { postgres, redis } };
  }

  private async checkPostgres(): Promise<DependencyCheck> {
    const client = new Client({
      connectionString: this.config.get<string>(
        'DATABASE_URL',
        DEFAULT_DATABASE_URL,
      ),
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
    const started = Date.now();
    try {
      await client.connect();
      await client.query('SELECT postgis_version()');
      return { status: 'up', latency_ms: Date.now() - started };
    } catch (error) {
      return { status: 'down', error: errorMessage(error) };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    const redis = new Redis(
      this.config.get<string>('REDIS_URL', DEFAULT_REDIS_URL),
      {
        connectTimeout: CONNECT_TIMEOUT_MS,
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: () => null,
      },
    );
    const started = Date.now();
    const connectError = waitForRedisError(redis);
    try {
      await redis.connect();
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        return { status: 'down', error: 'unexpected ping response' };
      }
      return { status: 'up', latency_ms: Date.now() - started };
    } catch (error) {
      return {
        status: 'down',
        error: errorMessage(connectError.current ?? error),
      };
    } finally {
      redis.disconnect();
    }
  }
}

function waitForRedisError(redis: Redis): { current?: Error } {
  const captured: { current?: Error } = {};
  redis.on('error', (error: Error) => {
    captured.current = error;
  });
  return captured;
}

function errorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    const first = error.errors.find((item) => item instanceof Error);
    if (first instanceof Error && first.message) {
      return first.message;
    }
  }
  return error instanceof Error && error.message
    ? error.message
    : 'unknown error';
}
