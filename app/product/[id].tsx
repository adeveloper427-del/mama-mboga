import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/ProductCard';
import { StockBadge } from '@/components/StockBadge';
import { AppText, Avatar, Badge, Button, ErrorState, IconButton, LoadingView, QuantityStepper, Screen, SectionHeader, SmartImage, goBack } from '@/components/ui';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useFavorites } from '@/hooks/useFavorites';
import { useLocalList } from '@/hooks/useLocalList';
import { useQuery } from '@/hooks/useQuery';
import { catalog } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useCart } from '@/store/CartContext';
import { colors, radius, shadow, spacing } from '@/theme';
import { formatKES, formatQty, perUnit, unitLabel } from '@/utils/format';
import { storageKeys } from '@/utils/storage';

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const cart = useCart();
  const fav = useFavorites();
  const addToCart = useAddToCart();
  const recent = useLocalList(user?.role === 'customer' ? storageKeys.recentlyViewed(user.id) : null);

  const q = useQuery(`product:${id}`, () => catalog.getProduct(id), ['products', 'sellers']);
  const p = q.data;
  const shopQ = useQuery(p ? `shop:${p.sellerId}` : null, () => catalog.getShop(p!.sellerId), ['sellers']);
  const more = useQuery(p ? `shop-products:${p.sellerId}` : null, () => catalog.listProducts({ sellerId: p!.sellerId, inStockOnly: true }), ['products']);

  const [qty, setQty] = useState(1);
  const inCart = p ? cart.quantityOf(p.id) : 0;

  useEffect(() => {
    if (p && user?.role === 'customer') recent.push(p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);

  if (q.loading) return <Screen scroll={false}><LoadingView /></Screen>;
  if (!p) return <Screen scroll={false}><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;

  const isOwner = user?.id === p.sellerId;
  const isCustomer = user?.role === 'customer';
  const orderable = p.stockState === 'in_stock' || p.stockState === 'low_stock';
  const maxQty = Math.max(1, p.stock - inCart);
  const shop = shopQ.data;
  const moreItems = (more.data ?? []).filter((x) => x.id !== p.id).slice(0, 10);

  const footer = isOwner ? (
    <View style={styles.footerRow}>
      <Button title="Adjust stock" variant="outline" icon="cube-outline" style={{ flex: 1 }} onPress={() => router.push(`/stock/${p.id}`)} />
      <Button title="Edit product" icon="create-outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/product-form', params: { id: p.id } })} />
    </View>
  ) : isCustomer ? (
    orderable && shop?.acceptingOrders !== false ? (
      <View style={styles.footerRow}>
        <QuantityStepper value={Math.min(qty, maxQty)} onChange={setQty} min={1} max={maxQty} size="lg" />
        <Button
          title={inCart >= p.stock ? 'Max in cart' : `Add · ${formatKES(p.price * Math.min(qty, maxQty))}`}
          size="lg"
          icon="cart-outline"
          style={{ flex: 1 }}
          disabled={inCart >= p.stock}
          onPress={() => {
            if (addToCart(p, Math.min(qty, maxQty))) setQty(1);
          }}
        />
      </View>
    ) : (
      <Button
        title={shop?.acceptingOrders === false ? 'Shop not taking orders' : p.stockState === 'unavailable' ? 'Currently unavailable' : 'Sold out'}
        size="lg"
        fullWidth
        disabled
      />
    )
  ) : undefined;

  return (
    <Screen edgeToEdge padded={false} footer={footer} scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View>
          <SmartImage src={p.imageUrl} style={styles.hero} accessibilityLabel={`Photo of ${p.name}`} />
          <View style={[styles.heroBar, { top: insets.top + spacing.sm }]}>
            <IconButton icon="arrow-back" label="Go back" variant="glass" onPress={() => goBack('/home')} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {fav.enabled && (
                <IconButton
                  icon={fav.isFavorite(p.id) ? 'heart' : 'heart-outline'}
                  color={fav.isFavorite(p.id) ? colors.tomato : colors.text}
                  label="Save to favourites"
                  variant="glass"
                  onPress={() => fav.toggle('product', p.id)}
                />
              )}
              {isCustomer && <IconButton icon="cart-outline" label="Open cart" variant="glass" badge={cart.itemCount} onPress={() => router.push('/cart')} />}
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Badge label={p.categoryName} tone="primary" />
            <StockBadge state={p.stockState} />
            {inCart > 0 && <Badge label={`${inCart} in cart`} tone="accent" icon="cart" />}
          </View>
          <AppText variant="h1" style={{ marginTop: spacing.md }}>
            {p.name}
          </AppText>
          <View style={styles.priceRow}>
            <AppText variant="hero" color={colors.primaryDark} style={{ fontSize: 28 }}>
              {formatKES(p.price)}
            </AppText>
            <AppText variant="body" color={colors.textMuted}>
              {perUnit(p.unit)}
            </AppText>
          </View>
          {orderable && (
            <AppText variant="small" color={p.stockState === 'low_stock' ? colors.warning : colors.textMuted} style={{ marginTop: 2 }}>
              {p.stockState === 'low_stock' ? 'Hurry — only ' : ''}
              {formatQty(p.stock, p.unit)} available
            </AppText>
          )}

          {shop && (
            <Pressable style={styles.seller} onPress={() => router.push(`/shop/${shop.id}`)} accessibilityRole="button" accessibilityLabel={`Visit ${shop.businessName}`}>
              <Avatar name={shop.businessName} uri={shop.logoUrl ?? shop.coverUrl} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <AppText variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {shop.businessName}
                  </AppText>
                  {shop.verified && <Ionicons name="checkmark-circle" size={16} color={colors.info} />}
                </View>
                <AppText variant="caption">
                  ⭐ {shop.rating ? shop.rating.toFixed(1) : 'New'} · {shop.area} · {shop.isOpenNow ? 'Open now' : shop.acceptingOrders ? 'Closed now' : 'Not taking orders'}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}

          {shop && !shop.acceptingOrders && !isOwner && (
            <View style={styles.notice}>
              <Ionicons name="pause-circle" size={18} color={colors.warning} />
              <AppText variant="small" color="#B45309" style={{ flex: 1 }}>
                {shop.businessName} has paused orders for now. Save this item and check back later.
              </AppText>
            </View>
          )}
          {shop && shop.acceptingOrders && !shop.isOpenNow && !isOwner && (
            <View style={[styles.notice, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="time-outline" size={18} color={colors.info} />
              <AppText variant="small" color="#1D4ED8" style={{ flex: 1 }}>
                The shop is closed right now. You can still order — it will be confirmed when they open.
              </AppText>
            </View>
          )}

          <AppText variant="h3" style={{ marginTop: spacing.xl }}>
            About this product
          </AppText>
          <AppText variant="body" style={{ marginTop: spacing.sm }}>
            {p.description || 'Fresh produce from your local mama mboga.'}
          </AppText>

          <View style={styles.facts}>
            <Fact icon="scale-outline" label="Sold by" value={unitLabel(p.unit)} />
            <Fact
              icon={shop?.offersDelivery ? 'bicycle-outline' : 'walk-outline'}
              label={shop?.offersDelivery ? 'Delivery' : 'Pickup only'}
              value={shop?.offersDelivery ? (shop.deliveryFee ? formatKES(shop.deliveryFee) : 'Free') : (shop?.area ?? '')}
            />
            <Fact icon="flame-outline" label="Sold" value={`${p.soldCount}+`} />
          </View>
        </View>

        {moreItems.length > 0 && (
          <>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SectionHeader title={`More from ${p.sellerName}`} onAction={() => router.push(`/shop/${p.sellerId}`)} />
            </View>
            <FlatList
              horizontal
              data={moreItems}
              keyExtractor={(x) => x.id}
              renderItem={({ item }) => <ProductCard product={item} width={150} showSeller={false} />}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 4 }}
              showsHorizontalScrollIndicator={false}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Fact({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <AppText variant="caption">{label}</AppText>
      <AppText variant="label" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 340 },
  heroBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' },
  sheet: { marginTop: -28, backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm },
  seller: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, ...shadow.sm },
  notice: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.warningLight, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  facts: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  fact: { flex: 1, alignItems: 'center', gap: 4, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  footerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
