import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ProductGrid } from '@/components/ProductGrid';
import { ShopCard } from '@/components/ShopCard';
import { EmptyState, ErrorState, Header, Screen, SegmentedControl, SkeletonGrid } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { favorites } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { spacing } from '@/theme';

export default function Favorites() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'products' | 'shops'>('products');
  const products = useQuery(user ? `fav-products:${user.id}` : null, favorites.listFavoriteProducts, ['favorites', 'products']);
  const shops = useQuery(user ? `fav-shops:${user.id}` : null, favorites.listFavoriteShops, ['favorites', 'sellers']);
  const active = tab === 'products' ? products : shops;

  return (
    <Screen header={<Header title="Favourites" />} refreshing={active.refreshing} onRefresh={active.refetch}>
      <View style={{ marginBottom: spacing.lg }}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          segments={[
            { value: 'products', label: 'Products', count: products.data?.length },
            { value: 'shops', label: 'Shops', count: shops.data?.length },
          ]}
        />
      </View>
      {active.loading ? (
        <SkeletonGrid />
      ) : active.error && !active.data ? (
        <ErrorState error={active.error} onRetry={active.refetch} />
      ) : tab === 'products' ? (
        products.data?.length ? (
          <ProductGrid products={products.data} />
        ) : (
          <EmptyState icon="heart-outline" title="No saved products" message="Tap the heart on any product to save it here for quick reordering." actionLabel="Browse products" onAction={() => router.push('/browse')} />
        )
      ) : shops.data?.length ? (
        <View style={{ gap: spacing.md }}>
          {shops.data.map((s) => (
            <ShopCard key={s.id} shop={s} variant="row" />
          ))}
        </View>
      ) : (
        <EmptyState icon="storefront-outline" title="No saved shops" message="Save your favourite mama mbogas to find them faster." actionLabel="Find shops" onAction={() => router.push('/shops')} />
      )}
    </Screen>
  );
}
