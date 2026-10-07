import type {
  NearbyPlace,
  NearbyQuery,
  PlacesProvider,
} from './places.provider.js';

export class RoutingPlacesProvider implements PlacesProvider {
  readonly name = 'routing';

  constructor(
    private readonly overpass: PlacesProvider,
    private readonly google: PlacesProvider,
  ) {}

  nearby(query: NearbyQuery): Promise<NearbyPlace[]> {
    if (query.category === 'essentials' || query.category === 'famous') {
      return this.overpass.nearby(query);
    }
    return this.google.nearby(query);
  }
}
