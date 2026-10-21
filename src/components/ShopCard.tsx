import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme';
import type { Shop } from '@/types/models';
import { formatKES } from '@/utils/format';

import { AppText, Avatar, Badge, SmartImage } from './ui';

export function ShopStatus({ shop }: { shop: Shop }) {
  if (!shop.acceptingOrders) return <Badge label="Not taking orders" tone="danger" dot />;
  return shop.isOpenNow ? <Badge label="Open now" tone="success" dot /> : <Badge label="Closed now" tone="neutral" dot />;
}

/** Shop card: "wide" for horizontal carousels, "row" for vertical lists. */
export const ShopCard = memo(function ShopCard({ shop, variant = 'wide' }: { shop: Shop; variant?: 'wide' | 'row' }) {
  const open = () => router.push(`/shop/${shop.id}`);
  const label = `${shop.businessName}, ${shop.area}, rated ${shop.rating || 'new'}`;

  if (variant === 'row') {
    return (
      <Pressable onPress={open} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={label}>
        <Avatar name={shop.businessName} uri={shop.logoUrl ?? shop.coverUrl} size={56} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.titleRow}>
            <AppText variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
              {shop.businessName}
            </AppText>
            {shop.verified && <Ionicons name="checkmark-circle" size={16} color={colors.info} accessibilityLabel="Verified" />}
          </View>
          <Meta shop={shop} />
          <ShopStatus shop={shop} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.wide, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel={label}>
      <SmartImage src={shop.coverUrl} style={styles.cover} fallbackIcon="storefront-outline" />
      <View style={styles.statusPos}>
        <ShopStatus shop={shop} />
      </View>
      <View style={styles.wideBody}>
        <View style={styles.avatarPos}>
          <Avatar name={shop.businessName} uri={shop.logoUrl} size={48} ring />
        </View>
        <View style={styles.titleRow}>
          <AppText variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
            {shop.businessName}
          </AppText>
          {shop.verified && <Ionicons name="checkmark-circle" size={16} color={colors.info} />}
        </View>
        <Meta shop={shop} />
      </View>
    </Pressable>
  );
});

function Meta({ shop }: { shop: Shop }) {
  return (
    <View style={styles.meta}>
      <Ionicons name="star" size={13} color="#F5A524" />
      <AppText variant="caption" color={colors.text} style={{ fontWeight: '600' }}>
        {shop.rating ? shop.rating.toFixed(1) : 'New'}
      </AppText>
      {shop.ratingCount > 0 && <AppText variant="caption">({shop.ratingCount})</AppText>}
      <AppText variant="caption">·</AppText>
      <Ionicons name="location-outline" size={13} color={colors.textMuted} />
      <AppText variant="caption" numberOfLines={1}>
        {shop.area}
      </AppText>
      <AppText variant="caption">·</AppText>
      <AppText variant="caption" numberOfLines={1}>
        {shop.offersDelivery ? (shop.deliveryFee ? `${formatKES(shop.deliveryFee)} delivery` : 'Free delivery') : 'Pickup only'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { width: 270, backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sm },
  cover: { width: '100%', height: 110 },
  statusPos: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  wideBody: { padding: spacing.md, paddingTop: spacing.xxl, gap: 4 },
  avatarPos: { position: 'absolute', top: -26, left: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, ...shadow.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
});
