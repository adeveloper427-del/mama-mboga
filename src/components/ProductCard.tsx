import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAddToCart } from '@/hooks/useAddToCart';
import { useFavorites } from '@/hooks/useFavorites';
import { useCart } from '@/store/CartContext';
import { colors, radius, shadow, spacing } from '@/theme';
import type { ProductView } from '@/types/models';
import { formatKES, perUnit } from '@/utils/format';

import { StockBadge } from './StockBadge';
import { AppText, IconButton, QuantityStepper, SmartImage } from './ui';

interface Props {
  product: ProductView;
  width?: number;
  showSeller?: boolean;
}

/** Grid tile used on Home, Categories, Search and shop pages. */
export const ProductCard = memo(function ProductCard({ product, width, showSeller = true }: Props) {
  const fav = useFavorites();
  const cart = useCart();
  const addToCart = useAddToCart();
  const inCart = cart.quantityOf(product.id);
  const orderable = product.stockState === 'in_stock' || product.stockState === 'low_stock';

  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}`)}
      style={({ pressed }) => [styles.card, width ? { width } : styles.flex, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatKES(product.price)} ${perUnit(product.unit)}, from ${product.sellerName}`}
    >
      <View>
        <SmartImage src={product.imageUrl} style={styles.image} />
        {!orderable && <View style={styles.dim} />}
        <View style={styles.badge}>
          <StockBadge state={product.stockState} hideInStock />
        </View>
        {fav.enabled && (
          <IconButton
            icon={fav.isFavorite(product.id) ? 'heart' : 'heart-outline'}
            color={fav.isFavorite(product.id) ? colors.tomato : colors.text}
            label={fav.isFavorite(product.id) ? 'Remove from favourites' : 'Save to favourites'}
            variant="glass"
            size={18}
            style={styles.heart}
            onPress={() => fav.toggle('product', product.id)}
          />
        )}
      </View>
      <View style={styles.body}>
        <AppText variant="title" numberOfLines={1}>
          {product.name}
        </AppText>
        {showSeller && (
          <View style={styles.sellerRow}>
            <Ionicons name="storefront-outline" size={12} color={colors.textMuted} />
            <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {product.sellerName}
            </AppText>
          </View>
        )}
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <AppText variant="price" style={{ fontSize: 16 }}>
              {formatKES(product.price)}
            </AppText>
            <AppText variant="caption">{perUnit(product.unit)}</AppText>
          </View>
          {fav.enabled && orderable && inCart === 0 && (
            <Pressable
              onPress={() => addToCart(product)}
              style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.primaryDark }]}
              accessibilityRole="button"
              accessibilityLabel={`Add ${product.name} to cart`}
              hitSlop={8}
            >
              <Ionicons name="add" size={22} color={colors.white} />
            </Pressable>
          )}
        </View>
        {fav.enabled && inCart > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <QuantityStepper
              size="sm"
              value={inCart}
              max={product.stock}
              min={0}
              removable
              onChange={(q) => cart.setQuantity(product.id, q)}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sm },
  flex: { flex: 1 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  image: { width: '100%', aspectRatio: 1.15 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.45)' },
  badge: { position: 'absolute', left: spacing.sm, top: spacing.sm },
  heart: { position: 'absolute', right: 6, top: 6, width: 36, height: 36 },
  body: { padding: spacing.md, gap: 2 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  add: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
