import { Tabs } from 'expo-router';

import { tabIcon, tabScreenOptions } from '@/components/tabs';

export default function AdminTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="overview" options={{ title: 'Overview', tabBarIcon: tabIcon('pulse', 'pulse-outline') }} />
      <Tabs.Screen name="shops" options={{ title: 'Shops', tabBarIcon: tabIcon('storefront', 'storefront-outline') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: tabIcon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: tabIcon('people', 'people-outline') }} />
    </Tabs>
  );
}
