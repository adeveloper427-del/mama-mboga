import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import type { ApiError } from '@/services';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

interface EmptyProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: string;
  compact?: boolean;
}

/** Friendly placeholder for lists with nothing in them. */
export function EmptyState({ icon, title, message, actionLabel, onAction, tone = colors.primary, compact }: EmptyProps) {
  return (
    <View style={[styles.center, compact ? styles.compact : styles.full]}>
      <View style={[styles.iconRing, { backgroundColor: `${tone}14` }]}>
        <View style={[styles.iconInner, { backgroundColor: `${tone}22` }]}>
          <Ionicons name={icon} size={compact ? 28 : 36} color={tone} />
        </View>
      </View>
      <AppText variant="h3" align="center" style={{ marginTop: spacing.lg }}>
        {title}
      </AppText>
      {!!message && (
        <AppText variant="body" align="center" color={colors.textMuted} style={styles.message}>
          {message}
        </AppText>
      )}
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.xl, minWidth: 180 }} />}
    </View>
  );
}

/** Error view with retry; recognises offline errors. */
export function ErrorState({ error, onRetry, compact }: { error: ApiError | null; onRetry?: () => void; compact?: boolean }) {
  const offline = error?.code === 'offline';
  const notFound = error?.code === 'not_found';
  return (
    <EmptyState
      icon={offline ? 'cloud-offline-outline' : notFound ? 'search-outline' : 'warning-outline'}
      tone={offline ? colors.textSecondary : notFound ? colors.accent : colors.danger}
      title={offline ? 'No internet connection' : notFound ? 'Not found' : 'Something went wrong'}
      message={error?.message ?? 'Please try again.'}
      actionLabel={onRetry && !notFound ? 'Try again' : undefined}
      onAction={onRetry}
      compact={compact}
    />
  );
}

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={[styles.center, styles.full]} accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label && (
        <AppText variant="small" color={colors.textMuted} style={{ marginTop: spacing.md }}>
          {label}
        </AppText>
      )}
    </View>
  );
}

/** Pulsing placeholder block shown while content loads. */
export function Skeleton({ width = '100%', height = 16, rounded = radius.sm, style }: { width?: DimensionValue; height?: number; rounded?: number; style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: '#E4EAE5', opacity: pulse }, style]} />;
}

export function SkeletonList({ rows = 5, height = 76 }: { rows?: number; height?: number }) {
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skelRow}>
          <Skeleton width={height - 16} height={height - 16} rounded={radius.md} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="45%" height={12} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonGrid({ items = 4 }: { items?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: items }).map((_, i) => (
        <View key={i} style={styles.gridItem}>
          <Skeleton height={120} rounded={radius.md} />
          <Skeleton width="80%" height={14} style={{ marginTop: spacing.sm }} />
          <Skeleton width="50%" height={12} style={{ marginTop: spacing.xs }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  full: { flex: 1, paddingVertical: 64, paddingHorizontal: spacing.xxl },
  compact: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  iconRing: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  iconInner: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  message: { marginTop: spacing.sm, maxWidth: 320 },
  skelRow: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, padding: spacing.sm, borderRadius: radius.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { width: '47%', backgroundColor: colors.card, padding: spacing.sm, borderRadius: radius.lg },
});
