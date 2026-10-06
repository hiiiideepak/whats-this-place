import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_KEY = 'around.deviceId';

export async function loadDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
  const created = `device-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}
