export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const RADIUS_PRESETS = [5, 10, 25] as const;

export type RadiusPreset = (typeof RADIUS_PRESETS)[number];
