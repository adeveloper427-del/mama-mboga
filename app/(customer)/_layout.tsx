import { Tabs } from 'expo-router';

import { tabIcon, tabScreenOptions } from '@/components/tabs';
import { useBadges } from '@/hooks/useBadges';
import { useCart } from '@/store/CartContext';

export default function CustomerTabs() {
  const { itemCount } = useCart();
  const badges = useBadges();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="browse" options={{ title: 'Categories', tabBarIcon: tabIcon('grid', 'grid-outline') }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarIcon: tabIcon('cart', 'cart-outline'), tabBarBadge: itemCount || undefined }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: tabIcon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon('person', 'person-outline'), tabBarBadge: badges.messages || undefined }} />
    </Tabs>
  );
}
