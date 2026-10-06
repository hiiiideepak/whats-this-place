import { CircuitOpenError } from './circuit-breaker.js';

export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

const BACKOFF_MS = [100, 300];

export function isRetryable(error: unknown): boolean {
  if (error instanceof CircuitOpenError) return false;
  if (error instanceof HttpError) {
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof Error && error.message === 'timeout') return true;
  if (
    error instanceof Error &&
    /ECONN|fetch failed|network/i.test(error.message)
  ) {
    return true;
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = delay,
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt === 2 || !isRetryable(error)) throw error;
      await sleep(BACKOFF_MS[attempt] ?? 300);
    }
  }
  throw last instanceof Error ? last : new Error('unknown error');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
