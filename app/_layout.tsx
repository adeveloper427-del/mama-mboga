import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/ui';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import { CartProvider } from '@/store/CartContext';
import { DialogProvider } from '@/store/DialogContext';
import { NetworkProvider } from '@/store/NetworkContext';
import { ToastProvider } from '@/store/ToastContext';
import { colors } from '@/theme';
import { homeFor } from '@/utils/routes';

const PUBLIC = new Set(['(auth)', 'onboarding']);

/** Central route guard: signed-out users go to login; signed-in users never see auth screens. */
function RouteGuard() {
  const { status, user, needsOnboarding } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (status === 'loading') return;
    const first = segments[0] as string | undefined;
    const atSplash = !first || first === 'index';
    if (atSplash) return; // the splash screen decides where to go
    if (status === 'signedOut' && !PUBLIC.has(first!)) {
      router.replace(needsOnboarding ? '/onboarding' : '/login');
    } else if (status === 'signedIn' && user && PUBLIC.has(first!)) {
      router.replace(homeFor(user.role) as never);
    } else if (status === 'signedIn' && user) {
      // Keep each role inside its own area.
      if (first === 'seller' && user.role !== 'seller') router.replace(homeFor(user.role) as never);
      if (first === 'admin' && user.role !== 'admin') router.replace(homeFor(user.role) as never);
      if (first === '(customer)' && user.role !== 'customer') router.replace(homeFor(user.role) as never);
    }
  }, [status, user, segments, needsOnboarding]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NetworkProvider>
          <ToastProvider>
            <DialogProvider>
              <AuthProvider>
                <CartProvider>
                  <StatusBar style="dark" />
                  <RouteGuard />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background },
                      animation: 'slide_from_right',
                    }}
                  >
                    <Stack.Screen name="index" options={{ animation: 'fade' }} />
                    <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                    <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                    <Stack.Screen name="(customer)" options={{ animation: 'fade' }} />
                    <Stack.Screen name="seller" options={{ animation: 'fade' }} />
                    <Stack.Screen name="admin" options={{ animation: 'fade' }} />
                    <Stack.Screen name="order-success" options={{ animation: 'fade', gestureEnabled: false }} />
                  </Stack>
                  <OfflineBanner />
                </CartProvider>
              </AuthProvider>
            </DialogProvider>
          </ToastProvider>
        </NetworkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
