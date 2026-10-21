import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, icon, count, disabled }: Props) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.4 },
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={selected ? colors.white : colors.textSecondary} />}
      <Text style={[styles.text, selected && styles.textSelected]} maxFontSizeMultiplier={1.25}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.count, selected && styles.countSelected]}>
          <Text style={[styles.countText, selected && { color: colors.primary }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textSecondary },
  textSelected: { color: colors.white },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  countSelected: { backgroundColor: colors.white },
  countText: { fontSize: 11, fontWeight: font.weight.bold, color: colors.textSecondary },
});
