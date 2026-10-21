import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductGrid } from '@/components/ProductGrid';
import { ShopStatus } from '@/components/ShopCard';
import { AppText, Avatar, Button, Chip, EmptyState, ErrorState, IconButton, LoadingView, RatingStars, Screen, SectionHeader, SkeletonGrid, SmartImage, goBack } from '@/components/ui';
import { useFavorites } from '@/hooks/useFavorites';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { catalog, location, messages } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, shadow, spacing } from '@/theme';
import { formatClock, formatDays, formatKES, timeAgo } from '@/utils/format';

export default function ShopPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const fav = useFavorites();
  const [cat, setCat] = useState<string | null>(null);

  const shopQ = useQuery(`shop:${id}`, () => catalog.getShop(id), ['sellers', 'products']);
  const productsQ = useQuery(`shop-products-all:${id}`, () => catalog.listProducts({ sellerId: id }), ['products']);
  const reviewsQ = useQuery(`shop-reviews:${id}`, () => catalog.listShopReviews(id, 5), ['reviews']);
  const categories = useQuery('categories', catalog.listCategories, ['categories']);

  const chat = useMutation(() => messages.openConversationWithShop(id));

  const shopCats = useMemo(() => {
    const ids = new Set((productsQ.data ?? []).map((p) => p.categoryId));
    return (categories.data ?? []).filter((c) => ids.has(c.id));
  }, [productsQ.data, categories.data]);

  if (shopQ.loading) return <Screen scroll={false}><LoadingView /></Screen>;
  const shop = shopQ.data;
  if (!shop) return <Screen scroll={false}><ErrorState error={shopQ.error} onRetry={shopQ.refetch} /></Screen>;

  const isCustomer = user?.role === 'customer';
  const isOwner = user?.id === shop.id;
  const visible = (productsQ.data ?? []).filter((p) => !cat || p.categoryId === cat);

  return (
    <Screen edgeToEdge padded={false} scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl + insets.bottom }}>
        <View>
          <SmartImage src={shop.coverUrl} style={styles.cover} fallbackIcon="storefront-outline" />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} style={[StyleSheet.absoluteFill, { height: 120 }]} />
          <View style={[styles.bar, { top: insets.top + spacing.sm }]}>
            <IconButton icon="arrow-back" label="Go back" variant="glass" onPress={() => goBack('/home')} />
            {fav.enabled && (
              <IconButton
                icon={fav.isFavorite(shop.id) ? 'heart' : 'heart-outline'}
                color={fav.isFavorite(shop.id) ? colors.tomato : colors.text}
                label="Save shop to favourites"
                variant="glass"
                onPress={() => fav.toggle('seller', shop.id)}
              />
            )}
          </View>
        </View>

        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Avatar name={shop.businessName} uri={shop.logoUrl} size={72} ring />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xxl }}>
            <AppText variant="h1" style={{ flexShrink: 1 }}>
              {shop.businessName}
            </AppText>
            {shop.verified && <Ionicons name="checkmark-circle" size={22} color={colors.info} accessibilityLabel="Verified seller" />}
          </View>
          <AppText variant="small">Run by {shop.ownerName}</AppText>
          <View style={styles.metaRow}>
            <RatingStars value={shop.rating} size={15} />
            <AppText variant="label">{shop.rating ? shop.rating.toFixed(1) : 'New'}</AppText>
            <AppText variant="caption">({shop.ratingCount} reviews)</AppText>
            <ShopStatus shop={shop} />
          </View>
          {!!shop.description && (
            <AppText variant="body" style={{ marginTop: spacing.md }}>
              {shop.description}
            </AppText>
          )}

          <View style={styles.infoGrid}>
            <Info icon="location-outline" title={shop.area} text={[shop.addressLine, shop.landmark].filter(Boolean).join(' · ')} />
            <Info icon="time-outline" title={`${formatClock(shop.hours.open)} – ${formatClock(shop.hours.close)}`} text={formatDays(shop.hours.days)} />
            <Info
              icon={shop.offersDelivery ? 'bicycle-outline' : 'walk-outline'}
              title={shop.offersDelivery ? (shop.deliveryFee ? `${formatKES(shop.deliveryFee)} delivery` : 'Free delivery') : 'Pickup only'}
              text={[shop.offersPickup && shop.offersDelivery ? 'Pickup also available' : '', shop.minOrder ? `Min. order ${formatKES(shop.minOrder)}` : 'No minimum order'].filter(Boolean).join(' · ')}
            />
          </View>

          {!isOwner && (
            <View style={styles.actions}>
              {isCustomer && (
                <Button
                  title="Message"
                  icon="chatbubble-ellipses-outline"
                  variant="secondary"
                  style={{ flex: 1 }}
                  loading={chat.busy}
                  onPress={async () => {
                    const convId = await chat.run();
                    if (convId) router.push(`/messages/${convId}`);
                  }}
                />
              )}
              <Button title="Call" icon="call-outline" variant="outline" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${shop.phone}`)} />
              <IconButton icon="navigate-outline" label="Directions" variant="soft" onPress={() => Linking.openURL(location.mapsSearchUrl(`${shop.addressLine}, ${shop.area}, Nairobi`))} />
            </View>
          )}
          {isOwner && (
            <Button title="Edit shop profile" icon="create-outline" variant="secondary" style={{ marginTop: spacing.lg }} onPress={() => router.push('/shop-settings')} />
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <SectionHeader title="Products" subtitle={`${productsQ.data?.length ?? 0} items`} />
        </View>
        {shopCats.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Chip label="All" selected={!cat} onPress={() => setCat(null)} />
            {shopCats.map((c) => (
              <Chip key={c.id} label={c.name} selected={cat === c.id} onPress={() => setCat(c.id)} />
            ))}
          </ScrollView>
        )}
        <View style={{ paddingHorizontal: spacing.lg }}>
          {productsQ.loading ? (
            <SkeletonGrid />
          ) : visible.length ? (
            <ProductGrid products={visible} showSeller={false} />
          ) : (
            <EmptyState compact icon="leaf-outline" title="No products yet" message="This shop hasn't listed any produce yet." />
          )}

          <SectionHeader title="Customer reviews" subtitle={shop.ratingCount ? `${shop.rating.toFixed(1)} average from ${shop.ratingCount}` : undefined} />
          {reviewsQ.data?.length ? (
            reviewsQ.data.map((r) => (
              <View key={r.id} style={styles.review}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Avatar name={r.customerName} size={34} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="label">{r.customerName}</AppText>
                    <AppText variant="caption">{timeAgo(r.createdAt)}</AppText>
                  </View>
                  <RatingStars value={r.rating} size={13} />
                </View>
                {!!r.comment && (
                  <AppText variant="small" style={{ marginTop: spacing.sm }}>
                    {r.comment}
                  </AppText>
                )}
              </View>
            ))
          ) : (
            <EmptyState compact icon="star-outline" title="No reviews yet" message="Reviews appear after customers complete orders." />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Info({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={styles.info}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="label">{title}</AppText>
        {!!text && <AppText variant="caption">{text}</AppText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 210 },
  bar: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' },
  headerCard: { marginHorizontal: spacing.lg, marginTop: -40, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, ...shadow.md },
  avatar: { position: 'absolute', top: -36, left: spacing.xl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, flexWrap: 'wrap' },
  infoGrid: { gap: spacing.md, marginTop: spacing.lg },
  info: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  infoIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, alignItems: 'center' },
  review: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
});

