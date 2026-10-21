import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ShopStatus } from '@/components/ShopCard';
import { AppText, Button, EmptyState, ErrorState, Header, Screen, SkeletonList, SmartImage, QuantityStepper } from '@/components/ui';
import { useCartDetails, type CartItemView } from '@/hooks/useCartDetails';
import { useCart } from '@/store/CartContext';
import { useDialog } from '@/store/DialogContext';
import { colors, radius, shadow, spacing } from '@/theme';
import { formatKES, perUnit, pluralize } from '@/utils/format';

const ISSUE_TEXT: Record<NonNullable<CartItemView['issue']>, string> = {
  removed: 'No longer sold',
  unavailable: 'Currently unavailable',
  out_of_stock: 'Sold out',
  insufficient: 'Not enough stock',
};

export default function Cart() {
  const cart = useCart();
  const dialog = useDialog();
  const { groups, loading, error, refetch, refreshing, readyGroups, subtotal } = useCartDetails();

  const clearAll = async () => {
    if (await dialog.confirm({ title: 'Empty your cart?', message: 'All items will be removed.', confirmLabel: 'Empty cart', destructive: true, icon: 'trash-outline' })) cart.clear();
  };

  const header = <Header title="My cart" subtitle={cart.itemCount ? pluralize(cart.itemCount, 'item') : undefined} back={false} large right={cart.itemCount ? <Button title="Clear" variant="ghost" size="sm" onPress={clearAll} /> : undefined} />;

  if (!cart.itemCount && cart.ready) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState icon="cart-outline" title="Your cart is empty" message="Fresh sukuma, tomatoes and fruits are just a tap away." actionLabel="Start shopping" onAction={() => router.push('/home')} />
      </Screen>
    );
  }

  const blockedCount = groups.length - readyGroups.length;
  const cartTotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const onlyMinimum = !readyGroups.length && groups.some((g) => g.belowMinimum);

  return (
    <Screen
      header={header}
      refreshing={refreshing}
      onRefresh={refetch}
      footer={
        groups.length > 0 && !loading ? (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.totalRow}>
              <View>
                <AppText variant="small">Subtotal{readyGroups.length > 1 ? ` · ${readyGroups.length} shops` : ''}</AppText>
                <AppText variant="caption">Delivery fee calculated at checkout</AppText>
              </View>
              <AppText variant="h2">{formatKES(readyGroups.length ? subtotal : cartTotal)}</AppText>
            </View>
            <Button
              title={readyGroups.length ? 'Proceed to checkout' : onlyMinimum ? 'Minimum order not reached' : 'Nothing ready to order'}
              size="lg"
              fullWidth
              iconRight="arrow-forward"
              disabled={!readyGroups.length}
              onPress={() => router.push('/checkout')}
            />
          </View>
        ) : undefined
      }
    >
      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          {groups.length > 1 && (
            <View style={styles.info}>
              <Ionicons name="information-circle" size={18} color={colors.info} />
              <AppText variant="small" color="#1D4ED8" style={{ flex: 1 }}>
                Your cart has items from {groups.length} shops. Each shop will receive a separate order.
              </AppText>
            </View>
          )}
          {groups.map((g) => (
            <View key={g.sellerId} style={styles.group}>
              <Pressable onPress={() => g.shop && router.push(`/shop/${g.sellerId}`)} style={styles.shopRow} accessibilityRole="button">
                <Ionicons name="storefront" size={18} color={colors.primary} />
                <AppText variant="title" style={{ flex: 1 }} numberOfLines={1}>
                  {g.shop?.businessName ?? 'Unavailable shop'}
                </AppText>
                {g.shop && <ShopStatus shop={g.shop} />}
              </Pressable>

              {g.items.map((item) => (
                <View key={item.productId} style={[styles.line, item.issue && item.issue !== 'insufficient' && { opacity: 0.6 }]}>
                  <Pressable onPress={() => item.product && router.push(`/product/${item.productId}`)}>
                    <SmartImage src={item.product?.imageUrl} style={styles.img} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="title" numberOfLines={1}>
                      {item.product?.name ?? 'Removed item'}
                    </AppText>
                    {item.product && (
                      <AppText variant="caption">
                        {formatKES(item.product.price)} {perUnit(item.product.unit)}
                      </AppText>
                    )}
                    {item.issue ? (
                      <AppText variant="caption" color={colors.danger} style={{ fontWeight: '600' }}>
                        {ISSUE_TEXT[item.issue]}
                        {item.issue === 'insufficient' && item.product ? ` — only ${item.product.stock} left` : ''}
                      </AppText>
                    ) : (
                      <AppText variant="bodyStrong" color={colors.primaryDark}>
                        {formatKES(item.lineTotal)}
                      </AppText>
                    )}
                  </View>
                  {item.product && item.issue !== 'removed' && item.issue !== 'unavailable' && item.issue !== 'out_of_stock' ? (
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      min={0}
                      max={item.product.stock}
                      removable
                      onChange={(q) => cart.setQuantity(item.productId, Math.min(q, item.product!.stock))}
                    />
                  ) : (
                    <Button title="Remove" variant="danger" size="sm" onPress={() => cart.remove(item.productId)} />
                  )}
                </View>
              ))}

              <View style={styles.groupFooter}>
                {g.blocked ? (
                  <View style={styles.blocked}>
                    <Ionicons name="alert-circle" size={16} color={colors.warning} />
                    <AppText variant="small" color="#B45309" style={{ flex: 1 }}>
                      {g.blocked}
                      {g.belowMinimum ? ` — add ${formatKES(g.shop!.minOrder - g.subtotal)} more` : ''}
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="small">
                    {g.shop?.offersDelivery ? (g.shop.deliveryFee ? `Delivery ${formatKES(g.shop.deliveryFee)}` : 'Free delivery') : 'Pickup only'}
                  </AppText>
                )}
                <AppText variant="bodyStrong">{formatKES(g.subtotal)}</AppText>
              </View>
            </View>
          ))}
          {blockedCount > 0 && readyGroups.length > 0 && (
            <AppText variant="caption" align="center" style={{ marginTop: spacing.sm }}>
              Items from shops that can't take orders stay in your cart for later.
            </AppText>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, marginBottom: spacing.lg, ...shadow.sm, overflow: 'hidden' },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  img: { width: 60, height: 60, borderRadius: radius.md },
  groupFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg, backgroundColor: '#FAFCFA' },
  blocked: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
