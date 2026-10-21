import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { StockAdjustSheet } from '@/components/StockAdjustSheet';
import { StockBadge } from '@/components/StockBadge';
import { AppText, EmptyState, ErrorState, Header, IconButton, Screen, SegmentedControl, SkeletonList, SmartImage } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { inventory } from '@/services';
import type { AdjustMode } from '@/services/inventoryService';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, shadow, spacing } from '@/theme';
import type { ProductView, StockState } from '@/types/models';
import { formatKESCompact, unitLabel } from '@/utils/format';

type Filter = 'all' | 'low' | 'out' | 'paused';

const MATCH: Record<Filter, (s: StockState) => boolean> = {
  all: () => true,
  low: (s) => s === 'low_stock',
  out: (s) => s === 'out_of_stock',
  paused: (s) => s === 'unavailable',
};

export default function Inventory() {
  const { user } = useAuth();
  const q = useQuery(user ? `inventory:${user.id}` : null, inventory.getInventory, ['products']);
  const [filter, setFilter] = useState<Filter>('all');
  const [adjust, setAdjust] = useState<{ product: ProductView; mode: AdjustMode } | null>(null);

  const d = q.data;
  const rows = (d?.products ?? []).filter((p) => MATCH[filter](p.stockState));

  return (
    <Screen header={<Header title="Stock" back={false} large subtitle="Tap a product to see its history" />} scroll={false} padded={false}>
      {d && (
        <View style={styles.summary}>
          <Summary label="Products" value={String(d.totalProducts)} color={colors.text} />
          <Summary label="Low" value={String(d.lowStock)} color={colors.warning} />
          <Summary label="Out" value={String(d.outOfStock)} color={colors.danger} />
          <Summary label="Stock value" value={formatKESCompact(d.stockValue)} color={colors.primaryDark} />
        </View>
      )}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          segments={[
            { value: 'all', label: 'All' },
            { value: 'low', label: 'Low', count: d?.lowStock },
            { value: 'out', label: 'Out', count: d?.outOfStock },
            { value: 'paused', label: 'Hidden', count: d?.unavailable },
          ]}
        />
      </View>
      {q.loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList rows={6} height={80} />
        </View>
      ) : q.error && !d ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => {
            const pct = Math.min(1, item.stock / Math.max(1, item.lowStockThreshold * 3));
            const barColor = item.stockState === 'out_of_stock' ? colors.danger : item.stockState === 'low_stock' ? colors.warning : colors.primary;
            return (
              <Pressable onPress={() => router.push(`/stock/${item.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.stock} ${unitLabel(item.unit, item.stock)} in stock`}>
                <SmartImage src={item.imageUrl} style={styles.img} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="title" numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <AppText variant="h3" color={barColor}>
                      {item.stock}
                    </AppText>
                    <AppText variant="caption">
                      {unitLabel(item.unit, item.stock)} · alert at {item.lowStockThreshold}
                    </AppText>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
                  </View>
                  <StockBadge state={item.stockState} hideInStock />
                </View>
                <View style={{ gap: spacing.xs }}>
                  <IconButton icon="add" label={`Add stock for ${item.name}`} variant="filled" size={20} onPress={() => setAdjust({ product: item, mode: 'add' })} />
                  <IconButton icon="remove" label={`Remove stock for ${item.name}`} variant="soft" size={20} disabled={item.stock === 0} onPress={() => setAdjust({ product: item, mode: 'remove' })} />
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            d?.totalProducts ? (
              <EmptyState icon="checkmark-circle-outline" title={filter === 'low' ? 'Nothing running low' : filter === 'out' ? 'Nothing sold out' : 'No hidden products'} message="Nice — your stock is in good shape." />
            ) : (
              <EmptyState icon="cube-outline" title="No products yet" message="Add products to start tracking your stock." actionLabel="Add product" onAction={() => router.push('/product-form')} />
            )
          }
        />
      )}
      <StockAdjustSheet product={adjust?.product ?? null} initialMode={adjust?.mode} onClose={() => setAdjust(null)} />
    </Screen>
  );
}

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.sumItem}>
      <AppText variant="h3" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: spacing.md, ...shadow.sm },
  sumItem: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg },
  img: { width: 64, height: 64, borderRadius: radius.md },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden', maxWidth: 160 },
  fill: { height: '100%', borderRadius: 3 },
});
