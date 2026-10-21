import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { IMAGES } from '@/data/images';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme';

const SLIDES = [
  {
    key: 'fresh',
    image: IMAGES.marketNairobi,
    icon: 'leaf' as const,
    title: 'Fresh produce from your local mama mboga',
    body: 'Browse sukuma, tomatoes, fruits and more from trusted sellers in your estate.',
  },
  {
    key: 'order',
    image: IMAGES.tomatoes,
    icon: 'bicycle' as const,
    title: 'Order in seconds, delivered or ready for pickup',
    body: 'Add to cart, choose delivery or pickup, and track your order every step of the way.',
  },
  {
    key: 'grow',
    image: IMAGES.vendors,
    icon: 'trending-up' as const,
    title: 'Sell more, track every shilling',
    body: 'Are you a mama mboga? Manage stock, receive orders and see your daily sales — all in one place.',
  },
];

export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  const imageHeight = Math.round(height * 0.5);
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);
  const last = index === SLIDES.length - 1;

  const goTo = (next: number) => {
    setIndex(next);
    list.current?.scrollToOffset({ offset: next * width, animated: true });
  };

  const finish = async (to: '/login' | '/register') => {
    await completeOnboarding();
    router.replace(to);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <FlatList
        ref={list}
        data={SLIDES}
        style={{ flex: 1 }}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
        }}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <View style={{ height: imageHeight }}>
              <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
              <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', colors.background]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.textBlock}>
              <View style={styles.iconBadge}>
                <Ionicons name={item.icon} size={24} color={colors.white} />
              </View>
              <AppText variant="h1" style={{ marginTop: spacing.lg }}>
                {item.title}
              </AppText>
              <AppText variant="body" style={{ marginTop: spacing.sm, fontSize: 16, lineHeight: 24 }}>
                {item.body}
              </AppText>
            </View>
          </View>
        )}
      />

      <Pressable onPress={() => finish('/login')} style={[styles.skip, { top: insets.top + spacing.sm }]} accessibilityRole="button" hitSlop={10}>
        <AppText variant="label" color={colors.white}>
          Skip
        </AppText>
      </Pressable>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        {last ? (
          <View style={{ gap: spacing.md }}>
            <Button title="Create an account" size="lg" onPress={() => finish('/register')} fullWidth />
            <Button title="I already have an account" variant="outline" size="lg" onPress={() => finish('/login')} fullWidth />
          </View>
        ) : (
          <Button
            title="Next"
            size="lg"
            iconRight="arrow-forward"
            fullWidth
            onPress={() => goTo(Math.min(index + 1, SLIDES.length - 1))}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  textBlock: { paddingHorizontal: spacing.xxl, marginTop: -spacing.xxl },
  iconBadge: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  skip: { position: 'absolute', right: spacing.lg, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  footer: { paddingHorizontal: spacing.xxl, gap: spacing.xl },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 26, backgroundColor: colors.primary },
});
