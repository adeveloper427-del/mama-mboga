import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Avatar, EmptyState, ErrorState, Header, Screen, SkeletonList } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { messages } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { colors, font, radius, spacing } from '@/theme';
import { timeAgo } from '@/utils/format';

export default function Conversations() {
  const { user } = useAuth();
  const q = useQuery(user ? `conversations:${user.id}` : null, messages.listConversations, ['conversations']);
  const rows = (q.data ?? []).filter((c) => c.lastMessage); // hide chats that were opened but never used

  return (
    <Screen header={<Header title="Messages" />} scroll={false} padded={false}>
      {q.loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList rows={4} height={72} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/messages/${item.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`Chat with ${item.title}${item.unread ? `, ${item.unread} unread` : ''}`}>
              <Avatar name={item.title} uri={item.avatarUrl} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.top}>
                  <AppText variant={item.unread ? 'bodyStrong' : 'title'} numberOfLines={1} style={{ flex: 1 }}>
                    {item.title}
                  </AppText>
                  <AppText variant="caption">{timeAgo(item.lastMessageAt)}</AppText>
                </View>
                <View style={styles.top}>
                  <AppText variant="small" numberOfLines={1} color={item.unread ? colors.text : colors.textMuted} style={{ flex: 1 }}>
                    {item.lastMessage}
                  </AppText>
                  {item.unread > 0 && (
                    <View style={styles.badge}>
                      <AppText variant="caption" color={colors.white} style={{ fontWeight: font.weight.bold }}>
                        {item.unread}
                      </AppText>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No messages yet"
              message={user?.role === 'seller' ? 'Customers can message you from your shop page.' : 'Ask a seller about their produce from their shop page.'}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
