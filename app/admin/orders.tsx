import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';

import { OrderCard } from '@/components/orders';
import { Chip, EmptyState, ErrorState, Header, Screen, SkeletonList } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { admin } from '@/services';
import { colors, spacing } from '@/theme';
import type { OrderStatus } from '@/types/models';

const FILTERS: { value: OrderStatus | 'active' | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminOrders() {
  const [filter, setFilter] = useState<OrderStatus | 'active' | 'all'>('active');
  const q = useQuery(`admin:orders:${filter}`, () => admin.listAllOrders(filter === 'all' ? undefined : filter), ['orders']);

  return (
    <Screen header={<Header title="All orders" back={false} large />} scroll={false} padded={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }} style={{ flexGrow: 0 }}>
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </ScrollView>
      {q.loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList rows={5} height={110} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OrderCard order={item} perspective="admin" />}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No orders" message="No orders match this filter." />}
          initialNumToRender={8}
          windowSize={7}
        />
      )}
    </Screen>
  );
}
