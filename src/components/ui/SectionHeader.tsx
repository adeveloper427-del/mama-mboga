import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, subtitle, actionLabel = 'See all', onAction, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1 }}>
        <AppText variant="h3" accessibilityRole="header">
          {title}
        </AppText>
        {!!subtitle && <AppText variant="small" color={colors.textMuted}>{subtitle}</AppText>}
      </View>
      {onAction && (
        <Pressable onPress={onAction} hitSlop={10} style={styles.action} accessibilityRole="button" accessibilityLabel={`${actionLabel}: ${title}`}>
          <AppText variant="label" color={colors.primary}>
            {actionLabel}
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.xxl, marginBottom: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
});
