import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PriceSummary } from '@/components/orders';
import { AppText, Badge, Button, Card, EmptyState, Header, LoadingView, Screen, SegmentedControl, TextField } from '@/components/ui';
import { useCartDetails } from '@/hooks/useCartDetails';
import { useQuery } from '@/hooks/useQuery';
import { addresses, orders, payments, toApiError } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useCart } from '@/store/CartContext';
import { useToast } from '@/store/ToastContext';
import { colors, radius, spacing } from '@/theme';
import type { Fulfilment, PaymentMethod } from '@/types/models';
import { formatKES, formatPhone } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function Checkout() {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const { readyGroups, loading, refetch } = useCartDetails();
  const addrQ = useQuery(user ? `addresses:${user.id}` : null, addresses.listAddresses, ['addresses']);

  const [fulfilment, setFulfilment] = useState<Record<string, Fulfilment>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [addressId, setAddressId] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [busy, setBusy] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Default: the default saved address; delivery where offered.
  useEffect(() => {
    if (!addressId && addrQ.data?.length) setAddressId(addrQ.data.find((a) => a.isDefault)?.id ?? addrQ.data[0].id);
  }, [addrQ.data, addressId]);

  const modeFor = (sellerId: string, offersDelivery: boolean, offersPickup: boolean): Fulfilment =>
    fulfilment[sellerId] ?? (offersDelivery ? 'delivery' : offersPickup ? 'pickup' : 'delivery');

  const groups = useMemo(
    () =>
      readyGroups.map((g) => {
        const mode = modeFor(g.sellerId, !!g.shop?.offersDelivery, !!g.shop?.offersPickup);
        const fee = mode === 'delivery' ? (g.shop?.deliveryFee ?? 0) : 0;
        return { ...g, mode, fee, total: g.subtotal + fee };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readyGroups, fulfilment],
  );

  const needsAddress = groups.some((g) => g.mode === 'delivery');
  const subtotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const fees = groups.reduce((s, g) => s + g.fee, 0);
  const total = subtotal + fees;

  const place = async () => {
    if (needsAddress && !addressId) {
      setAddressError('Add a delivery address, or switch to pickup.');
      haptic.error();
      return;
    }
    setBusy(true);
    try {
      const placed = await orders.placeOrders({
        groups: groups.map((g) => ({
          sellerId: g.sellerId,
          fulfilment: g.mode,
          note: notes[g.sellerId],
          items: g.orderable.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        })),
        addressId: needsAddress ? addressId : undefined,
        paymentMethod: method,
      });
      groups.forEach((g) => g.orderable.forEach((i) => cart.remove(i.productId)));
      haptic.success();
      router.replace({ pathname: '/order-success', params: { ids: placed.map((o) => o.id).join(',') } });
    } catch (e) {
      const err = toApiError(e);
      haptic.error();
      toast.show(err.message, 'error');
      if (err.field === 'address') setAddressError(err.message);
      refetch(); // stock or prices may have changed
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen header={<Header title="Checkout" />} scroll={false}><LoadingView /></Screen>;
  if (!groups.length) {
    return (
      <Screen header={<Header title="Checkout" />} scroll={false}>
        <EmptyState icon="cart-outline" title="Nothing to check out" message="Items in your cart can't be ordered right now." actionLabel="Back to cart" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen
      header={<Header title="Checkout" subtitle={groups.length > 1 ? `${groups.length} orders from ${groups.length} shops` : groups[0].shop?.businessName} />}
      keyboard
      footer={
        <View style={{ gap: spacing.sm }}>
          <View style={styles.rowBetween}>
            <AppText variant="body">Total to pay</AppText>
            <AppText variant="h2" color={colors.primaryDark}>
              {formatKES(total)}
            </AppText>
          </View>
          <Button title={`Place order${groups.length > 1 ? 's' : ''}`} size="lg" fullWidth loading={busy} icon="checkmark-circle-outline" onPress={place} />
        </View>
      }
    >
      {/* Per-shop fulfilment */}
      {groups.map((g) => (
        <Card key={g.sellerId} style={{ marginBottom: spacing.md }}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
              <Ionicons name="storefront" size={18} color={colors.primary} />
              <AppText variant="title" numberOfLines={1} style={{ flex: 1 }}>
                {g.shop?.businessName}
              </AppText>
            </View>
            <AppText variant="small">{g.orderable.length} item{g.orderable.length > 1 ? 's' : ''}</AppText>
          </View>
          {g.orderable.map((i) => (
            <View key={i.productId} style={[styles.rowBetween, { marginTop: spacing.sm }]}>
              <AppText variant="small" numberOfLines={1} style={{ flex: 1 }}>
                {i.quantity} × {i.product?.name}
              </AppText>
              <AppText variant="small" color={colors.text}>
                {formatKES(i.lineTotal)}
              </AppText>
            </View>
          ))}

          <View style={{ marginTop: spacing.lg }}>
            {g.shop?.offersDelivery && g.shop.offersPickup ? (
              <SegmentedControl
                value={g.mode}
                onChange={(m) => setFulfilment((f) => ({ ...f, [g.sellerId]: m }))}
                segments={[
                  { value: 'delivery', label: `Delivery · ${g.shop.deliveryFee ? formatKES(g.shop.deliveryFee) : 'Free'}` },
                  { value: 'pickup', label: 'Pickup · Free' },
                ]}
              />
            ) : (
              <Badge label={g.mode === 'delivery' ? `Delivery only · ${formatKES(g.fee)}` : 'Pickup only'} tone="info" icon={g.mode === 'delivery' ? 'bicycle-outline' : 'walk-outline'} size="md" />
            )}
            {g.mode === 'pickup' && (
              <View style={styles.pickupBox}>
                <Ionicons name="location" size={16} color={colors.primary} />
                <AppText variant="small" style={{ flex: 1 }}>
                  Collect at {g.shop?.addressLine}, {g.shop?.area}
                  {g.shop?.landmark ? ` (${g.shop.landmark})` : ''}
                </AppText>
              </View>
            )}
          </View>

          <View style={{ marginTop: spacing.md, marginBottom: -spacing.lg }}>
            <TextField
              placeholder="Note to seller (optional), e.g. ripe tomatoes please"
              icon="create-outline"
              value={notes[g.sellerId] ?? ''}
              onChangeText={(t) => setNotes((n) => ({ ...n, [g.sellerId]: t }))}
              maxLength={300}
            />
          </View>
        </Card>
      ))}

      {/* Address */}
      {needsAddress && (
        <>
          <AppText variant="h3" style={styles.section}>
            Delivery address
          </AppText>
          {addrQ.data?.map((a) => {
            const on = a.id === addressId;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  setAddressId(a.id);
                  setAddressError(null);
                }}
                style={[styles.option, on && styles.optionOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
              >
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <AppText variant="title">
                    {a.label} · {a.area}
                  </AppText>
                  <AppText variant="small">{a.addressLine}</AppText>
                  <AppText variant="caption">
                    {a.landmark ? `${a.landmark} · ` : ''}
                    {formatPhone(a.phone)}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
          <Button title="Add new address" variant="ghost" icon="add-circle-outline" onPress={() => router.push('/address-form')} style={{ alignSelf: 'flex-start' }} />
          {addressError && (
            <AppText variant="small" color={colors.danger}>
              {addressError}
            </AppText>
          )}
        </>
      )}

      {/* Payment */}
      <AppText variant="h3" style={styles.section}>
        Payment method
      </AppText>
      {payments.paymentProviders.map((p) => {
        const on = p.method === method;
        const mode: Fulfilment = groups.every((g) => g.mode === 'pickup') ? 'pickup' : 'delivery';
        return (
          <Pressable
            key={p.method}
            disabled={!p.available}
            onPress={() => setMethod(p.method)}
            style={[styles.option, on && styles.optionOn, !p.available && { opacity: 0.6 }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !p.available }}
          >
            <View style={[styles.payIcon, p.method === 'mpesa' && { backgroundColor: '#E8F7EC' }]}>
              <Ionicons name={p.icon as keyof typeof Ionicons.glyphMap} size={22} color={p.method === 'mpesa' ? '#16A34A' : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="title">{p.label(mode)}</AppText>
              <AppText variant="small">{p.description(mode)}</AppText>
            </View>
            {p.available ? (
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.textMuted} />
            ) : (
              <Badge label={p.unavailableReason ?? 'Unavailable'} tone="neutral" />
            )}
          </Pressable>
        );
      })}

      {/* Summary */}
      <AppText variant="h3" style={styles.section}>
        Order summary
      </AppText>
      <Card>
        <PriceSummary subtotal={subtotal} deliveryFee={fees} total={total} />
      </Card>
      <AppText variant="caption" align="center" style={{ marginTop: spacing.md }}>
        Prices and stock are confirmed by the shop when your order is accepted.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  section: { marginTop: spacing.xl, marginBottom: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.sm },
  optionOn: { borderColor: colors.primary, backgroundColor: '#F6FCF8' },
  payIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  pickupBox: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.primaryLight, borderRadius: radius.md },
});
