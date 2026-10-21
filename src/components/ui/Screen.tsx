import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  header?: ReactNode;
  /** Sticky bottom bar (e.g. "Add to cart", "Place order"). */
  footer?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  /** Skip the top safe-area inset (for screens with a full-bleed hero image). */
  edgeToEdge?: boolean;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Standard page wrapper: safe areas, background, scrolling, pull-to-refresh, sticky footer. */
export function Screen({
  children, header, footer, scroll = true, padded = true, refreshing, onRefresh, keyboard, edgeToEdge, background, contentStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padded && styles.padded, { paddingBottom: footer ? spacing.xl : spacing.xxxl + insets.bottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentStyle]}>{children}</View>
  );

  const content = (
    <>
      {header}
      {body}
      {footer && <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{footer}</View>}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: background ?? colors.background, paddingTop: edgeToEdge ? 0 : insets.top }]}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow.md,
  },
});
