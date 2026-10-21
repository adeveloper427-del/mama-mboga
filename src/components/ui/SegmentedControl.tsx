import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

export interface Segment<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Scrollable underline tabs instead of a pill switch. */
  variant?: 'pill' | 'tabs';
}

export function SegmentedControl<T extends string>({ segments, value, onChange, variant = 'pill' }: Props<T>) {
  if (variant === 'tabs') {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {segments.map((s) => {
          const active = s.value === value;
          return (
            <Pressable
              key={s.value}
              onPress={() => {
                haptic.tap();
                onChange(s.value);
              }}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{s.label}</Text>
              {!!s.count && (
                <View style={[styles.count, active && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.countText, active && { color: colors.white }]}>{s.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }
  return (
    <View style={styles.pill} accessibilityRole="tablist">
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => {
              haptic.tap();
              onChange(s.value);
            }}
            style={[styles.seg, active && styles.segActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
              {s.label}
              {s.count ? ` (${s.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.md, padding: 4 },
  seg: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 2 },
  segActive: { backgroundColor: colors.card, boxShadow: '0px 1px 3px rgba(0,0,0,0.1)' },
  segText: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  segTextActive: { color: colors.text },
  tabs: { gap: spacing.xs, paddingHorizontal: spacing.lg },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 44, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.textMuted },
  tabTextActive: { color: colors.primaryDark },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: font.weight.bold, color: colors.textSecondary },
});
