import {
  aroundCacheKey,
  encodeGeohash,
  geohashPrecisionForRadius,
} from './geohash.js';

describe('encodeGeohash', () => {
  it('matches the known geohash for a published coordinate', () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
  });
});

describe('geohashPrecisionForRadius', () => {
  it('uses finer cells for smaller radii', () => {
    expect(geohashPrecisionForRadius(5)).toBe(6);
    expect(geohashPrecisionForRadius(10)).toBe(5);
    expect(geohashPrecisionForRadius(25)).toBe(4);
    expect(geohashPrecisionForRadius(40)).toBe(5);
  });
});

describe('aroundCacheKey', () => {
  it('includes version, geohash, section, and radius', () => {
    expect(aroundCacheKey('essentials', 'tdr', 10)).toBe(
      'around:v2:tdr:essentials:10',
    );
  });
});
