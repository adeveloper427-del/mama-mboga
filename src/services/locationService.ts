/**
 * Location abstraction. Today users pick a service area from a list, so no
 * location permission is requested. To enable GPS later: add expo-location,
 * flip appConfig.features.gpsLocation, and implement getCurrentPosition() +
 * reverse-geocode the coordinates to the nearest service area.
 */
import { appConfig } from '@/config';
import { NEIGHBOURS, SERVICE_AREAS } from '@/data/areas';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function getServiceAreas(): string[] {
  return [...SERVICE_AREAS];
}

export function getNearbyAreas(area: string): string[] {
  return NEIGHBOURS[area] ?? [];
}

export function isGpsAvailable(): boolean {
  return appConfig.features.gpsLocation;
}

/** Returns null until GPS support is enabled. */
export async function getCurrentPosition(): Promise<Coordinates | null> {
  if (!appConfig.features.gpsLocation) return null;
  return null;
}

/** Deep link to the platform maps app for directions to a shop. */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
