import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { appConfig } from '@/config';
import { useAuth } from '@/store/AuthContext';
import { colors, gradients, spacing } from '@/theme';
import { homeFor } from '@/utils/routes';

/** Branded splash while the session is restored, then route to the right place. */
export default function Splash() {
  const { status, user, needsOnboarding, bootError, retryBoot } = useAuth();
  const scale = useRef(new Animated.Value(0.85)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [scale, fade]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'signedIn' && user) router.replace(homeFor(user.role) as never);
    else router.replace(needsOnboarding ? '/onboarding' : '/login');
  }, [status, user, needsOnboarding]);

  return (
    <LinearGradient colors={gradients.brand} style={styles.root}>
      <StatusBar style="light" />
      <Animated.View style={[styles.center, { opacity: fade, transform: [{ scale }] }]}>
        <View style={styles.logo}>
          <Ionicons name="basket" size={52} color={colors.primary} />
          <View style={styles.leaf}>
            <Ionicons name="leaf" size={22} color={colors.white} />
          </View>
        </View>
        <AppText variant="hero" color={colors.white} style={{ marginTop: spacing.xl }}>
          {appConfig.name}
        </AppText>
        <AppText variant="body" color="rgba(255,255,255,0.85)">
          {appConfig.tagline}
        </AppText>
      </Animated.View>
      {bootError && (
        <View style={styles.error}>
          <AppText variant="body" color={colors.white} align="center">
            {bootError}
          </AppText>
          <Button title="Try again" variant="accent" onPress={retryBoot} style={{ marginTop: spacing.md }} />
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  logo: { width: 104, height: 104, borderRadius: 32, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 12px 30px rgba(0,0,0,0.25)' },
  leaf: { position: 'absolute', top: -8, right: -8, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white },
  error: { position: 'absolute', bottom: 80, left: spacing.xxl, right: spacing.xxl, alignItems: 'center' },
});
