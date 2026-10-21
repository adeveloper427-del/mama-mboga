import { StyleSheet, View } from 'react-native';

import { useGridWidth } from '@/hooks/useGridWidth';
import type { ProductView } from '@/types/models';

import { ProductCard } from './ProductCard';

/** Non-virtualised grid for short lists inside a ScrollView (home sections, shop pages). */
export function ProductGrid({ products, showSeller = true }: { products: ProductView[]; showSeller?: boolean }) {
  const { itemWidth, gap } = useGridWidth();
  return (
    <View style={[styles.grid, { gap }]}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} width={itemWidth} showSeller={showSeller} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap' } });
