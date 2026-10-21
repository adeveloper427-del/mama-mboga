import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Show a bin icon instead of "−" at the minimum (removes the item). */
  removable?: boolean;
}

const SIZES = { sm: { h: 32, w: 32, fs: font.size.md }, md: { h: 40, w: 40, fs: font.size.lg }, lg: { h: 48, w: 48, fs: font.size.xl } };

export function QuantityStepper({ value, onChange, min = 1, max = 999, size = 'md', removable }: Props) {
  const s = SIZES[size];
  const atMin = value <= min;
  const atMax = value >= max;
  const showBin = removable && value <= 1;

  const press = (next: number) => {
    haptic.tap();
    onChange(next);
  };

  return (
    <View style={[styles.wrap, { height: s.h }]} accessibilityRole="adjustable" accessibilityValue={{ min, max, now: value }}>
      <Pressable
        onPress={() => press(value - 1)}
        disabled={atMin && !showBin}
        style={[styles.btn, { width: s.w, height: s.h }, atMin && !showBin && styles.disabled]}
        accessibilityLabel={showBin ? 'Remove item' : 'Decrease quantity'}
        hitSlop={4}
      >
        <Ionicons name={showBin ? 'trash-outline' : 'remove'} size={s.fs + 2} color={showBin ? colors.danger : colors.primaryDark} />
      </Pressable>
      <Text style={[styles.value, { fontSize: s.fs }]} maxFontSizeMultiplier={1.2}>
        {value}
      </Text>
      <Pressable
        onPress={() => press(value + 1)}
        disabled={atMax}
        style={[styles.btn, styles.plus, { width: s.w, height: s.h }, atMax && styles.disabled]}
        accessibilityLabel="Increase quantity"
        hitSlop={4}
      >
        <Ionicons name="add" size={s.fs + 2} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.md, overflow: 'hidden' },
  btn: { alignItems: 'center', justifyContent: 'center' },
  plus: { backgroundColor: colors.primary, borderRadius: radius.md },
  disabled: { opacity: 0.35 },
  value: { minWidth: 34, textAlign: 'center', fontWeight: font.weight.bold, color: colors.primaryDark },
});
