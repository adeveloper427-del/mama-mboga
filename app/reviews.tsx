import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Card, EmptyState, ErrorState, Header, RatingStars, Screen, SkeletonList } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { reviews } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { colors, spacing } from '@/theme';
import { timeAgo } from '@/utils/format';

export default function MyReviews() {
  const { user } = useAuth();
  const q = useQuery(user ? `my-reviews:${user.id}` : null, reviews.listMyShopReviews, ['reviews']);
  const list = q.data ?? [];
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: list.filter((r) => r.rating === n).length }));

  return (
    <Screen header={<Header title="Customer reviews" />} refreshing={q.refreshing} onRefresh={q.refetch}>
      {q.loading ? (
        <SkeletonList rows={4} />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !list.length ? (
        <EmptyState icon="star-outline" title="No reviews yet" message="Customers can rate your shop after an order is completed." />
      ) : (
        <>
          <Card style={styles.summary}>
            <View style={{ alignItems: 'center', minWidth: 96 }}>
              <AppText variant="hero">{avg.toFixed(1)}</AppText>
              <RatingStars value={avg} size={14} />
              <AppText variant="caption" style={{ marginTop: 4 }}>
                {list.length} reviews
              </AppText>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              {dist.map((d) => (
                <View key={d.n} style={styles.distRow}>
                  <AppText variant="caption" style={{ width: 12 }}>
                    {d.n}
                  </AppText>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${(d.count / list.length) * 100}%` }]} />
                  </View>
                  <AppText variant="caption" style={{ width: 24, textAlign: 'right' }}>
                    {d.count}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
          {list.map((r) => (
            <Card key={r.id} style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Avatar name={r.customerName} size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="title">{r.customerName}</AppText>
                  <AppText variant="caption">{timeAgo(r.createdAt)}</AppText>
                </View>
                <RatingStars value={r.rating} size={14} />
              </View>
              {!!r.comment && (
                <AppText variant="body" style={{ marginTop: spacing.md }}>
                  {r.comment}
                </AppText>
              )}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#F5A524', borderRadius: 4 },
});
