import { Injectable } from '@nestjs/common';
import { CircuitBreaker } from './circuit-breaker.js';
import { withRetry } from './retry.js';

@Injectable()
export class ResilienceService {
  private readonly breakers = new Map<string, CircuitBreaker>();

  run<T>(provider: string, fn: () => Promise<T>): Promise<T> {
    return this.breakerFor(provider).execute(() => withRetry(fn));
  }

  private breakerFor(provider: string): CircuitBreaker {
    const existing = this.breakers.get(provider);
    if (existing) return existing;
    const created = new CircuitBreaker();
    this.breakers.set(provider, created);
    return created;
  }
}
