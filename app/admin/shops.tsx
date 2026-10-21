import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, ErrorState, Header, Screen, SkeletonList } from '@/components/ui';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { admin } from '@/services';
import { useDialog } from '@/store/DialogContext';
import { colors, radius, spacing } from '@/theme';
import { formatPhone } from '@/utils/format';

export default function AdminShops() {
  const dialog = useDialog();
  const q = useQuery('admin:shops', admin.listShopsAdmin, ['sellers', 'users', 'products']);
  const verify = useMutation((id: string, v: boolean) => admin.setShopVerified(id, v), { success: 'Shop updated' });
  const status = useMutation((id: string, s: 'active' | 'suspended') => admin.setUserStatus(id, s), { success: 'Account updated' });

  return (
    <Screen header={<Header title="Shops" back={false} large subtitle={q.data ? `${q.data.filter((s) => !s.verified).length} awaiting verification` : undefined} />} scroll={false} padded={false}>
      {q.loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList rows={5} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item: s }) => (
            <View style={styles.card}>
              <View style={styles.top}>
                <Avatar name={s.businessName} uri={s.logoUrl ?? s.coverUrl} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <AppText variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {s.businessName}
                    </AppText>
                    {s.verified && <Ionicons name="checkmark-circle" size={16} color={colors.info} />}
                  </View>
                  <AppText variant="caption">
                    {s.ownerName} · {formatPhone(s.phone)}
                  </AppText>
                  <AppText variant="caption">
                    {s.area} · {s.productCount} products · ⭐ {s.rating || 'New'}
                  </AppText>
                </View>
                {s.status === 'suspended' ? <Badge label="Suspended" tone="danger" /> : !s.verified ? <Badge label="Unverified" tone="warning" /> : null}
              </View>
              <View style={styles.actions}>
                <Button title="View" size="sm" variant="outline" icon="eye-outline" onPress={() => router.push(`/shop/${s.id}`)} />
                <Button
                  title={s.verified ? 'Unverify' : 'Verify'}
                  size="sm"
                  variant={s.verified ? 'outline' : 'primary'}
                  icon="shield-checkmark-outline"
                  onPress={() => verify.run(s.id, !s.verified)}
                />
                <Button
                  title={s.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                  size="sm"
                  variant={s.status === 'suspended' ? 'secondary' : 'danger'}
                  onPress={async () => {
                    const suspending = s.status !== 'suspended';
                    const ok = await dialog.confirm({
                      title: suspending ? `Suspend ${s.businessName}?` : `Reactivate ${s.businessName}?`,
                      message: suspending ? 'The seller is signed out immediately and their products are hidden from customers.' : 'The seller can sign in and sell again.',
                      confirmLabel: suspending ? 'Suspend' : 'Reactivate',
                      destructive: suspending,
                    });
                    if (ok) status.run(s.id, suspending ? 'suspended' : 'active');
                  }}
                />
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
});
