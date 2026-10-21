import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { OrderCard } from '@/components/orders';
import { BarChart, StatCard } from '@/components/stats';
import { AppText, Badge, Button, Card, ErrorState, IconButton, Screen, SectionHeader, Skeleton, SmartImage } from '@/components/ui';
import { useBadges } from '@/hooks/useBadges';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { orders, shop, stats } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { firstName, formatKES, formatKESCompact, formatQty, greeting, unitLabel } from '@/utils/format';

export default function Dashboard() {
  const { user } = useAuth();
  const badges = useBadges();
  const d = useQuery(user ? `dashboard:${user.id}` : null, stats.getSellerDashboard, ['orders', 'products', 'sellers', 'reviews']);
  const myShop = useQuery(user ? `my-shop:${user.id}` : null, shop.getMyShop, ['sellers']);
  const newOrders = useQuery(user ? `seller-orders:new:${user.id}` : null, () => orders.listSellerOrders('new'), ['orders']);
  const toggle = useMutation(
    async (v: boolean) => {
      await shop.setAcceptingOrders(v);
      return v;
    },
    { success: (v) => (v ? 'You are now accepting orders' : 'New orders paused') },
  );

  const data = d.data;
  const s = myShop.data;
  const pending = newOrders.data ?? [];

  return (
    <Screen padded={false} refreshing={d.refreshing} onRefresh={() => { d.refetch(); myShop.refetch(); }}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <AppText variant="small" color={colors.textMuted}>
            {greeting()}, {user ? firstName(user.fullName) : ''} 👋
          </AppText>
          <AppText variant="h2" numberOfLines={1}>
            {s?.businessName ?? 'My shop'}
          </AppText>
        </View>
        <IconButton icon="chatbubble-ellipses-outline" label="Messages" variant="soft" badge={badges.messages} onPress={() => router.push('/messages')} />
        <IconButton icon="notifications-outline" label="Notifications" variant="soft" badge={badges.notifications} onPress={() => router.push('/notifications')} style={{ marginLeft: spacing.sm }} />
      </View>

      <View style={styles.pad}>
        {/* Accepting orders */}
        {s && (
          <Card style={[styles.openCard, { backgroundColor: s.acceptingOrders ? colors.primaryDark : '#374151' }]}>
            <View style={[styles.openDot, { backgroundColor: s.acceptingOrders ? '#4ADE80' : '#9CA3AF' }]} />
            <View style={{ flex: 1 }}>
              <AppText variant="title" color={colors.white}>
                {s.acceptingOrders ? 'Accepting orders' : 'Orders paused'}
              </AppText>
              <AppText variant="small" color="rgba(255,255,255,0.8)">
                {s.acceptingOrders ? (s.isOpenNow ? 'Your shop is open and visible' : 'Outside opening hours — orders still come in') : 'Customers cannot place new orders'}
              </AppText>
            </View>
            <Switch
              value={s.acceptingOrders}
              onValueChange={(v) => {
                toggle.run(v);
              }}
              disabled={toggle.busy}
              trackColor={{ true: '#4ADE80', false: '#6B7280' }}
              thumbColor={colors.white}
              accessibilityLabel="Accepting orders"
            />
          </Card>
        )}

        {d.error && !data ? (
          <ErrorState error={d.error} onRetry={d.refetch} compact />
        ) : !data ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={118} rounded={radius.lg} style={{ width: '48%' }} />
            ))}
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              <StatCard icon="cash-outline" label="Today's sales" value={formatKESCompact(data.todaySales)} tint={colors.primary} onPress={() => router.push('/sales')} />
              <StatCard icon="receipt-outline" label="Orders today" value={String(data.todayOrders)} tint={colors.info} onPress={() => router.push('/seller/orders')} />
            </View>
            <View style={styles.grid}>
              <StatCard icon="time-outline" label="Pending orders" value={String(data.pendingOrders)} tint={colors.accent} hint={data.activeOrders ? `${data.activeOrders} in progress` : undefined} onPress={() => router.push('/seller/orders')} />
              <StatCard icon="alert-circle-outline" label="Low stock" value={String(data.lowStock.length)} tint={data.lowStock.length ? colors.danger : colors.success} onPress={() => router.push('/seller/inventory')} />
            </View>

            {/* Orders waiting for action */}
            {pending.length > 0 && (
              <>
                <SectionHeader title="Needs your action" subtitle={`${data.pendingOrders} new order${data.pendingOrders > 1 ? 's' : ''} waiting`} onAction={() => router.push('/seller/orders')} />
                <View style={{ gap: spacing.md }}>
                  {pending.slice(0, 3).map((o) => (
                    <OrderCard key={o.id} order={o} perspective="seller" />
                  ))}
                </View>
              </>
            )}

            {/* Weekly chart */}
            <SectionHeader title="This week" onAction={() => router.push('/sales')} actionLabel="Sales report" />
            <Card>
              <View style={styles.weekHead}>
                <View>
                  <AppText variant="caption">Last 7 days</AppText>
                  <AppText variant="h1">{formatKES(data.weekSales)}</AppText>
                </View>
                {data.weekChangePct !== null && (
                  <Badge
                    label={`${data.weekChangePct >= 0 ? '+' : ''}${data.weekChangePct}% vs last week`}
                    tone={data.weekChangePct >= 0 ? 'success' : 'danger'}
                    icon={data.weekChangePct >= 0 ? 'trending-up' : 'trending-down'}
                  />
                )}
              </View>
              <View style={{ marginTop: spacing.lg }}>
                <BarChart data={data.week} />
              </View>
            </Card>

            {/* Low stock */}
            {data.lowStock.length > 0 && (
              <>
                <SectionHeader title="Running low" onAction={() => router.push('/seller/inventory')} />
                <Card padded={false}>
                  {data.lowStock.slice(0, 4).map((p, i) => (
                    <View key={p.id} style={[styles.lowRow, i > 0 && styles.divider]}>
                      <SmartImage src={p.imageUrl} style={styles.thumb} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="title" numberOfLines={1}>
                          {p.name}
                        </AppText>
                        <AppText variant="caption" color={p.stock === 0 ? colors.danger : colors.warning} style={{ fontWeight: '600' }}>
                          {p.stock === 0 ? 'Out of stock' : `${formatQty(p.stock, p.unit)} left`}
                        </AppText>
                      </View>
                      <Button title="Restock" size="sm" variant="secondary" icon="add" onPress={() => router.push(`/stock/${p.id}`)} />
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* Best sellers */}
            <SectionHeader title="Best sellers" subtitle="Last 30 days" />
            <Card padded={false}>
              {data.bestSellers.length ? (
                data.bestSellers.map((b, i) => (
                  <View key={b.productId} style={[styles.lowRow, i > 0 && styles.divider]}>
                    <View style={[styles.rank, i === 0 && { backgroundColor: colors.accent }]}>
                      <AppText variant="label" color={i === 0 ? colors.white : colors.textSecondary}>
                        {i + 1}
                      </AppText>
                    </View>
                    <SmartImage src={b.imageUrl} style={styles.thumb} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="title" numberOfLines={1}>
                        {b.name}
                      </AppText>
                      <AppText variant="caption">
                        {b.quantity} {unitLabel(b.unit as never, b.quantity)} sold
                      </AppText>
                    </View>
                    <AppText variant="bodyStrong">{formatKESCompact(b.revenue)}</AppText>
                  </View>
                ))
              ) : (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <Ionicons name="trophy-outline" size={28} color={colors.textMuted} />
                  <AppText variant="small" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                    Complete orders to see your best sellers
                  </AppText>
                </View>
              )}
            </Card>

            {/* Totals */}
            <View style={[styles.grid, { marginTop: spacing.xl }]}>
              <StatCard icon="wallet-outline" label="Total sales" value={formatKESCompact(data.totalSales)} tint={colors.primaryDark} />
              <StatCard icon="checkmark-done-outline" label="Completed orders" value={String(data.completedOrders)} tint={colors.success} />
            </View>
            <View style={styles.grid}>
              <StatCard
                icon="star-outline"
                label="Shop rating"
                value={data.rating ? data.rating.toFixed(1) : '—'}
                tint="#F5A524"
                hint={`${data.ratingCount} reviews`}
                onPress={() => router.push('/reviews')}
              />
              <StatCard icon="add-circle-outline" label="Add a product" value="New" tint={colors.purple} onPress={() => router.push('/product-form')} />
            </View>

            {/* Recent orders */}
            {data.recentOrders.length > 0 && (
              <>
                <SectionHeader title="Recent orders" onAction={() => router.push('/seller/orders')} />
                <View style={{ gap: spacing.md }}>
                  {data.recentOrders.filter((o) => o.status !== 'pending').slice(0, 3).map((o) => (
                    <OrderCard key={o.id} order={o} perspective="seller" />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  pad: { paddingHorizontal: spacing.lg },
  openCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  openDot: { width: 12, height: 12, borderRadius: 6 },
  grid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, justifyContent: 'space-between' },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' },
  lowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  thumb: { width: 44, height: 44, borderRadius: radius.md },
  rank: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
});
