import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { location } from '@/services';
import { colors, radius, spacing } from '@/theme';

import { AppText, BottomSheet, TextField } from './ui';

interface Props {
  visible: boolean;
  value?: string;
  onSelect: (area: string) => void;
  onClose: () => void;
  title?: string;
}

/** Choose a service area. Replaces GPS until maps are integrated — no location permission needed. */
export function AreaPicker({ visible, value, onSelect, onClose, title = 'Choose your area' }: Props) {
  const [q, setQ] = useState('');
  const areas = useMemo(() => location.getServiceAreas().filter((a) => a.toLowerCase().includes(q.trim().toLowerCase())), [q]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle="We'll show mama mbogas near you">
      <TextField placeholder="Search estates…" icon="search" value={q} onChangeText={setQ} autoCorrect={false} />
      {areas.map((a) => {
        const active = a === value;
        return (
          <Pressable
            key={a}
            onPress={() => {
              onSelect(a);
              setQ('');
              onClose();
            }}
            style={({ pressed }) => [styles.row, active && styles.active, pressed && { backgroundColor: colors.muted }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Ionicons name="location-outline" size={20} color={active ? colors.primary : colors.textMuted} />
            <AppText variant={active ? 'bodyStrong' : 'body'} color={active ? colors.primaryDark : colors.text} style={{ flex: 1 }}>
              {a}
            </AppText>
            {active && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
          </Pressable>
        );
      })}
      {!areas.length && (
        <View style={{ padding: spacing.xl }}>
          <AppText variant="body" align="center" color={colors.textMuted}>
            We don't serve that area yet.
          </AppText>
        </View>
      )}
    </BottomSheet>
  );
}

/** A form field that opens the AreaPicker. */
export function AreaField({ value, onChange, error, label = 'Area / estate' }: { value: string; onChange: (a: string) => void; error?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <AppText variant="label" style={{ marginBottom: spacing.sm }}>
        {label}
      </AppText>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, error ? { borderColor: colors.danger } : null]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'not chosen'}`}
      >
        <Ionicons name="location-outline" size={20} color={colors.textMuted} />
        <AppText variant="body" color={value ? colors.text : colors.textMuted} style={{ flex: 1 }}>
          {value || 'Choose area'}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {!!error && (
        <AppText variant="small" color={colors.danger} style={{ marginTop: 6 }}>
          {error}
        </AppText>
      )}
      <AreaPicker visible={open} value={value} onSelect={onChange} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, minHeight: 50 },
  active: { backgroundColor: colors.primaryLight },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
});
