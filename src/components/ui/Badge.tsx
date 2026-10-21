import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent' | 'purple' | 'dark';

export const TONES: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: colors.primaryLight, fg: colors.primaryDark },
  success: { bg: colors.successLight, fg: '#15803D' },
  warning: { bg: colors.warningLight, fg: '#B45309' },
  danger: { bg: colors.dangerLight, fg: '#B91C1C' },
  info: { bg: colors.infoLight, fg: '#1D4ED8' },
  neutral: { bg: colors.muted, fg: colors.textSecondary },
  accent: { bg: colors.accentLight, fg: '#C2410C' },
  purple: { bg: colors.purpleLight, fg: '#6D28D9' },
  dark: { bg: 'rgba(0,0,0,0.6)', fg: colors.white },
};

interface Props {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  dot?: boolean;
}

export function Badge({ label, tone = 'neutral', icon, size = 'sm', style, dot }: Props) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, size === 'md' && styles.md, { backgroundColor: t.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: t.fg }]} />}
      {icon && <Ionicons name={icon} size={size === 'md' ? 14 : 12} color={t.fg} />}
      <Text style={[styles.text, size === 'md' && styles.textMd, { color: t.fg }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  md: { paddingHorizontal: spacing.md, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
  textMd: { fontSize: font.size.sm },
});
