import * as Location from 'expo-location';

export type GpsFix =
  | { kind: 'ready'; lat: number; lng: number }
  | { kind: 'denied' }
  | { kind: 'blocked' }
  | { kind: 'services-off' };

export async function locate(): Promise<GpsFix> {
  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) return { kind: 'services-off' };

  const current = await Location.getForegroundPermissionsAsync();
  if (!current.granted && !current.canAskAgain) return { kind: 'blocked' };

  const permission = current.granted
    ? current
    : await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return { kind: permission.canAskAgain ? 'denied' : 'blocked' };
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    kind: 'ready',
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}
