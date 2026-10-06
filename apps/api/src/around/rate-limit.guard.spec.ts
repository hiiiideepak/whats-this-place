import { rateLimitIdentity } from './rate-limit.guard.js';

describe('rateLimitIdentity', () => {
  it('uses a device id when it looks like a token', () => {
    expect(rateLimitIdentity('phone-abc123', '127.0.0.1')).toBe('phone-abc123');
  });

  it('falls back to the IP for a short or odd header', () => {
    expect(rateLimitIdentity('nope', '10.0.0.8')).toBe('10.0.0.8');
    expect(rateLimitIdentity(undefined, undefined)).toBe('unknown');
  });
});
