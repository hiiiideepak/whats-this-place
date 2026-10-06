import { distanceMeters } from './distance.js';

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(12.97, 77.59, 12.97, 77.59)).toBe(0);
  });

  it('is about 111 km for one degree of latitude', () => {
    const meters = distanceMeters(0, 0, 1, 0);
    expect(meters).toBeGreaterThan(110_000);
    expect(meters).toBeLessThan(112_000);
  });
});
