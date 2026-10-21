import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OrderStatusBadge } from '@/components/orders';
import { BarChart, StatCard } from '@/components/stats';
import { AppText, Card, ErrorState, Header, IconButton, Screen, SectionHeader, Skeleton } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { admin } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useDialog } from '@/store/DialogContext';
import { colors, radius, spacing } from '@/theme';
import type { OrderStatus } from '@/types/models';
import { formatKES, formatKESCompact } from '@/utils/format';

export default function Overview() {
  const { signOut } = useAuth();
  const dialog = useDialog();
  const q = useQuery('admin:overview', admin.getOverview, ['orders', 'users', 'sellers', 'products']);
  const d = q.data;

  return (
    <Screen
      header={
        <Header
          title="Platform overview"
          back={false}
          large
          right={
            <>
              <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
              <IconButton
                icon="log-out-outline"
                label="Log out"
                onPress={async () => {
                  if (await dialog.confirm({ title: 'Log out?', confirmLabel: 'Log out' })) signOut();
                }}
              />
            </>
          }
        />
      }
      refreshing={q.refreshing}
      onRefresh={q.refetch}
    >
      {q.error && !d ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !d ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={110} rounded={radius.lg} />
          <Skeleton height={110} rounded={radius.lg} />
          <Skeleton height={220} rounded={radius.lg} />
        </View>
      ) : (
        <>
          <Card style={styles.hero}>
            <AppText variant="small" color="rgba(255,255,255,0.8)">
              Gross order value (completed)
            </AppText>
            <AppText variant="hero" color={colors.white}>
              {formatKES(d.gmv)}
            </AppText>
            <AppText variant="small" color="rgba(255,255,255,0.8)">
              {formatKES(d.gmvToday)} today · {d.ordersToday} orders placed today
            </AppText>
          </Card>

          <View style={styles.grid}>
            <StatCard icon="people-outline" label="Customers" value={String(d.customers)} tint={colors.info} onPress={() => router.push('/admin/users')} />
            <StatCard icon="storefront-outline" label="Sellers" value={String(d.sellers)} tint={colors.primary} hint={d.unverifiedSellers ? `${d.unverifiedSellers} awaiting verification` : 'All verified'} onPress={() => router.push('/admin/shops')} />
          </View>
          <View style={styles.grid}>
            <StatCard icon="receipt-outline" label="Active orders" value={String(d.activeOrders)} tint={colors.accent} hint={`${d.totalOrders} all time`} onPress={() => router.push('/admin/orders')} />
            <StatCard icon="leaf-outline" label="Products listed" value={String(d.products)} tint={colors.purple} hint={d.suspendedUsers ? `${d.suspendedUsers} suspended users` : undefined} />
          </View>

          <SectionHeader title="Completed sales this week" />
          <Card>
            <BarChart data={d.week} />
          </Card>

          <SectionHeader title="Orders by status" />
          <Card padded={false}>
            {(Object.entries(d.byStatus) as [OrderStatus, number][]).map(([s, n], i) => (
              <View key={s} style={[styles.row, i > 0 && styles.divider]}>
                <OrderStatusBadge status={s} />
                <AppText variant="bodyStrong">{n}</AppText>
              </View>
            ))}
          </Card>

          <SectionHeader title="Top shops" subtitle="By completed sales" />
          <Card padded={false}>
            {d.topShops.map((s, i) => (
              <View key={s.id} style={[styles.row, i > 0 && styles.divider]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="title" numberOfLines={1}>
                    {i + 1}. {s.name}
                  </AppText>
                  <AppText variant="caption">
                    {s.area} · {s.orders} orders
                  </AppText>
                </View>
                <AppText variant="bodyStrong">{formatKESCompact(s.revenue)}</AppText>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primaryDark, gap: 2 },
  grid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, paddingHorizontal: spacing.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
