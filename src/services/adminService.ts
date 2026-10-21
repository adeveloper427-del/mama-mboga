/**
 * Platform administration. The database only returns platform-wide rows to
 * admins (RLS `is_admin()`), and status changes run through admin-only functions.
 */
import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import type { AccountStatus, OrderDetails, OrderStatus, Role, Shop, User } from '@/types/models';
import { isSameDay } from '@/utils/format';

import { fail, request, rpc, unwrap } from './api';
import { ACTIVE_STATUSES } from './domain';
import { ORDER_SELECT, SHOP_SELECT, toOrder, toOrderDetails, toShop, toUser } from './mappers';
import { requireUser } from './session';
import { completedAt, type SeriesPoint } from './statsService';

export interface PlatformOverview {
  customers: number;
  sellers: number;
  unverifiedSellers: number;
  suspendedUsers: number;
  products: number;
  ordersToday: number;
  totalOrders: number;
  activeOrders: number;
  gmv: number; // gross value of completed orders
  gmvToday: number;
  byStatus: Record<OrderStatus, number>;
  week: SeriesPoint[];
  topShops: { id: string; name: string; area: string; revenue: number; orders: number }[];
}

export async function getOverview(): Promise<PlatformOverview> {
  return request(async () => {
    requireUser('admin');
    const [orderRows, profiles, sellers, productCount] = await Promise.all([
      supabase.from('orders').select('id, code, customer_id, seller_id, status, fulfilment, subtotal, delivery_fee, total, payment_method, payment_status, stock_reserved, history, reviewed, created_at, updated_at').then(unwrap),
      supabase.from('profiles').select('role, status').then(unwrap),
      supabase.from('sellers').select('id, business_name, area, verified').then(unwrap),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    ]);
    if (productCount.error) throw productCount.error;
    const orders = orderRows.map(toOrder);
    const now = new Date();
    const completed = orders.filter((o) => o.status === 'completed');
    const byStatus = {} as Record<OrderStatus, number>;
    (['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'rejected', 'cancelled'] as OrderStatus[]).forEach(
      (s) => (byStatus[s] = orders.filter((o) => o.status === s).length),
    );
    const week: SeriesPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      week.push({
        date: d.toISOString(),
        label: d.toLocaleDateString('en-KE', { weekday: 'short' }),
        value: completed.filter((o) => isSameDay(completedAt(o), d)).reduce((s, o) => s + o.total, 0),
      });
    }
    const shopAgg = sellers.map((s) => {
      const mine = completed.filter((o) => o.sellerId === s.id);
      return { id: s.id as string, name: s.business_name as string, area: s.area as string, revenue: mine.reduce((a, o) => a + o.total, 0), orders: mine.length };
    });
    return {
      customers: profiles.filter((u) => u.role === 'customer').length,
      sellers: profiles.filter((u) => u.role === 'seller').length,
      unverifiedSellers: sellers.filter((s) => !s.verified).length,
      suspendedUsers: profiles.filter((u) => u.status === 'suspended').length,
      products: productCount.count ?? 0,
      ordersToday: orders.filter((o) => isSameDay(new Date(o.createdAt), now)).length,
      totalOrders: orders.length,
      activeOrders: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      gmv: completed.reduce((s, o) => s + o.total, 0),
      gmvToday: completed.filter((o) => isSameDay(completedAt(o), now)).reduce((s, o) => s + o.total, 0),
      byStatus,
      week,
      topShops: shopAgg.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    };
  });
}

export async function listShopsAdmin(): Promise<Shop[]> {
  return request(async () => {
    requireUser('admin');
    const rows = unwrap(await supabase.from('sellers').select(SHOP_SELECT).eq('products.is_deleted', false));
    return rows.map(toShop).sort((a, b) => Number(a.verified) - Number(b.verified) || a.businessName.localeCompare(b.businessName));
  });
}

export async function setShopVerified(sellerId: string, verified: boolean): Promise<void> {
  return request(async () => {
    requireUser('admin');
    await rpc('admin_set_shop_verified', { p_seller_id: sellerId, p_verified: verified });
    emit(['sellers']);
  });
}

export async function listUsers(role?: Role): Promise<User[]> {
  return request(async () => {
    requireUser('admin');
    let q = supabase.from('profiles').select('*').order('full_name');
    if (role) q = q.eq('role', role);
    return unwrap(await q).map(toUser);
  });
}

export async function setUserStatus(userId: string, status: AccountStatus): Promise<void> {
  return request(async () => {
    const me = requireUser('admin');
    if (userId === me.id) fail('forbidden', "You can't change your own account status.");
    await rpc('admin_set_user_status', { p_user_id: userId, p_status: status });
    emit(['users']);
  });
}

export async function listAllOrders(status?: OrderStatus | 'active'): Promise<OrderDetails[]> {
  return request(async () => {
    requireUser('admin');
    let q = supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(200);
    if (status === 'active') q = q.in('status', ACTIVE_STATUSES);
    else if (status) q = q.eq('status', status);
    return unwrap(await q).map(toOrderDetails);
  });
}
