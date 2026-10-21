import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface Props {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
  border?: boolean;
}

export function goBack(fallback: string = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export function Header({ title, subtitle, back = true, onBack, right, large, border }: Props) {
  return (
    <View style={[styles.bar, border && styles.border]}>
      {back ? (
        <IconButton icon="arrow-back" label="Go back" onPress={onBack ?? (() => goBack())} />
      ) : (
        <View style={{ width: large ? 0 : spacing.xs }} />
      )}
      <View style={[styles.titles, large && !back && { paddingLeft: spacing.md }]}>
        {!!title && (
          <AppText variant={large ? 'h1' : 'h3'} numberOfLines={1} accessibilityRole="header">
            {title}
          </AppText>
        )}
        {!!subtitle && (
          <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: spacing.xs + 2, gap: spacing.xs },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  titles: { flex: 1, paddingHorizontal: spacing.xs },
  right: { flexDirection: 'row', alignItems: 'center' },
});
