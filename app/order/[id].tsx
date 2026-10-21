import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { OrderStatusBadge, OrderTimeline, PriceSummary } from '@/components/orders';
import { AppText, Avatar, Badge, Button, Card, ErrorState, Header, IconButton, LoadingView, Screen, SmartImage } from '@/components/ui';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { catalog, messages, orders, payments } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useCart } from '@/store/CartContext';
import { useDialog } from '@/store/DialogContext';
import { useToast } from '@/store/ToastContext';
import { colors, radius, spacing } from '@/theme';
import type { OrderDetails, OrderStatus } from '@/types/models';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, formatDateTime, formatKES, formatPhone, unitLabel } from '@/utils/format';

const NEXT_ACTION: Partial<Record<OrderStatus, { next: OrderStatus; label: (o: OrderDetails) => string; icon: keyof typeof Ionicons.glyphMap }>> = {
  accepted: { next: 'preparing', label: () => 'Start preparing', icon: 'basket-outline' },
  preparing: { next: 'ready', label: (o) => (o.fulfilment === 'pickup' ? 'Ready for pickup' : 'Mark as packed'), icon: 'bag-check-outline' },
  ready: { next: 'out_for_delivery', label: () => 'Send out for delivery', icon: 'bicycle-outline' },
  out_for_delivery: { next: 'completed', label: () => 'Mark as delivered & paid', icon: 'checkmark-done-outline' },
};

const REJECT_REASONS = ['Some items are out of stock', 'Shop is closing for the day', 'Cannot deliver to this area', 'Order is too large'];
const CANCEL_REASONS = ['Ordered by mistake', 'I want to change my order', 'It is taking too long', 'Found it elsewhere'];

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const cart = useCart();

  const q = useQuery(`order:${id}`, () => orders.getOrder(id), ['orders', 'payments']);
  const payQ = useQuery(`payment:${id}`, () => payments.getPaymentForOrder(id), ['payments']);
  const o = q.data;

  const statusM = useMutation((next: OrderStatus, reason?: string) => orders.updateOrderStatus(id, next, reason), {
    success: (r) => `Order ${r.code} updated`,
  });
  const cancelM = useMutation((reason: string) => orders.cancelOrder(id, reason), { success: 'Order cancelled' });
  const chatM = useMutation(async () =>
    user?.role === 'seller' ? messages.openConversationWithCustomer(o!.customerId) : messages.openConversationWithShop(o!.sellerId),
  );

  if (q.loading) return <Screen header={<Header title="Order" />} scroll={false}><LoadingView /></Screen>;
  if (!o) return <Screen header={<Header title="Order" />} scroll={false}><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;

  const isSeller = user?.role === 'seller' && user.id === o.sellerId;
  const isCustomer = user?.role === 'customer' && user.id === o.customerId;
  const busy = statusM.busy || cancelM.busy;

  const accept = async () => {
    if (await dialog.confirm({ title: 'Accept this order?', message: `Stock for ${o.items.length} item${o.items.length > 1 ? 's' : ''} will be reserved for ${o.customerName}.`, confirmLabel: 'Accept order', icon: 'checkmark-circle-outline' }))
      statusM.run('accepted');
  };
  const reject = async () => {
    const reason = await dialog.prompt({ title: 'Decline order?', message: 'Let the customer know why.', suggestions: REJECT_REASONS, confirmLabel: 'Decline', destructive: true, required: true, placeholder: 'Reason…' });
    if (reason) statusM.run('rejected', reason);
  };
  const sellerCancel = async () => {
    const reason = await dialog.prompt({ title: 'Cancel order?', message: 'Reserved stock will be returned to your inventory.', suggestions: REJECT_REASONS, confirmLabel: 'Cancel order', cancelLabel: 'Keep order', destructive: true, required: true });
    if (reason) statusM.run('cancelled', reason);
  };
  const customerCancel = async () => {
    const reason = await dialog.prompt({ title: 'Cancel your order?', message: 'The shop has not accepted it yet, so you can cancel for free.', suggestions: CANCEL_REASONS, confirmLabel: 'Cancel order', cancelLabel: 'Keep order', destructive: true, required: true });
    if (reason) cancelM.run(reason);
  };
  const advance = async () => {
    const a = NEXT_ACTION[o.status];
    if (!a) return;
    const next = o.status === 'ready' && o.fulfilment === 'pickup' ? 'completed' : a.next;
    if (next === 'completed') {
      const ok = await dialog.confirm({ title: 'Complete this order?', message: `Confirm the customer has received the order and paid ${formatKES(o.total)} in cash.`, confirmLabel: 'Yes, completed', icon: 'cash-outline' });
      if (!ok) return;
    }
    statusM.run(next);
  };
  const reorder = async () => {
    try {
      const live = await catalog.getProductsByIds(o.items.map((i) => i.productId));
      let added = 0;
      for (const item of o.items) {
        const p = live.find((x) => x.id === item.productId);
        if (p && (p.stockState === 'in_stock' || p.stockState === 'low_stock')) {
          if (cart.add(p, item.quantity).quantity > 0) added++;
        }
      }
      if (!added) return toast.show('None of these items are available right now.', 'error');
      toast.show(added === o.items.length ? 'All items added to your cart' : `${added} of ${o.items.length} items added (others unavailable)`, 'success');
      router.push('/cart');
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  };
  const openChat = async () => {
    const conv = await chatM.run();
    if (conv) router.push(`/messages/${conv}`);
  };

  const nextAction = NEXT_ACTION[o.status];
  const pickupComplete = o.status === 'ready' && o.fulfilment === 'pickup';

  let footer: ReactNode;
  if (isSeller && o.status === 'pending') {
    footer = (
      <View style={styles.footerRow}>
        <Button title="Decline" variant="danger" style={{ flex: 1 }} onPress={reject} disabled={busy} />
        <Button title="Accept order" icon="checkmark" style={{ flex: 2 }} onPress={accept} loading={statusM.busy} />
      </View>
    );
  } else if (isSeller && nextAction) {
    footer = (
      <View style={styles.footerRow}>
        {(o.status === 'accepted' || o.status === 'preparing') && <Button title="Cancel" variant="danger" style={{ flex: 1 }} onPress={sellerCancel} disabled={busy} />}
        <Button
          title={pickupComplete ? 'Collected & paid' : nextAction.label(o)}
          icon={pickupComplete ? 'checkmark-done-outline' : nextAction.icon}
          style={{ flex: 2 }}
          onPress={advance}
          loading={statusM.busy}
        />
      </View>
    );
  } else if (isCustomer && o.status === 'pending') {
    footer = <Button title="Cancel order" variant="danger" fullWidth onPress={customerCancel} loading={cancelM.busy} />;
  } else if (isCustomer && ['completed', 'cancelled', 'rejected'].includes(o.status)) {
    footer = (
      <View style={styles.footerRow}>
        {o.status === 'completed' && !o.reviewed && <Button title="Rate order" icon="star-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/review/${o.id}`)} />}
        <Button title="Order again" icon="refresh" style={{ flex: 1 }} onPress={reorder} />
      </View>
    );
  }

  const party = isSeller || user?.role === 'admin'
    ? { title: 'Customer', name: o.customerName, phone: o.customerPhone, sub: formatPhone(o.customerPhone), uri: undefined }
    : { title: 'Shop', name: o.shopName, phone: o.shopPhone, sub: `${o.shopArea} · ${formatPhone(o.shopPhone)}`, uri: o.shopLogoUrl };

  return (
    <Screen
      header={<Header title={`Order ${o.code}`} subtitle={formatDateTime(o.createdAt)} />}
      footer={footer}
      refreshing={q.refreshing}
      onRefresh={q.refetch}
    >
      <Card>
        <View style={styles.rowBetween}>
          <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} size="md" />
          <Badge label={o.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'} icon={o.fulfilment === 'delivery' ? 'bicycle-outline' : 'walk-outline'} tone="neutral" size="md" />
        </View>
        <View style={{ marginTop: spacing.xl }}>
          <OrderTimeline status={o.status} fulfilment={o.fulfilment} history={o.history} />
        </View>
      </Card>

      <Card style={styles.gap}>
        <AppText variant="caption" style={styles.cardLabel}>
          {party.title.toUpperCase()}
        </AppText>
        <View style={styles.party}>
          <Avatar name={party.name} uri={party.uri} size={48} />
          <View style={{ flex: 1 }}>
            <AppText variant="title">{party.name}</AppText>
            <AppText variant="small">{party.sub}</AppText>
          </View>
          {user?.role !== 'admin' && (
            <>
              <IconButton icon="chatbubble-ellipses-outline" label={`Message ${party.name}`} variant="soft" onPress={openChat} />
              <IconButton icon="call-outline" label={`Call ${party.name}`} variant="soft" onPress={() => Linking.openURL(`tel:${party.phone}`)} style={{ marginLeft: spacing.sm }} />
            </>
          )}
        </View>
        {isCustomer && (
          <Button title="Visit shop" variant="ghost" size="sm" iconRight="chevron-forward" onPress={() => router.push(`/shop/${o.sellerId}`)} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }} />
        )}
      </Card>

      <Card style={styles.gap}>
        <AppText variant="caption" style={styles.cardLabel}>
          {o.fulfilment === 'delivery' ? 'DELIVER TO' : 'PICKUP FROM'}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Ionicons name="location" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            {o.fulfilment === 'delivery' && o.deliveryAddress ? (
              <>
                <AppText variant="title">
                  {o.deliveryAddress.label} · {o.deliveryAddress.area}
                </AppText>
                <AppText variant="small">{o.deliveryAddress.addressLine}</AppText>
                {!!o.deliveryAddress.landmark && <AppText variant="caption">{o.deliveryAddress.landmark}</AppText>}
                <AppText variant="caption">Contact: {formatPhone(o.deliveryAddress.phone)}</AppText>
              </>
            ) : (
              <>
                <AppText variant="title">{o.shopName}</AppText>
                <AppText variant="small">
                  {o.shopAddress}, {o.shopArea}
                </AppText>
              </>
            )}
          </View>
        </View>
        {!!o.note && (
          <View style={styles.note}>
            <Ionicons name="chatbox-outline" size={16} color={colors.textSecondary} />
            <AppText variant="small" style={{ flex: 1 }}>
              "{o.note}"
            </AppText>
          </View>
        )}
      </Card>

      <Card style={styles.gap}>
        <AppText variant="caption" style={styles.cardLabel}>
          ITEMS ({o.items.length})
        </AppText>
        {o.items.map((i) => (
          <View key={i.id} style={styles.item}>
            <SmartImage src={i.imageUrl} style={styles.itemImg} />
            <View style={{ flex: 1 }}>
              <AppText variant="title" numberOfLines={1}>
                {i.productName}
              </AppText>
              <AppText variant="caption">
                {i.quantity} {unitLabel(i.unit, i.quantity)} × {formatKES(i.unitPrice)}
              </AppText>
            </View>
            <AppText variant="bodyStrong">{formatKES(i.lineTotal)}</AppText>
          </View>
        ))}
        <View style={{ marginTop: spacing.md }}>
          <PriceSummary subtotal={o.subtotal} deliveryFee={o.deliveryFee} total={o.total} fulfilment={o.fulfilment} />
        </View>
      </Card>

      <Card style={styles.gap}>
        <AppText variant="caption" style={styles.cardLabel}>
          PAYMENT
        </AppText>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name={o.paymentMethod === 'mpesa' ? 'phone-portrait-outline' : 'cash-outline'} size={20} color={colors.primary} />
            <AppText variant="title">
              {PAYMENT_METHOD_LABEL[o.paymentMethod]} {o.paymentMethod === 'cash' ? (o.fulfilment === 'delivery' ? 'on delivery' : 'at pickup') : ''}
            </AppText>
          </View>
          <Badge
            label={PAYMENT_STATUS_LABEL[payQ.data?.status ?? o.paymentStatus]}
            tone={(payQ.data?.status ?? o.paymentStatus) === 'paid' ? 'success' : o.status === 'cancelled' || o.status === 'rejected' ? 'neutral' : 'warning'}
          />
        </View>
        {payQ.data?.reference && <AppText variant="caption" style={{ marginTop: spacing.sm }}>Ref: {payQ.data.reference}</AppText>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  cardLabel: { fontWeight: '700', letterSpacing: 0.6, marginBottom: spacing.md },
  party: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  note: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.muted, borderRadius: radius.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  itemImg: { width: 48, height: 48, borderRadius: radius.md },
  footerRow: { flexDirection: 'row', gap: spacing.md },
});
