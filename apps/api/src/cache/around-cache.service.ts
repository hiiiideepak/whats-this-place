import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

const DOWN_FOR_MS = 30_000;

@Injectable()
export class AroundCache implements OnModuleDestroy {
  private redis: Redis | null = null;
  private unavailableUntil = 0;
  private readonly logger = new Logger(AroundCache.name);

  constructor(private readonly config: ConfigService) {}

  async get<T>(key: string): Promise<T | null> {
    const redis = await this.client();
    if (!redis) return null;
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      this.markDown(error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const redis = await this.client();
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.markDown(error);
    }
  }

  async hit(
    identity: string,
    windowSeconds: number,
    limit: number,
  ): Promise<boolean> {
    const redis = await this.client();
    if (!redis) return true;
    try {
      const key = `rl:${identity}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      return count <= limit;
    } catch (error) {
      this.markDown(error);
      return true;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.redis?.disconnect();
  }

  private async client(): Promise<Redis | null> {
    if (Date.now() < this.unavailableUntil) return null;
    try {
      if (!this.redis) {
        this.redis = new Redis(
          this.config.get<string>('REDIS_URL', 'redis://localhost:6379'),
          {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            connectTimeout: 2_000,
            retryStrategy: () => null,
          },
        );
        this.redis.on('error', () => undefined);
      }
      if (this.redis.status !== 'ready') await this.redis.connect();
      return this.redis;
    } catch (error) {
      this.markDown(error);
      return null;
    }
  }

  private markDown(error: unknown): void {
    this.unavailableUntil = Date.now() + DOWN_FOR_MS;
    this.logger.warn(
      `redis unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    this.redis?.disconnect();
    this.redis = null;
  }
}
