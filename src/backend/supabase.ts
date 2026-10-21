/**
 * The Supabase client. Only files in src/services may import this module.
 *
 * The session (access + refresh token) is persisted in AsyncStorage and
 * refreshed automatically while the app is in the foreground.
 */
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { appConfig } from '@/config';

export const supabase = createClient(appConfig.backend.supabaseUrl, appConfig.backend.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    storageKey: 'mm.auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Token refresh only needs to run while the app is visible (native only; the web client manages itself).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
