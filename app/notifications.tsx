import { router } from 'expo-router';
import { SectionList, RefreshControl, View } from 'react-native';

import { NotificationItem } from '@/components/NotificationItem';
import { AppText, Button, EmptyState, ErrorState, Header, Screen, SkeletonList } from '@/components/ui';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { notifications } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useDialog } from '@/store/DialogContext';
import { colors, spacing } from '@/theme';
import type { AppNotification } from '@/types/models';
import { isSameDay } from '@/utils/format';

export default function Notifications() {
  const { user } = useAuth();
  const dialog = useDialog();
  const q = useQuery(user ? `notifications:${user.id}` : null, notifications.listNotifications, ['notifications']);
  const markAll = useMutation(notifications.markAllRead, { success: 'All caught up' });
  const clearAll = useMutation(notifications.clearAll, { success: 'Notifications cleared' });

  const open = (n: AppNotification) => {
    if (!n.read) notifications.markRead(n.id).catch(() => {});
    if (n.conversationId) router.push(`/messages/${n.conversationId}`);
    else if (n.type === 'order_completed' && user?.role === 'customer' && n.orderId) router.push(`/order/${n.orderId}`);
    else if (n.orderId) router.push(`/order/${n.orderId}`);
    else if (n.productId && user?.role === 'seller') router.push(`/stock/${n.productId}`);
  };

  const remove = async (n: AppNotification) => {
    if (await dialog.confirm({ title: 'Delete notification?', message: n.title, confirmLabel: 'Delete', destructive: true, icon: 'trash-outline' })) {
      notifications.deleteNotification(n.id).catch(() => {});
    }
  };

  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read).length;
  const today = new Date();
  const sections = [
    { title: 'Today', data: items.filter((n) => isSameDay(new Date(n.createdAt), today)) },
    { title: 'Earlier', data: items.filter((n) => !isSameDay(new Date(n.createdAt), today)) },
  ].filter((s) => s.data.length);

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <Header
          title="Notifications"
          subtitle={unread ? `${unread} unread` : undefined}
          right={unread ? <Button title="Mark all read" variant="ghost" size="sm" onPress={() => markAll.run()} /> : undefined}
        />
      }
    >
      {q.loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList rows={6} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NotificationItem item={item} onPress={() => open(item)} onLongPress={() => remove(item)} />}
          renderSectionHeader={({ section }) => (
            <AppText variant="caption" style={{ fontWeight: '700', letterSpacing: 0.6, paddingTop: spacing.md, paddingBottom: spacing.xs, backgroundColor: colors.background }}>
              {section.title.toUpperCase()}
            </AppText>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No notifications" message="Order updates, messages and alerts will appear here." />}
          ListFooterComponent={
            items.length ? (
              <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
                <AppText variant="caption">Long-press a notification to delete it</AppText>
                <Button
                  title="Clear all"
                  variant="ghost"
                  size="sm"
                  onPress={async () => {
                    if (await dialog.confirm({ title: 'Clear all notifications?', confirmLabel: 'Clear all', destructive: true })) clearAll.run();
                  }}
                />
              </View>
            ) : null
          }
          stickySectionHeadersEnabled
        />
      )}
    </Screen>
  );
}
