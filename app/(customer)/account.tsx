import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Header, ListGroup, ListItem, Screen } from '@/components/ui';
import { appConfig } from '@/config';
import { useBadges } from '@/hooks/useBadges';
import { useQuery } from '@/hooks/useQuery';
import { favorites, orders } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useDialog } from '@/store/DialogContext';
import { colors, radius, shadow, spacing } from '@/theme';
import { formatPhone } from '@/utils/format';

export default function Account() {
  const { user, signOut } = useAuth();
  const dialog = useDialog();
  const badges = useBadges();
  const past = useQuery(user ? `orders:past:${user.id}` : null, () => orders.listMyOrders('past'), ['orders']);
  const favs = useQuery(user ? `fav-ids:${user.id}` : null, favorites.listFavoriteIds, ['favorites']);
  if (!user) return null;

  const completed = past.data?.filter((o) => o.status === 'completed').length ?? 0;

  const logout = async () => {
    if (await dialog.confirm({ title: 'Log out?', message: 'Your cart will be saved for next time.', confirmLabel: 'Log out', icon: 'log-out-outline' })) await signOut();
  };

  return (
    <Screen header={<Header title="Account" back={false} large />}>
      <Pressable style={styles.profile} onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Edit profile">
        <Avatar name={user.fullName} uri={user.avatarUrl} size={64} />
        <View style={{ flex: 1 }}>
          <AppText variant="h2" numberOfLines={1}>
            {user.fullName}
          </AppText>
          <AppText variant="small">{formatPhone(user.phone)}</AppText>
          <AppText variant="small" numberOfLines={1}>
            {user.email}
          </AppText>
        </View>
        <AppText variant="label" color={colors.primary}>
          Edit
        </AppText>
      </Pressable>

      <View style={styles.stats}>
        <Stat value={completed} label="Orders completed" onPress={() => router.push('/orders')} />
        <Stat value={favs.data?.length ?? 0} label="Favourites" onPress={() => router.push('/favorites')} />
        <Stat value={user.area ?? '—'} label="My area" />
      </View>

      <ListGroup title="Shopping">
        <ListItem icon="receipt-outline" title="My orders" onPress={() => router.push('/orders')} />
        <ListItem icon="heart-outline" title="Favourites" subtitle="Saved products and shops" onPress={() => router.push('/favorites')} />
        <ListItem icon="location-outline" title="Delivery addresses" onPress={() => router.push('/addresses')} />
        <ListItem icon="chatbubble-ellipses-outline" title="Messages" value={badges.messages ? `${badges.messages} new` : undefined} onPress={() => router.push('/messages')} last />
      </ListGroup>

      <ListGroup title="Preferences">
        <ListItem icon="notifications-outline" title="Notifications" value={badges.notifications ? `${badges.notifications} new` : undefined} onPress={() => router.push('/notifications')} />
        <ListItem icon="settings-outline" title="Settings" subtitle="Password, notifications, privacy" onPress={() => router.push('/settings')} last />
      </ListGroup>

      <ListGroup title="Support">
        <ListItem icon="help-buoy-outline" title="Help & support" onPress={() => router.push('/help')} />
        <ListItem icon="information-circle-outline" title={`About ${appConfig.name}`} onPress={() => router.push('/about')} last />
      </ListGroup>

      <ListGroup>
        <ListItem icon="log-out-outline" title="Log out" danger onPress={logout} chevron={false} last />
      </ListGroup>
      <AppText variant="caption" align="center" style={{ marginTop: spacing.lg }}>
        Version {appConfig.version}
      </AppText>
    </Screen>
  );
}

function Stat({ value, label, onPress }: { value: number | string; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'}>
      <AppText variant="h3" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" align="center" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, ...shadow.sm },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  stat: { flex: 1, alignItems: 'center', padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, ...shadow.sm, gap: 2 },
});
