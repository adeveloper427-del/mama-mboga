import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { OrderCard } from '@/components/orders';
import { EmptyState, ErrorState, Header, Screen, SegmentedControl, SkeletonList } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { orders } from '@/services';
import type { CustomerOrderScope } from '@/services/orderService';
import { useAuth } from '@/store/AuthContext';
import { colors, spacing } from '@/theme';

export default function Orders() {
  const { user } = useAuth();
  const [scope, setScope] = useState<CustomerOrderScope>('active');
  const q = useQuery(`orders:${scope}:${user?.id}`, () => orders.listMyOrders(scope), ['orders']);
  const activeCount = useQuery(`orders:active:${user?.id}`, () => orders.listMyOrders('active'), ['orders']).data?.length;

  return (
    <Screen header={<Header title="My orders" back={false} large />} scroll={false} padded={false}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <SegmentedControl
          value={scope}
          onChange={setScope}
          segments={[
            { value: 'active', label: 'Active', count: activeCount },
            { value: 'past', label: 'History' },
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
          renderItem={({ item }) => <OrderCard order={item} perspective="customer" />}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            scope === 'active' ? (
              <EmptyState icon="receipt-outline" title="No active orders" message="When you place an order, you can track it here." actionLabel="Start shopping" onAction={() => router.push('/home')} />
            ) : (
              <EmptyState icon="time-outline" title="No past orders yet" message="Completed and cancelled orders will appear here." />
            )
          }
          initialNumToRender={8}
          windowSize={7}
        />
      )}
    </Screen>
  );
}
