import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

interface Props {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  right?: ReactNode;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  /** Renders a switch on the right. */
  toggle?: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean };
  last?: boolean;
}

export function ListItem({ title, subtitle, icon, iconColor, iconBg, right, value, onPress, danger, chevron = !!onPress, toggle, last }: Props) {
  const tint = danger ? colors.danger : (iconColor ?? colors.primaryDark);
  const content = (
    <View style={[styles.row, !last && styles.divider]}>
      {icon && (
        <View style={[styles.icon, { backgroundColor: iconBg ?? (danger ? colors.dangerLight : colors.primaryLight) }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
      )}
      <View style={styles.text}>
        <AppText variant="bodyStrong" color={danger ? colors.danger : undefined} numberOfLines={1}>
          {title}
        </AppText>
        {!!subtitle && (
          <AppText variant="small" color={colors.textMuted} numberOfLines={2}>
            {subtitle}
          </AppText>
        )}
      </View>
      {!!value && (
        <AppText variant="small" color={colors.textMuted} numberOfLines={1} style={{ maxWidth: 140 }}>
          {value}
        </AppText>
      )}
      {right}
      {toggle && (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          disabled={toggle.disabled}
          trackColor={{ true: colors.primary, false: '#CBD5CF' }}
          thumbColor={colors.white}
          accessibilityLabel={title}
        />
      )}
      {chevron && !toggle && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => pressed && { backgroundColor: colors.muted }}>
      {content}
    </Pressable>
  );
}

export function ListGroup({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      {title && (
        <AppText variant="caption" style={styles.groupTitle}>
          {title.toUpperCase()}
        </AppText>
      )}
      <View style={styles.group}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 60 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  groupTitle: { marginBottom: spacing.sm, marginLeft: spacing.xs, fontWeight: '700', letterSpacing: 0.6 },
});
