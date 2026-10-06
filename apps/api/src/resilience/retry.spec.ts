import { HttpError, isRetryable, withRetry } from './retry.js';

describe('withRetry', () => {
  it('retries a 503 then returns the later success', async () => {
    let calls = 0;
    const result = await withRetry(
      () => {
        calls += 1;
        if (calls < 3) return Promise.reject(new HttpError(503));
        return Promise.resolve('ok');
      },
      () => Promise.resolve(),
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry a 400', async () => {
    let calls = 0;
    await expect(
      withRetry(
        () => {
          calls += 1;
          return Promise.reject(new HttpError(400));
        },
        () => Promise.resolve(),
      ),
    ).rejects.toBeInstanceOf(HttpError);
    expect(calls).toBe(1);
  });
});

describe('isRetryable', () => {
  it('retries timeouts and rate limits', () => {
    expect(isRetryable(new Error('timeout'))).toBe(true);
    expect(isRetryable(new HttpError(429))).toBe(true);
    expect(isRetryable(new HttpError(404))).toBe(false);
  });
});
