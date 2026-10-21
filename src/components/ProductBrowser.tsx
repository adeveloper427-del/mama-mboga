import { useState, type ReactElement } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { useGridWidth } from '@/hooks/useGridWidth';
import { useQuery } from '@/hooks/useQuery';
import { catalog } from '@/services';
import type { ProductSort } from '@/services/catalogService';
import { colors, spacing } from '@/theme';

import { ProductCard } from './ProductCard';
import { AppText, BottomSheet, Button, Chip, EmptyState, ErrorState, SkeletonGrid, TextField } from './ui';

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'price_asc', label: 'Lowest price' },
  { value: 'price_desc', label: 'Highest price' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
];

interface Props {
  search?: string;
  categoryId?: string;
  initialSort?: ProductSort;
  header?: ReactElement;
  emptyTitle?: string;
}

/** Filterable, sortable, virtualised product grid used by Search and Category pages. */
export function ProductBrowser({ search = '', categoryId, initialSort, header, emptyTitle }: Props) {
  const { itemWidth, columns, gap } = useGridWidth();
  const [sort, setSort] = useState<ProductSort | undefined>(initialSort);
  const [inStock, setInStock] = useState(false);
  const [cat, setCat] = useState<string | undefined>(categoryId);
  const [price, setPrice] = useState<{ min?: number; max?: number }>({});
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState({ min: '', max: '' });

  const categories = useQuery('categories', catalog.listCategories, ['categories']);
  const term = search.trim();
  const key = `browse:${term}:${cat}:${sort}:${inStock}:${price.min}:${price.max}`;
  const q = useQuery(key, () => catalog.listProducts({ search: term, categoryId: cat, sort, inStockOnly: inStock, minPrice: price.min, maxPrice: price.max }), ['products', 'sellers']);

  const activeFilters = (cat && !categoryId ? 1 : 0) + (price.min !== undefined || price.max !== undefined ? 1 : 0);
  const effectiveSort = sort ?? (term ? 'relevance' : 'popular');

  const applySheet = () => {
    const min = draft.min ? Number(draft.min) : undefined;
    const max = draft.max ? Number(draft.max) : undefined;
    setPrice({ min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined });
    setSheet(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        <Chip label={activeFilters ? `Filters · ${activeFilters}` : 'Filters'} icon="options-outline" selected={activeFilters > 0} onPress={() => { setDraft({ min: price.min?.toString() ?? '', max: price.max?.toString() ?? '' }); setSheet(true); }} />
        <Chip label="In stock" icon={inStock ? 'checkmark' : undefined} selected={inStock} onPress={() => setInStock((v) => !v)} />
        {SORTS.map((s) => (
          <Chip key={s.value} label={s.label} selected={effectiveSort === s.value} onPress={() => setSort(effectiveSort === s.value && term ? undefined : s.value)} />
        ))}
      </ScrollView>

      {q.loading && !q.data ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonGrid items={6} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          key={`cols-${columns}`}
          data={q.data}
          numColumns={columns}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <ProductCard product={item} width={itemWidth} />}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap, flexGrow: 1 }}
          ListHeaderComponent={
            <>
              {header}
              {!!q.data?.length && (
                <AppText variant="caption" style={{ marginBottom: spacing.xs }}>
                  {q.data.length} product{q.data.length === 1 ? '' : 's'}
                  {term ? ` for "${term}"` : ''}
                </AppText>
              )}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title={emptyTitle ?? (term ? `No results for "${term}"` : 'No products found')}
              message={activeFilters || inStock ? 'Try removing some filters.' : 'Try a different word, e.g. "sukuma" or "tomatoes".'}
              actionLabel={activeFilters || inStock ? 'Clear filters' : undefined}
              onAction={() => {
                setInStock(false);
                setPrice({});
                if (!categoryId) setCat(undefined);
              }}
            />
          }
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Filters"
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              title="Reset"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => {
                setDraft({ min: '', max: '' });
                setPrice({});
                if (!categoryId) setCat(undefined);
                setSheet(false);
              }}
            />
            <Button title="Show results" style={{ flex: 2 }} onPress={applySheet} />
          </View>
        }
      >
        {!categoryId && (
          <>
            <AppText variant="label" style={styles.label}>
              Category
            </AppText>
            <View style={styles.wrap}>
              <Chip label="All" selected={!cat} onPress={() => setCat(undefined)} />
              {categories.data?.map((c) => (
                <Chip key={c.id} label={c.name} selected={cat === c.id} onPress={() => setCat(c.id)} />
              ))}
            </View>
          </>
        )}
        <AppText variant="label" style={styles.label}>
          Price range (KSh)
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Min" keyboardType="number-pad" value={draft.min} onChangeText={(t) => setDraft((d) => ({ ...d, min: t.replace(/\D/g, '') }))} prefix="KSh" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Max" keyboardType="number-pad" value={draft.max} onChangeText={(t) => setDraft((d) => ({ ...d, max: t.replace(/\D/g, '') }))} prefix="KSh" />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  label: { marginTop: spacing.md, marginBottom: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
