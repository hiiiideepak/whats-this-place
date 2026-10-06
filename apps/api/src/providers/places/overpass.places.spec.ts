import { mapOverpassElement, overpassQuery } from './overpass.places.js';

describe('overpassQuery', () => {
  it('asks for hospitals, police, and pharmacies inside the radius', () => {
    const query = overpassQuery(12.97, 77.59, 50_000, 'essentials');
    expect(query).toContain('["amenity"="hospital"]');
    expect(query).toContain('["amenity"="police"]');
    expect(query).toContain('["amenity"="pharmacy"]');
    expect(query).toContain('(around:50000,12.97,77.59)');
  });
});

describe('mapOverpassElement', () => {
  it('keeps an unnamed hospital and uses the way center', () => {
    const place = mapOverpassElement({
      type: 'way',
      id: 9,
      center: { lat: 12.98, lon: 77.6 },
      tags: { amenity: 'hospital', phone: '+91 80 0000 0000' },
    });
    expect(place).toMatchObject({
      id: 'way/9',
      name: 'Hospital',
      kind: 'hospital',
      phone: '+91 80 0000 0000',
      lat: 12.98,
      lng: 77.6,
    });
  });

  it('drops a famous feature that has no name', () => {
    expect(
      mapOverpassElement({
        type: 'node',
        id: 3,
        lat: 1,
        lon: 2,
        tags: { tourism: 'attraction' },
      }),
    ).toBeNull();
  });
});
