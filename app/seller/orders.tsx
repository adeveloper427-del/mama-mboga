import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { OrderCard } from '@/components/orders';
import { EmptyState, ErrorState, Header, Screen, SegmentedControl, SkeletonList } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { orders } from '@/services';
import type { SellerOrderFilter } from '@/services/orderService';
import { useAuth } from '@/store/AuthContext';
import { colors, spacing } from '@/theme';

const EMPTY: Record<SellerOrderFilter, { icon: 'receipt-outline' | 'basket-outline' | 'checkmark-done-outline' | 'ban-outline'; title: string; message: string }> = {
  new: { icon: 'receipt-outline', title: 'No new orders', message: "New orders appear here instantly — you'll also get a notification." },
  active: { icon: 'basket-outline', title: 'Nothing in progress', message: 'Orders you accept move here while you prepare and deliver them.' },
  completed: { icon: 'checkmark-done-outline', title: 'No completed orders yet', message: 'Completed orders count towards your sales.' },
  cancelled: { icon: 'ban-outline', title: 'No cancelled orders', message: 'Declined and cancelled orders are kept here for your records.' },
};

export default function SellerOrders() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<SellerOrderFilter>('new');
  const counts = useQuery(user ? `seller-counts:${user.id}` : null, orders.sellerOrderCounts, ['orders']);
  const q = useQuery(user ? `seller-orders:${filter}:${user.id}` : null, () => orders.listSellerOrders(filter), ['orders']);
  const empty = EMPTY[filter];

  return (
    <Screen header={<Header title="Orders" back={false} large />} scroll={false} padded={false}>
      <View style={{ paddingBottom: spacing.sm }}>
        <SegmentedControl
          variant="tabs"
          value={filter}
          onChange={setFilter}
          segments={[
            { value: 'new', label: 'New', count: counts.data?.new },
            { value: 'active', label: 'In progress', count: counts.data?.active },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </View>
      {q.loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList rows={4} height={110} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OrderCard order={item} perspective="seller" />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon={empty.icon} title={empty.title} message={empty.message} />}
          initialNumToRender={8}
          windowSize={7}
        />
      )}
    </Screen>
  );
}
