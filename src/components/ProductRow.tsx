import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import type { ProductView } from '@/types/models';
import { formatKES, perUnit } from '@/utils/format';

import { StockBadge } from './StockBadge';
import { AppText, SmartImage } from './ui';

interface Props {
  product: ProductView;
  onPress?: () => void;
  right?: ReactNode;
  subtitle?: string;
  showStockBadge?: boolean;
}

/** Compact horizontal product row for lists (search results, seller products). */
export const ProductRow = memo(function ProductRow({ product, onPress, right, subtitle, showStockBadge = true }: Props) {
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/product/${product.id}`))}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatKES(product.price)} ${perUnit(product.unit)}`}
    >
      <SmartImage src={product.imageUrl} style={styles.image} />
      <View style={styles.body}>
        <AppText variant="title" numberOfLines={1}>
          {product.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {subtitle ?? `${product.sellerName} · ${product.sellerArea}`}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="bodyStrong" color={colors.primaryDark}>
            {formatKES(product.price)}
            <AppText variant="caption"> {perUnit(product.unit)}</AppText>
          </AppText>
          {showStockBadge && <StockBadge state={product.stockState} hideInStock />}
        </View>
      </View>
      {right}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg },
  image: { width: 68, height: 68, borderRadius: radius.md },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
