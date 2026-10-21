import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart, ShareBar, StatCard } from '@/components/stats';
import { AppText, Card, EmptyState, ErrorState, Header, Screen, SectionHeader, SegmentedControl, Skeleton, SmartImage } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { stats } from '@/services';
import type { ReportPeriod } from '@/services/statsService';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { formatKES, formatKESCompact, unitLabel } from '@/utils/format';

export default function SalesReport() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<ReportPeriod>(7);
  const q = useQuery(user ? `sales:${period}:${user.id}` : null, () => stats.getSalesReport(period), ['orders']);
  const r = q.data;
  const topMax = Math.max(1, ...(r?.topProducts.map((p) => p.revenue) ?? [1]));

  return (
    <Screen header={<Header title="Sales report" />} refreshing={q.refreshing} onRefresh={q.refetch}>
      <SegmentedControl
        value={String(period) as '7' | '30' | '90'}
        onChange={(p) => setPeriod(Number(p) as ReportPeriod)}
        segments={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
        ]}
      />

      {q.error && !r ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !r ? (
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Skeleton height={120} rounded={radius.lg} />
          <Skeleton height={220} rounded={radius.lg} />
        </View>
      ) : (
        <>
          <Card style={[styles.hero, { marginTop: spacing.lg }]}>
            <AppText variant="small" color="rgba(255,255,255,0.8)">
              Revenue · last {period} days
            </AppText>
            <AppText variant="hero" color={colors.white}>
              {formatKES(r.revenue)}
            </AppText>
            <AppText variant="small" color="rgba(255,255,255,0.8)">
              Includes {formatKES(r.deliveryFees)} in delivery fees
            </AppText>
          </Card>

          <View style={styles.grid}>
            <StatCard icon="checkmark-done-outline" label="Completed orders" value={String(r.completedOrders)} tint={colors.success} />
            <StatCard icon="calculator-outline" label="Average order" value={formatKESCompact(r.averageOrderValue)} tint={colors.info} />
          </View>
          <View style={styles.grid}>
            <StatCard icon="pie-chart-outline" label="Completion rate" value={`${r.completionRate}%`} tint={colors.purple} hint={`${r.cancelledOrders} declined/cancelled`} />
            <StatCard icon="people-outline" label="Customers" value={String(r.uniqueCustomers)} tint={colors.accent} hint={`${r.repeatCustomers} came back`} />
          </View>

          <SectionHeader title={period === 90 ? 'Revenue per week' : 'Revenue per day'} subtitle="Tap a bar for details" />
          <Card>
            <BarChart key={period} data={r.series} height={170} />
          </Card>

          <SectionHeader title="How customers get their orders" />
          <Card>
            {r.completedOrders ? (
              <ShareBar
                parts={[
                  { label: 'Delivery', value: r.deliveryShare.delivery, color: colors.primary },
                  { label: 'Pickup', value: r.deliveryShare.pickup, color: colors.accent },
                ]}
              />
            ) : (
              <AppText variant="small" color={colors.textMuted}>No completed orders in this period.</AppText>
            )}
          </Card>

          <SectionHeader title="Top products" subtitle="By revenue" />
          <Card padded={false}>
            {r.topProducts.length ? (
              r.topProducts.map((p, i) => (
                <View key={p.productId} style={[styles.row, i > 0 && styles.divider]}>
                  <SmartImage src={p.imageUrl} style={styles.thumb} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                      <AppText variant="title" numberOfLines={1} style={{ flex: 1 }}>
                        {p.name}
                      </AppText>
                      <AppText variant="bodyStrong">{formatKESCompact(p.revenue)}</AppText>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${(p.revenue / topMax) * 100}%` }]} />
                    </View>
                    <AppText variant="caption">
                      {p.quantity} {unitLabel(p.unit as never, p.quantity)} sold
                    </AppText>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState compact icon="trophy-outline" title="No sales yet" message="Complete orders to see your top products." />
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primaryDark, gap: 2 },
  grid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  thumb: { width: 44, height: 44, borderRadius: radius.md },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
});
