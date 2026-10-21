import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, font } from '@/theme';

export type TextVariant = 'hero' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label' | 'price';

interface Props extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/** Every piece of text in the app goes through this, so the type scale stays consistent. */
export function AppText({ variant = 'body', color, align, style, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      style={[styles[variant], color ? { color } : null, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: font.size.hero, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -0.5, lineHeight: 36 },
  h1: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.text, letterSpacing: -0.3, lineHeight: 30 },
  h2: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, lineHeight: 26 },
  h3: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text, lineHeight: 23 },
  title: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text, lineHeight: 20 },
  body: { fontSize: font.size.md, color: colors.textSecondary, lineHeight: 22 },
  bodyStrong: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text, lineHeight: 22 },
  small: { fontSize: font.size.sm, color: colors.textSecondary, lineHeight: 18 },
  caption: { fontSize: font.size.xs, color: colors.textMuted, lineHeight: 15 },
  label: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.text },
  price: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.primaryDark },
});
