import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/components/CategoryTile';
import { AppText, ErrorState, Header, IconButton, Screen, Skeleton } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { catalog } from '@/services';
import { colors, radius, shadow, spacing } from '@/theme';

export default function Browse() {
  const categories = useQuery('categories', catalog.listCategories, ['categories']);
  const products = useQuery('products:all', () => catalog.listProducts(), ['products', 'sellers']);

  const counts = new Map<string, number>();
  products.data?.forEach((p) => counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1));
  const rows: (typeof categories.data)[] = [];
  const list = categories.data ?? [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));

  return (
    <Screen
      header={<Header title="Categories" back={false} large right={<IconButton icon="search" label="Search" variant="soft" onPress={() => router.push('/search')} />} />}
      refreshing={categories.refreshing}
      onRefresh={() => {
        categories.refetch();
        products.refetch();
      }}
    >
      {categories.error && !categories.data ? (
        <ErrorState error={categories.error} onRetry={categories.refetch} />
      ) : categories.loading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md }}>
              <Skeleton height={150} rounded={radius.lg} style={{ flex: 1 }} />
              <Skeleton height={150} rounded={radius.lg} style={{ flex: 1 }} />
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {rows.map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md }}>
              {row!.map((c) => (
                <CategoryTile key={c.id} category={c} count={counts.get(c.id) ?? 0} />
              ))}
              {row!.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          ))}
        </View>
      )}

      <Pressable onPress={() => router.push('/shops')} style={styles.shops} accessibilityRole="button">
        <View style={styles.shopsIcon}>
          <Ionicons name="storefront" size={22} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="title">Browse all shops</AppText>
          <AppText variant="small">Find your favourite mama mboga</AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shops: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, ...shadow.sm },
  shopsIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
