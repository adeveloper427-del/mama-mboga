import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import type { AppNotification, NotificationType } from '@/types/models';
import { timeAgo } from '@/utils/format';

import { AppText } from './ui';

const ICONS: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  order_new: { icon: 'receipt-outline', color: colors.accent },
  order_accepted: { icon: 'thumbs-up-outline', color: colors.info },
  order_rejected: { icon: 'close-circle-outline', color: colors.danger },
  order_status: { icon: 'bicycle-outline', color: colors.purple },
  order_completed: { icon: 'checkmark-done-outline', color: colors.success },
  order_cancelled: { icon: 'ban-outline', color: colors.danger },
  low_stock: { icon: 'alert-circle-outline', color: colors.warning },
  out_of_stock: { icon: 'cube-outline', color: colors.danger },
  message: { icon: 'chatbubble-ellipses-outline', color: colors.primary },
  review: { icon: 'star-outline', color: '#F5A524' },
  system: { icon: 'megaphone-outline', color: colors.primaryDark },
};

interface Props {
  item: AppNotification;
  onPress: () => void;
  onLongPress?: () => void;
}

export const NotificationItem = memo(function NotificationItem({ item, onPress, onLongPress }: Props) {
  const s = ICONS[item.type];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, !item.read && styles.unread, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.body}`}
      accessibilityHint="Long press to delete"
    >
      <View style={[styles.icon, { backgroundColor: `${s.color}1A` }]}>
        <Ionicons name={s.icon} size={22} color={s.color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant={item.read ? 'title' : 'bodyStrong'} numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText variant="small" numberOfLines={2}>
          {item.body}
        </AppText>
        <AppText variant="caption" style={{ marginTop: 2 }}>
          {timeAgo(item.createdAt)}
        </AppText>
      </View>
      {!item.read && <View style={styles.dot} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, alignItems: 'flex-start' },
  unread: { backgroundColor: '#F2FAF5' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
});
