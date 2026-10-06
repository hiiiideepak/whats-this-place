import { mapNominatimPlace } from './nominatim.geocoding.js';

describe('mapNominatimPlace', () => {
  it('builds locality, city, district, and state from OSM address parts', () => {
    const place = mapNominatimPlace({
      lat: '12.9716',
      lon: '77.5946',
      osm_type: 'node',
      osm_id: 1,
      address: {
        suburb: 'Shivajinagar',
        city: 'Bengaluru',
        state_district: 'Bengaluru Urban',
        state: 'Karnataka',
        country: 'India',
      },
    });
    expect(place.name).toBe('Shivajinagar');
    expect(place.hierarchy).toEqual({
      locality: 'Shivajinagar',
      city: 'Bengaluru',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      country: 'India',
    });
    expect(place.osmId).toBe('node/1');
  });

  it('rejects a result without coordinates', () => {
    expect(() => mapNominatimPlace({ display_name: 'Nowhere' })).toThrow(
      'invalid geocoding response',
    );
  });
});
