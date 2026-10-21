/**
 * Business statistics for the seller dashboard and sales report.
 * A sale is a COMPLETED order, dated by when it was completed.
 * Figures are computed from the seller's own orders, which Row-Level Security
 * limits to theirs.
 */
import { supabase } from '@/backend/supabase';
import type { Order, OrderDetails, OrderItem, ProductView } from '@/types/models';
import { isSameDay } from '@/utils/format';

import { request, unwrap } from './api';
import { ORDER_SELECT, PRODUCT_SELECT, toOrder, toOrderDetails, toOrderItem, toProductView } from './mappers';
import { requireUser } from './session';

export interface SeriesPoint {
  label: string;
  value: number;
  date: string;
}

export interface BestSeller {
  productId: string;
  name: string;
  imageUrl?: string;
  unit: string;
  quantity: number;
  revenue: number;
}

export interface SellerDashboard {
  todaySales: number;
  todayOrders: number;
  totalSales: number;
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  weekSales: number;
  weekChangePct: number | null;
  week: SeriesPoint[];
  lowStock: ProductView[];
  bestSellers: BestSeller[];
  recentOrders: OrderDetails[];
  rating: number;
  ratingCount: number;
}

export const completedAt = (o: Order) => new Date(o.history.find((h) => h.status === 'completed')?.at ?? o.updatedAt);

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export function dailySeries(orders: Order[], days: number): SeriesPoint[] {
  const today = startOfDay(new Date());
  const points: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const value = orders.filter((o) => isSameDay(completedAt(o), day)).reduce((s, o) => s + o.total, 0);
    points.push({
      date: day.toISOString(),
      value,
      label: days <= 7 ? day.toLocaleDateString('en-KE', { weekday: 'short' }) : String(day.getDate()),
    });
  }
  return points;
}

type OrderWithItems = Order & { items: OrderItem[] };

function bestSellers(orders: OrderWithItems[], limit: number): BestSeller[] {
  const agg = new Map<string, BestSeller>();
  for (const i of orders.flatMap((o) => o.items)) {
    const cur = agg.get(i.productId) ?? { productId: i.productId, name: i.productName, imageUrl: i.imageUrl, unit: i.unit, quantity: 0, revenue: 0 };
    cur.quantity += i.quantity;
    cur.revenue += i.lineTotal;
    agg.set(i.productId, cur);
  }
  return [...agg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** All of a seller's orders with their items. */
async function sellerOrders(sellerId: string): Promise<OrderWithItems[]> {
  const rows = unwrap(await supabase.from('orders').select('*, items:order_items(*)').eq('seller_id', sellerId));
  return rows.map((r) => ({ ...toOrder(r), items: (r.items ?? []).map(toOrderItem) }));
}

export async function getSellerDashboard(): Promise<SellerDashboard> {
  return request(async () => {
    const me = requireUser('seller');
    const [mine, products, recent, shop] = await Promise.all([
      sellerOrders(me.id),
      supabase.from('products').select(PRODUCT_SELECT).eq('seller_id', me.id).eq('is_deleted', false).eq('is_available', true).then(unwrap),
      supabase.from('orders').select(ORDER_SELECT).eq('seller_id', me.id).order('created_at', { ascending: false }).limit(5).then(unwrap),
      supabase.from('sellers').select('rating, rating_count').eq('id', me.id).maybeSingle().then(unwrap),
    ]);
    const completed = mine.filter((o) => o.status === 'completed');
    const now = new Date();
    const today = completed.filter((o) => isSameDay(completedAt(o), now));
    const week = dailySeries(completed, 7);
    const weekSales = week.reduce((s, p) => s + p.value, 0);
    const prevStart = startOfDay(new Date(now.getTime() - 13 * 86_400_000));
    const prevEnd = startOfDay(new Date(now.getTime() - 6 * 86_400_000));
    const prevSales = completed
      .filter((o) => completedAt(o) >= prevStart && completedAt(o) < prevEnd)
      .reduce((s, o) => s + o.total, 0);
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

    return {
      todaySales: today.reduce((s, o) => s + o.total, 0),
      todayOrders: mine.filter((o) => isSameDay(new Date(o.createdAt), now) && o.status !== 'rejected').length,
      totalSales: completed.reduce((s, o) => s + o.total, 0),
      totalOrders: mine.length,
      pendingOrders: mine.filter((o) => o.status === 'pending').length,
      activeOrders: mine.filter((o) => ['accepted', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length,
      completedOrders: completed.length,
      weekSales,
      weekChangePct: prevSales > 0 ? Math.round(((weekSales - prevSales) / prevSales) * 100) : null,
      week,
      lowStock: products
        .map(toProductView)
        .filter((p) => p.stock <= p.lowStockThreshold)
        .sort((a, b) => a.stock - b.stock),
      bestSellers: bestSellers(completed.filter((o) => completedAt(o) >= monthAgo), 5),
      recentOrders: recent.map(toOrderDetails),
      rating: Number(shop?.rating ?? 0),
      ratingCount: shop?.rating_count ?? 0,
    };
  });
}

export type ReportPeriod = 7 | 30 | 90;

export interface SalesReport {
  period: ReportPeriod;
  revenue: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  completionRate: number; // % of decided orders that completed
  series: SeriesPoint[];
  topProducts: BestSeller[];
  deliveryShare: { delivery: number; pickup: number };
  uniqueCustomers: number;
  repeatCustomers: number;
  deliveryFees: number;
}

export async function getSalesReport(period: ReportPeriod): Promise<SalesReport> {
  return request(async () => {
    const me = requireUser('seller');
    const mine = await sellerOrders(me.id);
    const since = startOfDay(new Date(Date.now() - (period - 1) * 86_400_000));
    const inPeriod = mine.filter((o) => new Date(o.createdAt) >= since);
    const completed = mine.filter((o) => o.status === 'completed' && completedAt(o) >= since);
    const cancelled = inPeriod.filter((o) => o.status === 'cancelled' || o.status === 'rejected');
    const revenue = completed.reduce((s, o) => s + o.total, 0);

    let series = dailySeries(completed, period);
    if (period === 90) {
      // Weekly buckets keep the chart readable.
      const weeks: SeriesPoint[] = [];
      for (let i = 0; i < series.length; i += 7) {
        const chunk = series.slice(i, i + 7);
        weeks.push({ date: chunk[0].date, label: new Date(chunk[0].date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }), value: chunk.reduce((s, p) => s + p.value, 0) });
      }
      series = weeks;
    }

    const perCustomer = new Map<string, number>();
    completed.forEach((o) => perCustomer.set(o.customerId, (perCustomer.get(o.customerId) ?? 0) + 1));

    return {
      period,
      revenue,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
      averageOrderValue: completed.length ? Math.round(revenue / completed.length) : 0,
      completionRate: completed.length + cancelled.length ? Math.round((completed.length / (completed.length + cancelled.length)) * 100) : 0,
      series,
      topProducts: bestSellers(completed, 8),
      deliveryShare: {
        delivery: completed.filter((o) => o.fulfilment === 'delivery').length,
        pickup: completed.filter((o) => o.fulfilment === 'pickup').length,
      },
      uniqueCustomers: perCustomer.size,
      repeatCustomers: [...perCustomer.values()].filter((n) => n > 1).length,
      deliveryFees: completed.reduce((s, o) => s + o.deliveryFee, 0),
    };
  });
}
