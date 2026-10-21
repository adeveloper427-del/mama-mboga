import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { SeriesPoint } from '@/services/statsService';
import { colors, radius, shadow, spacing } from '@/theme';
import { formatKES, formatKESCompact } from '@/utils/format';

import { AppText } from './ui';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint?: string;
  hint?: string;
  onPress?: () => void;
}

export function StatCard({ icon, label, value, tint = colors.primary, hint, onPress }: StatCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.85 }]}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
    >
      <View style={[styles.statIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <AppText variant="h2" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: spacing.sm }}>
        {value}
      </AppText>
      <AppText variant="small" numberOfLines={1}>
        {label}
      </AppText>
      {!!hint && (
        <AppText variant="caption" numberOfLines={1}>
          {hint}
        </AppText>
      )}
    </Pressable>
  );
}

/**
 * Single-series bar chart (sales per day). One hue, thin rounded bars anchored
 * to the baseline, recessive gridlines; tap a bar to read its exact value.
 * Values are always shown in text colours, never in the bar colour.
 */
export function BarChart({ data, height = 150, emptyLabel = 'No sales in this period yet' }: { data: SeriesPoint[]; height?: number; emptyLabel?: string }) {
  const [selected, setSelected] = useState(data.length - 1);
  const max = Math.max(...data.map((d) => d.value), 0);
  const sel = data[Math.min(selected, data.length - 1)];
  const dense = data.length > 14;

  if (max === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Ionicons name="bar-chart-outline" size={28} color={colors.textMuted} />
        <AppText variant="small" color={colors.textMuted}>
          {emptyLabel}
        </AppText>
      </View>
    );
  }

  return (
    <View accessibilityLabel={`Sales chart. ${data.map((d) => `${d.label}: ${formatKES(d.value)}`).join('; ')}`}>
      <View style={styles.readout}>
        <AppText variant="caption">
          {new Date(sel.date).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'short' })}
        </AppText>
        <AppText variant="bodyStrong">{formatKES(sel.value)}</AppText>
      </View>
      <View style={{ height }}>
        {/* Recessive gridlines at 0 / 50 / 100% */}
        {[0, 0.5, 1].map((g) => (
          <View key={g} style={[styles.grid, { bottom: g * (height - 4) }]}>
            <AppText variant="caption" style={styles.gridLabel}>
              {g === 0 ? '' : formatKESCompact(max * g)}
            </AppText>
          </View>
        ))}
        <View style={styles.bars}>
          {data.map((d, i) => {
            const h = Math.max(d.value > 0 ? 4 : 0, (d.value / max) * (height - 4));
            const active = i === selected;
            return (
              <Pressable
                key={d.date}
                onPress={() => setSelected(i)}
                style={styles.barHit}
                accessibilityRole="button"
                accessibilityLabel={`${d.label}: ${formatKES(d.value)}`}
              >
                <View
                  style={[
                    styles.bar,
                    { height: h, backgroundColor: active ? colors.primary : '#9FD3B4', maxWidth: dense ? 10 : 26 },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.labels}>
        {data.map((d, i) => (
          <AppText
            key={d.date}
            variant="caption"
            align="center"
            numberOfLines={1}
            style={[styles.xLabel, i === selected && { color: colors.text, fontWeight: '700' }]}
          >
            {dense && i % 5 !== 0 && i !== data.length - 1 ? '' : d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/** Horizontal share bar, e.g. delivery vs pickup. */
export function ShareBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <View>
      <View style={styles.share}>
        {parts.map((p) => (p.value > 0 ? <View key={p.label} style={{ flex: p.value, backgroundColor: p.color }} /> : null))}
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <AppText variant="small" color={colors.text}>
              {p.label}
            </AppText>
            <AppText variant="small">{Math.round((p.value / total) * 100)}%</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm, minWidth: 140 },
  statIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  readout: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md },
  grid: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  gridLabel: { position: 'absolute', right: 0, top: 2, fontSize: 10 },
  bars: { ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barHit: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  labels: { flexDirection: 'row', gap: 2, marginTop: spacing.xs },
  xLabel: { flex: 1, fontSize: 10 },
  share: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, backgroundColor: colors.card },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
