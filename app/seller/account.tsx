import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ShopStatus } from '@/components/ShopCard';
import { AppText, Avatar, Header, ListGroup, ListItem, Screen, SmartImage } from '@/components/ui';
import { appConfig } from '@/config';
import { useBadges } from '@/hooks/useBadges';
import { useQuery } from '@/hooks/useQuery';
import { shop } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useDialog } from '@/store/DialogContext';
import { colors, radius, shadow, spacing } from '@/theme';
import { formatPhone } from '@/utils/format';

export default function SellerAccount() {
  const { user, signOut } = useAuth();
  const dialog = useDialog();
  const badges = useBadges();
  const q = useQuery(user ? `my-shop:${user.id}` : null, shop.getMyShop, ['sellers', 'products']);
  const s = q.data;
  if (!user) return null;

  const logout = async () => {
    if (await dialog.confirm({ title: 'Log out?', message: 'You will stop receiving order alerts on this device until you sign in again.', confirmLabel: 'Log out', icon: 'log-out-outline' })) await signOut();
  };

  return (
    <Screen header={<Header title="My shop" back={false} large />} refreshing={q.refreshing} onRefresh={q.refetch}>
      <View style={styles.card}>
        <SmartImage src={s?.coverUrl} style={styles.cover} fallbackIcon="storefront-outline" />
        <View style={styles.body}>
          <View style={styles.logo}>
            <Avatar name={s?.businessName ?? user.fullName} uri={s?.logoUrl} size={64} ring />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xl }}>
            <AppText variant="h2" numberOfLines={1} style={{ flexShrink: 1 }}>
              {s?.businessName ?? '…'}
            </AppText>
            {s?.verified && <Ionicons name="checkmark-circle" size={20} color={colors.info} />}
          </View>
          <AppText variant="small">
            {user.fullName} · {formatPhone(user.phone)}
          </AppText>
          {s && (
            <View style={styles.meta}>
              <ShopStatus shop={s} />
              <AppText variant="caption">
                ⭐ {s.rating ? s.rating.toFixed(1) : 'New'} · {s.productCount} products · {s.area}
              </AppText>
            </View>
          )}
          {s && !s.verified && (
            <View style={styles.verify}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.info} />
              <AppText variant="small" color="#1D4ED8" style={{ flex: 1 }}>
                Verification pending. Complete your shop profile so our team can verify you.
              </AppText>
            </View>
          )}
        </View>
      </View>

      <ListGroup title="Business">
        <ListItem icon="eye-outline" title="View my shop" subtitle="See your shop as customers do" onPress={() => router.push(`/shop/${user.id}`)} />
        <ListItem icon="create-outline" title="Shop profile & hours" subtitle="Photos, location, delivery, opening hours" onPress={() => router.push('/shop-settings')} />
        <ListItem icon="bar-chart-outline" title="Sales report" onPress={() => router.push('/sales')} />
        <ListItem icon="star-outline" title="Customer reviews" value={s?.ratingCount ? `${s.ratingCount}` : undefined} onPress={() => router.push('/reviews')} last />
      </ListGroup>

      <ListGroup title="Communication">
        <ListItem icon="chatbubble-ellipses-outline" title="Messages" value={badges.messages ? `${badges.messages} new` : undefined} onPress={() => router.push('/messages')} />
        <ListItem icon="notifications-outline" title="Notifications" value={badges.notifications ? `${badges.notifications} new` : undefined} onPress={() => router.push('/notifications')} last />
      </ListGroup>

      <ListGroup title="Account">
        <ListItem icon="person-outline" title="Personal details" onPress={() => router.push('/profile')} />
        <ListItem icon="settings-outline" title="Settings" onPress={() => router.push('/settings')} />
        <ListItem icon="help-buoy-outline" title="Help & support" onPress={() => router.push('/help')} />
        <ListItem icon="information-circle-outline" title={`About ${appConfig.name}`} onPress={() => router.push('/about')} last />
      </ListGroup>

      <ListGroup>
        <ListItem icon="log-out-outline" title="Log out" danger onPress={logout} chevron={false} last />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', ...shadow.sm },
  cover: { width: '100%', height: 110 },
  body: { padding: spacing.lg },
  logo: { position: 'absolute', top: -34, left: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  verify: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.infoLight },
});
