import { ProviderNotConfiguredError } from '../../resilience/errors.js';
import { GooglePlacesProvider, mapGooglePlace } from './google.places.js';

describe('mapGooglePlace', () => {
  it('keeps the fields we are allowed to show', () => {
    const place = mapGooglePlace(
      {
        id: 'places/abc',
        displayName: { text: 'Cafe' },
        location: { latitude: 12.9, longitude: 77.6 },
        rating: 4.6,
        userRatingCount: 80,
        nationalPhoneNumber: '+91 80 0000',
        currentOpeningHours: { openNow: true },
        primaryType: 'cafe',
      },
      'coffee',
    );
    expect(place).toMatchObject({
      id: 'places/abc',
      name: 'Cafe',
      rating: 4.6,
      reviewCount: 80,
      openNow: true,
      phone: '+91 80 0000',
    });
  });
});

describe('GooglePlacesProvider', () => {
  it('does not call the network when the API key is missing', async () => {
    const fetchImpl = (() => {
      throw new Error('network');
    }) as typeof fetch;
    const provider = new GooglePlacesProvider('', fetchImpl);
    await expect(
      provider.nearby({ lat: 1, lng: 2, radiusM: 1000, category: 'eat' }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});
