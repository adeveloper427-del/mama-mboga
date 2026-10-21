import { Tabs } from 'expo-router';

import { tabIcon, tabScreenOptions } from '@/components/tabs';
import { useQuery } from '@/hooks/useQuery';
import { inventory, orders } from '@/services';
import { useAuth } from '@/store/AuthContext';

export default function SellerTabs() {
  const { user } = useAuth();
  const isSeller = user?.role === 'seller';
  const counts = useQuery(isSeller ? `seller-counts:${user!.id}` : null, orders.sellerOrderCounts, ['orders']);
  const inv = useQuery(isSeller ? `inventory:${user!.id}` : null, inventory.getInventory, ['products']);
  const stockAlerts = (inv.data?.lowStock ?? 0) + (inv.data?.outOfStock ?? 0);

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: tabIcon('stats-chart', 'stats-chart-outline') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: tabIcon('receipt', 'receipt-outline'), tabBarBadge: counts.data?.new || undefined }} />
      <Tabs.Screen name="products" options={{ title: 'Products', tabBarIcon: tabIcon('leaf', 'leaf-outline') }} />
      <Tabs.Screen name="inventory" options={{ title: 'Stock', tabBarIcon: tabIcon('cube', 'cube-outline'), tabBarBadge: stockAlerts || undefined }} />
      <Tabs.Screen name="account" options={{ title: 'Shop', tabBarIcon: tabIcon('storefront', 'storefront-outline') }} />
    </Tabs>
  );
}
