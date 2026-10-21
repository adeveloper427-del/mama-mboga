import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme';
import type { OrderDetails, OrderStatus, StatusEvent } from '@/types/models';
import { ORDER_STATUS_LABEL, formatKES, formatTime, pluralize, timeAgo } from '@/utils/format';

import { AppText, Avatar, Badge, SmartImage, type Tone } from './ui';

type IconName = keyof typeof Ionicons.glyphMap;

export const STATUS_STYLE: Record<OrderStatus, { tone: Tone; icon: IconName }> = {
  pending: { tone: 'warning', icon: 'time-outline' },
  accepted: { tone: 'info', icon: 'thumbs-up-outline' },
  preparing: { tone: 'purple', icon: 'basket-outline' },
  ready: { tone: 'accent', icon: 'bag-check-outline' },
  out_for_delivery: { tone: 'info', icon: 'bicycle-outline' },
  completed: { tone: 'success', icon: 'checkmark-done-outline' },
  rejected: { tone: 'danger', icon: 'close-circle-outline' },
  cancelled: { tone: 'neutral', icon: 'ban-outline' },
};

export function OrderStatusBadge({ status, fulfilment, size = 'sm' }: { status: OrderStatus; fulfilment?: string; size?: 'sm' | 'md' }) {
  const s = STATUS_STYLE[status];
  const label = status === 'ready' && fulfilment === 'pickup' ? 'Ready for pickup' : ORDER_STATUS_LABEL[status];
  return <Badge label={label} tone={s.tone} icon={s.icon} size={size} />;
}

interface CardProps {
  order: OrderDetails;
  perspective: 'customer' | 'seller' | 'admin';
}

export const OrderCard = memo(function OrderCard({ order, perspective }: CardProps) {
  const name = perspective === 'customer' ? order.shopName : perspective === 'seller' ? order.customerName : `${order.customerName} → ${order.shopName}`;
  const itemsText = order.items
    .slice(0, 3)
    .map((i) => `${i.quantity}× ${i.productName}`)
    .join(', ');
  const extra = order.items.length > 3 ? ` +${order.items.length - 3} more` : '';
  const isNew = perspective === 'seller' && order.status === 'pending';

  return (
    <Pressable
      onPress={() => router.push(`/order/${order.id}`)}
      style={({ pressed }) => [styles.card, isNew && styles.newCard, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.code}, ${ORDER_STATUS_LABEL[order.status]}, ${formatKES(order.total)}`}
    >
      <View style={styles.top}>
        {perspective === 'customer' ? (
          <SmartImage src={order.shopLogoUrl} style={styles.thumb} fallbackIcon="storefront-outline" />
        ) : (
          <Avatar name={order.customerName} size={44} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="caption">
            {order.code} · {timeAgo(order.createdAt)}
          </AppText>
        </View>
        <OrderStatusBadge status={order.status} fulfilment={order.fulfilment} />
      </View>
      <AppText variant="small" numberOfLines={2} style={styles.items}>
        {itemsText}
        {extra}
      </AppText>
      <View style={styles.bottom}>
        <View style={styles.method}>
          <Ionicons name={order.fulfilment === 'delivery' ? 'bicycle-outline' : 'walk-outline'} size={15} color={colors.textMuted} />
          <AppText variant="caption">
            {order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'} · {pluralize(order.items.length, 'item')}
          </AppText>
        </View>
        <AppText variant="bodyStrong">{formatKES(order.total)}</AppText>
      </View>
    </Pressable>
  );
});

// ─── Timeline ───────────────────────────────────────────────────────────────

const STEP_TEXT: Partial<Record<OrderStatus, { title: string; delivery?: string; pickup?: string }>> = {
  pending: { title: 'Order placed', delivery: 'Waiting for the seller to confirm', pickup: 'Waiting for the seller to confirm' },
  accepted: { title: 'Accepted', delivery: 'The seller confirmed your order', pickup: 'The seller confirmed your order' },
  preparing: { title: 'Preparing', delivery: 'Your produce is being picked and packed', pickup: 'Your produce is being picked and packed' },
  ready: { title: 'Ready', delivery: 'Packed and waiting for the rider', pickup: 'Ready to collect at the shop' },
  out_for_delivery: { title: 'Out for delivery', delivery: 'On the way to you' },
  completed: { title: 'Completed', delivery: 'Delivered — enjoy!', pickup: 'Collected — enjoy!' },
};

export function OrderTimeline({ status, fulfilment, history }: { status: OrderStatus; fulfilment: 'delivery' | 'pickup'; history: StatusEvent[] }) {
  if (status === 'cancelled' || status === 'rejected') {
    const ev = history.find((h) => h.status === status);
    return (
      <View style={styles.cancelBox}>
        <Ionicons name={status === 'rejected' ? 'close-circle' : 'ban'} size={28} color={colors.danger} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{status === 'rejected' ? 'Declined by the seller' : 'Order cancelled'}</AppText>
          {!!ev?.note && <AppText variant="small">Reason: {ev.note}</AppText>}
          {ev && <AppText variant="caption">{timeAgo(ev.at)}</AppText>}
        </View>
      </View>
    );
  }

  const steps: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', ...(fulfilment === 'delivery' ? (['out_for_delivery'] as const) : []), 'completed'];
  const current = steps.indexOf(status);

  return (
    <View accessibilityLabel={`Order progress: ${ORDER_STATUS_LABEL[status]}`}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const at = history.find((h) => h.status === s)?.at;
        const text = STEP_TEXT[s]!;
        const color = done || active ? colors.primary : colors.border;
        return (
          <View key={s} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.dot, { borderColor: color, backgroundColor: done ? colors.primary : active ? colors.card : colors.card }]}>
                {done && <Ionicons name="checkmark" size={12} color={colors.white} />}
                {active && <View style={styles.activeDot} />}
              </View>
              {i < steps.length - 1 && <View style={[styles.line, { backgroundColor: done ? colors.primary : colors.border }]} />}
            </View>
            <View style={styles.stepBody}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <AppText variant={active ? 'bodyStrong' : 'body'} color={done || active ? colors.text : colors.textMuted}>
                  {s === 'ready' && fulfilment === 'pickup' ? 'Ready for pickup' : text.title}
                </AppText>
                {at && <AppText variant="caption">{formatTime(at)}</AppText>}
              </View>
              {active && <AppText variant="small">{fulfilment === 'delivery' ? text.delivery : text.pickup}</AppText>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Price summary ──────────────────────────────────────────────────────────

export function PriceSummary({ subtotal, deliveryFee, total, fulfilment }: { subtotal: number; deliveryFee: number; total: number; fulfilment?: 'delivery' | 'pickup' }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Row label="Subtotal" value={formatKES(subtotal)} />
      <Row
        label="Delivery fee"
        value={fulfilment === 'pickup' ? 'Pickup — free' : deliveryFee === 0 ? 'Free' : formatKES(deliveryFee)}
      />
      <View style={styles.sep} />
      <View style={styles.sumRow}>
        <AppText variant="h3">Total</AppText>
        <AppText variant="h3" color={colors.primaryDark}>
          {formatKES(total)}
        </AppText>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sumRow}>
      <AppText variant="body">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm },
  newCard: { borderLeftWidth: 4, borderLeftColor: colors.accent },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 44, height: 44, borderRadius: radius.md },
  items: { marginTop: spacing.md },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  method: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  line: { width: 2, flex: 1, minHeight: 22, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: spacing.lg, gap: 2 },
  cancelBox: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.dangerLight, padding: spacing.lg, borderRadius: radius.md },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.xs },
});
