import { CircuitBreaker, CircuitOpenError } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('opens after five failures and rejects until the window passes', async () => {
    let now = 0;
    const breaker = new CircuitBreaker(5, 30_000, () => now);
    const fail = () => Promise.reject(new Error('down'));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(breaker.execute(fail)).rejects.toThrow('down');
    }

    await expect(breaker.execute(fail)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );

    now = 30_000;
    await expect(breaker.execute(() => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
    await expect(breaker.execute(() => Promise.resolve('still'))).resolves.toBe(
      'still',
    );
  });

  it('reopens when the half-open trial fails', async () => {
    let now = 0;
    const breaker = new CircuitBreaker(1, 30_000, () => now);
    await expect(
      breaker.execute(() => Promise.reject(new Error('down'))),
    ).rejects.toThrow('down');
    now = 30_000;
    await expect(
      breaker.execute(() => Promise.reject(new Error('again'))),
    ).rejects.toThrow('again');
    await expect(
      breaker.execute(() => Promise.resolve('no')),
    ).rejects.toBeInstanceOf(CircuitOpenError);
  });
});
