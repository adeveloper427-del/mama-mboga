import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, gradients, radius, spacing } from '@/theme';
import type { Category } from '@/types/models';

import { AppText, SmartImage } from './ui';

/** Round icon + label, for the horizontal category row on Home. */
export function CategoryBubble({ category }: { category: Category }) {
  return (
    <Pressable
      onPress={() => router.push(`/category/${category.id}`)}
      style={({ pressed }) => [styles.bubble, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={category.name}
    >
      <View style={[styles.circle, { backgroundColor: category.tint }]}>
        <SmartImage src={category.imageUrl} style={styles.circleImg} />
      </View>
      <AppText variant="caption" color={colors.text} align="center" numberOfLines={2} style={styles.bubbleText}>
        {category.name}
      </AppText>
    </Pressable>
  );
}

/** Large photo tile for the Categories screen. */
export function CategoryTile({ category, count }: { category: Category; count?: number }) {
  return (
    <Pressable
      onPress={() => router.push(`/category/${category.id}`)}
      style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${category.name}${count !== undefined ? `, ${count} products` : ''}`}
    >
      <SmartImage src={category.imageUrl} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={gradients.fade} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} />
      <View style={[styles.iconChip, { backgroundColor: category.tint }]}>
        <Ionicons name={category.icon as keyof typeof Ionicons.glyphMap} size={16} color={category.color} />
      </View>
      <View style={styles.tileText}>
        <AppText variant="h3" color={colors.white} numberOfLines={1}>
          {category.name}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.85)">
          {category.swahili}
          {count !== undefined ? ` · ${count} items` : ''}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: { width: 78, alignItems: 'center', gap: spacing.xs + 2 },
  circle: { width: 66, height: 66, borderRadius: 33, padding: 3 },
  circleImg: { width: 60, height: 60, borderRadius: 30 },
  bubbleText: { fontWeight: '600', lineHeight: 14 },
  tile: { flex: 1, height: 150, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.muted },
  iconChip: { position: 'absolute', top: spacing.sm, left: spacing.sm, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tileText: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
});
