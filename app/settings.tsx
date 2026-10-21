import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppText, Header, ListGroup, ListItem, Screen } from '@/components/ui';
import { appConfig } from '@/config';
import { useLocalList } from '@/hooks/useLocalList';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { spacing } from '@/theme';
import { localStore, storageKeys } from '@/utils/storage';

interface Prefs {
  orderUpdates: boolean;
  messages: boolean;
  stockAlerts: boolean;
  promotions: boolean;
  sms: boolean;
}

const DEFAULTS: Prefs = { orderUpdates: true, messages: true, stockAlerts: true, promotions: false, sms: false };

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const searches = useLocalList(user ? storageKeys.searchHistory(user.id) : null);
  const recent = useLocalList(user ? storageKeys.recentlyViewed(user.id) : null);

  useEffect(() => {
    if (user) localStore.get(storageKeys.preferences(user.id), DEFAULTS).then((p) => setPrefs({ ...DEFAULTS, ...p }));
  }, [user]);

  if (!user) return null;

  const toggle = (k: keyof Prefs) => (value: boolean) => {
    const next = { ...prefs, [k]: value };
    setPrefs(next);
    localStore.set(storageKeys.preferences(user.id), next);
  };

  return (
    <Screen header={<Header title="Settings" />}>
      <ListGroup title="Account">
        <ListItem icon="person-outline" title="Edit profile" onPress={() => router.push('/profile')} />
        <ListItem icon="lock-closed-outline" title="Change password" onPress={() => router.push('/change-password')} last />
      </ListGroup>

      <ListGroup title="Notifications">
        <ListItem icon="receipt-outline" title="Order updates" subtitle="Status changes on your orders" toggle={{ value: prefs.orderUpdates, onChange: toggle('orderUpdates') }} />
        <ListItem icon="chatbubble-outline" title="Messages" toggle={{ value: prefs.messages, onChange: toggle('messages') }} />
        {user.role === 'seller' && <ListItem icon="cube-outline" title="Low-stock alerts" toggle={{ value: prefs.stockAlerts, onChange: toggle('stockAlerts') }} />}
        <ListItem icon="pricetag-outline" title="Offers & news" toggle={{ value: prefs.promotions, onChange: toggle('promotions') }} />
        <ListItem icon="phone-portrait-outline" title="SMS alerts" subtitle="For phones without data — coming soon" toggle={{ value: prefs.sms, onChange: toggle('sms'), disabled: true }} last />
      </ListGroup>

      <ListGroup title="Privacy & data">
        <ListItem
          icon="search-outline"
          title="Clear search history"
          value={searches.items.length ? `${searches.items.length}` : 'Empty'}
          onPress={() => {
            searches.clear();
            toast.show('Search history cleared', 'success');
          }}
          chevron={false}
        />
        <ListItem
          icon="eye-outline"
          title="Clear recently viewed"
          value={recent.items.length ? `${recent.items.length}` : 'Empty'}
          onPress={() => {
            recent.clear();
            toast.show('Recently viewed cleared', 'success');
          }}
          chevron={false}
          last
        />
      </ListGroup>

      <AppText variant="caption" align="center" style={{ marginTop: spacing.xl }}>
        {appConfig.name} v{appConfig.version}
      </AppText>
    </Screen>
  );
}
