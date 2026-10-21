import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string; pressed: string }> = {
  primary: { bg: colors.primary, fg: colors.white, pressed: colors.primaryDark },
  secondary: { bg: colors.primaryLight, fg: colors.primaryDark, pressed: '#D3EADB' },
  outline: { bg: colors.card, fg: colors.text, border: colors.border, pressed: colors.muted },
  ghost: { bg: 'transparent', fg: colors.primary, pressed: colors.primaryLight },
  danger: { bg: colors.dangerLight, fg: colors.danger, pressed: '#FCD4D4' },
  accent: { bg: colors.accent, fg: colors.white, pressed: '#D9761A' },
};

const SIZES: Record<Size, { h: number; px: number; fs: number; icon: number }> = {
  sm: { h: 36, px: spacing.md, fs: font.size.sm, icon: 16 },
  md: { h: 48, px: spacing.lg, fs: font.size.md, icon: 18 },
  lg: { h: 56, px: spacing.xl, fs: font.size.lg, icon: 20 },
};

export function Button({
  title, onPress, variant = 'primary', size = 'md', icon, iconRight, loading, disabled, fullWidth, style, accessibilityLabel,
}: Props) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        { height: s.h, paddingHorizontal: s.px, backgroundColor: pressed ? v.pressed : v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        fullWidth && styles.full,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={s.icon} color={v.fg} />}
          <Text style={[styles.text, { color: v.fg, fontSize: s.fs }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          {iconRight && <Ionicons name={iconRight} size={s.icon} color={v.fg} />}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { fontWeight: font.weight.semibold },
});
