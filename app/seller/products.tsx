import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ProductRow } from '@/components/ProductRow';
import { Chip, EmptyState, ErrorState, Header, IconButton, Screen, SkeletonList, TextField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { catalog, products } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { colors, radius, shadow, spacing } from '@/theme';
import { formatQty } from '@/utils/format';

export default function SellerProducts() {
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const q = useQuery(user ? `my-products:${user.id}` : null, products.listMyProducts, ['products']);
  const categories = useQuery('categories', catalog.listCategories, ['categories']);

  const term = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter((p) => (!cat || p.categoryId === cat) && (!term || p.name.toLowerCase().includes(term)));
  const usedCats = (categories.data ?? []).filter((c) => q.data?.some((p) => p.categoryId === c.id));

  const toggle = async (id: string, value: boolean) => {
    q.setData((prev) => prev?.map((p) => (p.id === id ? { ...p, isAvailable: value, stockState: value ? (p.stock <= 0 ? 'out_of_stock' : p.stock <= p.lowStockThreshold ? 'low_stock' : 'in_stock') : 'unavailable' } : p)));
    try {
      await products.setAvailability(id, value);
      toast.show(value ? 'Product is now visible to customers' : 'Product hidden from customers', 'success');
    } catch (e) {
      q.refetch();
      toast.show((e as Error).message, 'error');
    }
  };

  return (
    <Screen
      header={<Header title="Products" subtitle={q.data ? `${q.data.length} listed` : undefined} back={false} large right={<IconButton icon="eye-outline" label="View my shop" variant="soft" onPress={() => user && router.push(`/shop/${user.id}`)} />} />}
      scroll={false}
      padded={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <TextField placeholder="Search your products" icon="search" value={search} onChangeText={setSearch} autoCorrect={false} />
      </View>
      {usedCats.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0, marginTop: -spacing.sm }}>
          <Chip label="All" selected={!cat} onPress={() => setCat(null)} />
          {usedCats.map((c) => (
            <Chip key={c.id} label={c.name} selected={cat === c.id} onPress={() => setCat(c.id)} />
          ))}
        </ScrollView>
      )}
      {q.loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList rows={6} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              subtitle={`${formatQty(item.stock, item.unit)} in stock · ${item.soldCount} sold`}
              onPress={() => router.push({ pathname: '/product-form', params: { id: item.id } })}
              right={
                <Switch
                  value={item.isAvailable}
                  onValueChange={(v) => {
                    toggle(item.id, v);
                  }}
                  trackColor={{ true: colors.primary, false: '#CBD5CF' }}
                  thumbColor={colors.white}
                  accessibilityLabel={`${item.name} visible to customers`}
                />
              }
            />
          )}
          ListEmptyComponent={
            q.data?.length ? (
              <EmptyState icon="search-outline" title="No matching products" message="Try a different search or category." />
            ) : (
              <EmptyState icon="leaf-outline" title="Add your first product" message="List what you sell — sukuma, tomatoes, fruits — so customers nearby can order." actionLabel="Add product" onAction={() => router.push('/product-form')} />
            )
          }
          initialNumToRender={10}
          windowSize={7}
        />
      )}
      <Pressable onPress={() => router.push('/product-form')} style={({ pressed }) => [styles.fab, pressed && { backgroundColor: colors.primaryDark }]} accessibilityRole="button" accessibilityLabel="Add product">
        <Ionicons name="add" size={24} color={colors.white} />
        <Ionicons name="leaf" size={14} color={colors.white} style={{ marginLeft: -4 }} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  fab: { position: 'absolute', right: spacing.xl, bottom: spacing.xl, height: 58, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...shadow.lg },
});
