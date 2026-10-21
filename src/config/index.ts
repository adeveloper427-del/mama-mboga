/**
 * App-wide configuration and feature flags.
 * Values prefixed EXPO_PUBLIC_ are safe to ship in the app bundle. Secrets
 * (M-Pesa Daraja keys, Supabase service-role key, SMS API keys) must never be
 * placed here — they live on the backend only.
 */

export const appConfig = {
  name: 'Mama Mboga',
  tagline: 'Fresh from your local mama mboga',
  version: '1.0.0',
  currency: 'KSh',
  supportPhone: '+254700123456',
  supportEmail: 'support@mamamboga.co.ke',
  supportWhatsApp: '254700123456',

  backend: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },

  /** Simulated network latency for the local data store (ms). */
  mockLatency: { min: 120, max: 320 },

  features: {
    /** M-Pesa STK Push — enabled once the backend payment endpoint exists. */
    mpesa: false,
    /** Device GPS for "near me" — enabled once expo-location is added. */
    gpsLocation: false,
    /** Remote push notifications (Expo Push / FCM). */
    pushNotifications: false,
  },

  security: {
    minPasswordLength: 8,
    maxLoginAttempts: 5,
    lockoutMinutes: 5,
  },
};

export const isBackendConfigured = Boolean(
  appConfig.backend.supabaseUrl && appConfig.backend.supabaseAnonKey,
);
