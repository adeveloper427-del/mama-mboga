import AsyncStorage from '@react-native-async-storage/async-storage';

/** Small typed wrapper over AsyncStorage for device-local preferences. */
export const localStore = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — preferences are non-critical.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const storageKeys = {
  onboardingDone: 'mm.onboarding.done',
  cart: (userId: string) => `mm.cart.${userId}`,
  recentlyViewed: (userId: string) => `mm.recent.${userId}`,
  searchHistory: (userId: string) => `mm.search.${userId}`,
  preferences: (userId: string) => `mm.prefs.${userId}`,
};
