import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { StockAdjustSheet } from '@/components/StockAdjustSheet';
import { StockBadge } from '@/components/StockBadge';
import { AppText, Button, Card, EmptyState, ErrorState, Header, IconButton, LoadingView, Screen, SmartImage } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { inventory, products } from '@/services';
import type { AdjustMode } from '@/services/inventoryService';
import { colors, radius, spacing } from '@/theme';
import type { InventoryReason } from '@/types/models';
import { formatDateTime, formatKES, formatQty, unitLabel } from '@/utils/format';

const REASON: Record<InventoryReason, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  initial: { label: 'Opening stock', icon: 'flag-outline' },
  restock: { label: 'Restocked', icon: 'arrow-down-circle-outline' },
  adjustment: { label: 'Count correction', icon: 'create-outline' },
  spoilage: { label: 'Spoilt / removed', icon: 'trash-outline' },
  order_reserved: { label: 'Order', icon: 'receipt-outline' },
  order_released: { label: 'Order cancelled', icon: 'return-up-back-outline' },
};

export default function StockHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useQuery(`my-product:${id}`, () => products.getMyProduct(id), ['products']);
  const h = useQuery(`stock-history:${id}`, () => inventory.getStockHistory(id), ['stockMovements']);
  const [mode, setMode] = useState<AdjustMode | null>(null);

  if (p.loading) return <Screen header={<Header title="Stock" />} scroll={false}><LoadingView /></Screen>;
  const product = p.data;
  if (!product) return <Screen header={<Header title="Stock" />} scroll={false}><ErrorState error={p.error} onRetry={p.refetch} /></Screen>;

  return (
    <Screen
      header={<Header title="Stock history" right={<IconButton icon="create-outline" label="Edit product" onPress={() => router.push({ pathname: '/product-form', params: { id } })} />} />}
      scroll={false}
      padded={false}
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Remove" icon="remove" variant="outline" style={{ flex: 1 }} disabled={product.stock === 0} onPress={() => setMode('remove')} />
          <Button title="Set" icon="create-outline" variant="outline" style={{ flex: 1 }} onPress={() => setMode('set')} />
          <Button title="Add stock" icon="add" style={{ flex: 1.4 }} onPress={() => setMode('add')} />
        </View>
      }
    >
      <FlatList
        data={h.data ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={h.refreshing} onRefresh={h.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
        ListHeaderComponent={
          <Card style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <SmartImage src={product.imageUrl} style={styles.img} />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="h3" numberOfLines={1}>
                  {product.name}
                </AppText>
                <AppText variant="small">
                  {formatKES(product.price)} per {unitLabel(product.unit)} · alert at {product.lowStockThreshold}
                </AppText>
                <StockBadge state={product.stockState} />
              </View>
            </View>
            <View style={styles.big}>
              <AppText variant="caption">In stock now</AppText>
              <AppText variant="hero" color={colors.primaryDark}>
                {formatQty(product.stock, product.unit)}
              </AppText>
              <AppText variant="small">Worth {formatKES(product.stock * product.price)} at current price</AppText>
            </View>
          </Card>
        }
        renderItem={({ item }) => {
          const r = REASON[item.reason];
          const up = item.change > 0;
          return (
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: up ? colors.successLight : colors.dangerLight }]}>
                <Ionicons name={r.icon} size={18} color={up ? colors.success : colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="title">
                  {r.label}
                  {item.reason.startsWith('order') && item.note ? ` · ${item.note.replace(/^Order /, '').replace(/ cancelled$/, '')}` : ''}
                </AppText>
                <AppText variant="caption">
                  {formatDateTime(item.createdAt)}
                  {item.note && !item.reason.startsWith('order') ? ` · ${item.note}` : ''}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="bodyStrong" color={up ? colors.success : colors.danger}>
                  {up ? '+' : ''}
                  {item.change}
                </AppText>
                <AppText variant="caption">→ {item.balanceAfter}</AppText>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={h.loading ? null : h.error ? <ErrorState error={h.error} onRetry={h.refetch} compact /> : <EmptyState compact icon="time-outline" title="No stock changes yet" />}
        initialNumToRender={15}
      />
      <StockAdjustSheet product={mode ? product : null} initialMode={mode ?? 'add'} onClose={() => setMode(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  img: { width: 64, height: 64, borderRadius: radius.md },
  big: { alignItems: 'center', marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
