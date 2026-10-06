export class CircuitOpenError extends Error {
  constructor() {
    super('Temporarily unavailable');
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly threshold = 5,
    private readonly openMs = 30_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const time = this.now();
    if (time < this.openUntil) {
      throw new CircuitOpenError();
    }
    const halfOpenTrial = this.openUntil !== 0;
    try {
      const result = await fn();
      this.failures = 0;
      this.openUntil = 0;
      return result;
    } catch (error) {
      if (halfOpenTrial || this.failures + 1 >= this.threshold) {
        this.failures = this.threshold;
        this.openUntil = this.now() + this.openMs;
      } else {
        this.failures += 1;
      }
      throw error;
    }
  }
}
