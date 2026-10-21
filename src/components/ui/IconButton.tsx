import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, font, TOUCH } from '@/theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  label: string; // for screen readers
  variant?: 'plain' | 'soft' | 'filled' | 'glass';
  color?: string;
  size?: number;
  badge?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function IconButton({ icon, onPress, label, variant = 'plain', color, size = 22, badge, style, disabled }: Props) {
  const bg =
    variant === 'soft' ? colors.muted : variant === 'filled' ? colors.primary : variant === 'glass' ? 'rgba(255,255,255,0.92)' : 'transparent';
  const fg = color ?? (variant === 'filled' ? colors.white : colors.text);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: pressed ? 0.6 : disabled ? 0.4 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={fg} />
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.tomato,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: font.weight.bold },
});
