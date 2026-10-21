import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { orders } from '@/services';
import { colors, spacing } from '@/theme';
import { formatKES } from '@/utils/format';

export default function OrderSuccess() {
  const { ids = '' } = useLocalSearchParams<{ ids: string }>();
  const idList = ids.split(',').filter(Boolean);
  const q = useQuery(`placed:${ids}`, () => Promise.all(idList.map((id) => orders.getOrder(id))), ['orders']);
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [scale]);

  const placed = q.data ?? [];

  return (
    <Screen
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            title={placed.length > 1 ? 'View my orders' : 'Track order'}
            size="lg"
            fullWidth
            icon="navigate-outline"
            onPress={() => (placed.length === 1 ? router.replace(`/order/${placed[0].id}`) : router.replace('/orders'))}
          />
          <Button title="Continue shopping" variant="ghost" fullWidth onPress={() => router.replace('/home')} />
        </View>
      }
    >
      <View style={styles.center}>
        <Animated.View style={[styles.ring, { transform: [{ scale }] }]}>
          <View style={styles.circle}>
            <Ionicons name="checkmark" size={56} color={colors.white} />
          </View>
        </Animated.View>
        <AppText variant="h1" align="center" style={{ marginTop: spacing.xxl }}>
          Order placed!
        </AppText>
        <AppText variant="body" align="center" style={{ marginTop: spacing.sm, maxWidth: 320 }}>
          {placed.length > 1
            ? `We've sent ${placed.length} orders to the shops. You'll be notified as each one is accepted.`
            : "We've sent your order to the shop. You'll get a notification as soon as it's accepted."}
        </AppText>
      </View>

      {placed.map((o) => (
        <Card key={o.id} style={{ marginTop: spacing.md }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <AppText variant="title">{o.shopName}</AppText>
              <AppText variant="caption">
                {o.code} · {o.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'} · Pay {o.fulfilment === 'delivery' ? 'on delivery' : 'at pickup'}
              </AppText>
            </View>
            <AppText variant="bodyStrong">{formatKES(o.total)}</AppText>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', marginTop: spacing.xxxl, marginBottom: spacing.lg },
  ring: { width: 132, height: 132, borderRadius: 66, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
