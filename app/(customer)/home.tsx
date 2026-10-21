import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AreaPicker } from '@/components/AreaPicker';
import { CategoryBubble } from '@/components/CategoryTile';
import { OrderStatusBadge } from '@/components/orders';
import { ProductCard } from '@/components/ProductCard';
import { ProductGrid } from '@/components/ProductGrid';
import { ShopCard } from '@/components/ShopCard';
import { AppText, EmptyState, ErrorState, IconButton, Screen, SectionHeader, Skeleton, SkeletonGrid } from '@/components/ui';
import { IMAGES } from '@/data/images';
import { useBadges } from '@/hooks/useBadges';
import { useLocalList } from '@/hooks/useLocalList';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { auth, catalog, orders } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, shadow, spacing } from '@/theme';
import { firstName, greeting } from '@/utils/format';
import { storageKeys } from '@/utils/storage';

export default function Home() {
  const { user } = useAuth();
  const badges = useBadges();
  const [areaOpen, setAreaOpen] = useState(false);
  const area = user?.area;

  const categories = useQuery('categories', catalog.listCategories, ['categories']);
  const shops = useQuery(`shops:near:${area}`, () => catalog.listShops({ area, nearbyOnly: true }), ['sellers', 'users', 'products']);
  const popular = useQuery('products:popular', () => catalog.listProducts({ sort: 'popular', inStockOnly: true, limit: 6 }), ['products', 'sellers']);
  const recommended = useQuery(`products:recommended:${user?.id}`, () => catalog.recommendedProducts(8), ['products', 'favorites', 'orders']);
  const active = useQuery(`orders:active:${user?.id}`, () => orders.listMyOrders('active'), ['orders']);

  const recent = useLocalList(user ? storageKeys.recentlyViewed(user.id) : null);
  const recentIds = recent.items.slice(0, 10);
  const recentQ = useQuery(recentIds.length ? `recent:${recentIds.join(',')}` : null, () => catalog.getProductsByIds(recentIds), ['products']);
  const recentProducts = recentIds.map((id) => recentQ.data?.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);

  const changeArea = useMutation((a: string) => auth.updateProfile({ area: a }), { success: (u) => `Showing sellers near ${u.area}` });

  const refreshing = categories.refreshing || shops.refreshing || popular.refreshing;
  const onRefresh = () => {
    categories.refetch();
    shops.refetch();
    popular.refetch();
    recommended.refetch();
    active.refetch();
    recentQ.refetch();
  };

  const firstError = categories.error ?? popular.error;
  const liveOrder = active.data?.[0];

  return (
    <Screen padded={false} refreshing={refreshing} onRefresh={onRefresh}>
      {/* Greeting + location */}
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <AppText variant="small" color={colors.textMuted}>
            {greeting()}, {user ? firstName(user.fullName) : ''} 👋
          </AppText>
          <Pressable onPress={() => setAreaOpen(true)} style={styles.location} accessibilityRole="button" accessibilityLabel={`Delivery area: ${area ?? 'not set'}. Change`}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <AppText variant="h3" numberOfLines={1}>
              {area ?? 'Choose your area'}
            </AppText>
            <Ionicons name="chevron-down" size={18} color={colors.text} />
          </Pressable>
        </View>
        <IconButton icon="chatbubble-ellipses-outline" label="Messages" variant="soft" badge={badges.messages} onPress={() => router.push('/messages')} />
        <IconButton icon="notifications-outline" label="Notifications" variant="soft" badge={badges.notifications} onPress={() => router.push('/notifications')} style={{ marginLeft: spacing.sm }} />
      </View>

      {/* Search */}
      <Pressable onPress={() => router.push('/search')} style={styles.search} accessibilityRole="search" accessibilityLabel="Search products and shops">
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <AppText variant="body" color={colors.textMuted} style={{ flex: 1 }}>
          Search sukuma, tomatoes, shops…
        </AppText>
        <View style={styles.filterIcon}>
          <Ionicons name="options-outline" size={18} color={colors.white} />
        </View>
      </Pressable>

      <View style={styles.pad}>
        {/* Live order tracker */}
        {liveOrder && (
          <Pressable onPress={() => router.push(`/order/${liveOrder.id}`)} style={styles.live} accessibilityRole="button" accessibilityLabel={`Track order ${liveOrder.code}`}>
            <View style={styles.liveIcon}>
              <Ionicons name={liveOrder.status === 'out_for_delivery' ? 'bicycle' : 'receipt'} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="title" numberOfLines={1}>
                {liveOrder.shopName}
              </AppText>
              <OrderStatusBadge status={liveOrder.status} fulfilment={liveOrder.fulfilment} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="label" color={colors.primary}>
                Track
              </AppText>
              {active.data!.length > 1 && <AppText variant="caption">+{active.data!.length - 1} more</AppText>}
            </View>
          </Pressable>
        )}

        {/* Promo banner */}
        <Pressable onPress={() => router.push('/browse')} style={styles.banner} accessibilityRole="button" accessibilityLabel="Browse fresh produce">
          <Image source={IMAGES.vegetables} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(20,83,45,0.95)', 'rgba(20,83,45,0.55)', 'rgba(20,83,45,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={styles.bannerText}>
            <AppText variant="caption" color={colors.accentLight} style={{ fontWeight: '700', letterSpacing: 1 }}>
              FRESH TODAY
            </AppText>
            <AppText variant="h2" color={colors.white} style={{ marginTop: 4 }}>
              From the shamba{'\n'}to your door
            </AppText>
            <View style={styles.bannerCta}>
              <AppText variant="label" color={colors.primaryDark}>
                Shop now
              </AppText>
              <Ionicons name="arrow-forward" size={14} color={colors.primaryDark} />
            </View>
          </View>
        </Pressable>

        {firstError && !categories.data && <ErrorState error={firstError} onRetry={onRefresh} compact />}
      </View>

      {/* Categories */}
      <View style={styles.pad}>
        <SectionHeader title="Shop by category" onAction={() => router.push('/browse')} />
      </View>
      {categories.loading ? (
        <View style={[styles.hRow, { flexDirection: 'row', gap: spacing.md }]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={66} height={66} rounded={33} />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.hRow, { gap: spacing.sm }]}>
          {categories.data?.map((c) => <CategoryBubble key={c.id} category={c} />)}
        </ScrollView>
      )}

      {/* Nearby shops */}
      <View style={styles.pad}>
        <SectionHeader title="Mama mbogas near you" subtitle={area ? `In and around ${area}` : undefined} onAction={() => router.push('/shops')} />
      </View>
      {shops.loading ? (
        <View style={[styles.hRow, { flexDirection: 'row', gap: spacing.md }]}>
          <Skeleton width={270} height={190} rounded={radius.lg} />
          <Skeleton width={270} height={190} rounded={radius.lg} />
        </View>
      ) : shops.data?.length ? (
        <FlatList
          horizontal
          data={shops.data}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <ShopCard shop={item} />}
          contentContainerStyle={[styles.hRow, { gap: spacing.md }]}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        <View style={styles.pad}>
          <EmptyState compact icon="storefront-outline" title="No sellers in your area yet" message="Try a nearby area or browse all shops." actionLabel="Change area" onAction={() => setAreaOpen(true)} />
        </View>
      )}

      {/* Popular */}
      <View style={styles.pad}>
        <SectionHeader title="Popular this week" onAction={() => router.push({ pathname: '/search', params: { sort: 'popular' } })} />
        {popular.loading ? <SkeletonGrid /> : <ProductGrid products={popular.data ?? []} />}
      </View>

      {/* Recently viewed */}
      {recentProducts.length > 0 && (
        <>
          <View style={styles.pad}>
            <SectionHeader title="Recently viewed" actionLabel="Clear" onAction={recent.clear} />
          </View>
          <FlatList
            horizontal
            data={recentProducts}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => <ProductCard product={item} width={156} />}
            contentContainerStyle={[styles.hRow, { gap: spacing.md }]}
            showsHorizontalScrollIndicator={false}
          />
        </>
      )}

      {/* Recommended */}
      {!!recommended.data?.length && (
        <>
          <View style={styles.pad}>
            <SectionHeader title="Recommended for you" subtitle="Based on what you buy and love" />
          </View>
          <FlatList
            horizontal
            data={recommended.data}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => <ProductCard product={item} width={156} />}
            contentContainerStyle={[styles.hRow, { gap: spacing.md }]}
            showsHorizontalScrollIndicator={false}
          />
        </>
      )}

      <AreaPicker visible={areaOpen} value={area} onSelect={(a) => changeArea.run(a)} onClose={() => setAreaOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, alignSelf: 'flex-start', paddingVertical: 2 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.lg,
    height: 52, borderRadius: radius.lg, backgroundColor: colors.card, paddingLeft: spacing.lg, paddingRight: 6, ...shadow.sm,
  },
  filterIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: spacing.lg },
  hRow: { paddingHorizontal: spacing.lg, paddingBottom: 4 },
  live: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primaryLight, ...shadow.sm },
  liveIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  banner: { height: 160, borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.lg, backgroundColor: colors.primaryDark },
  bannerText: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  bannerCta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.md },
});
