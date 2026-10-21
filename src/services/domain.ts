/**
 * Business rules shared by several services and screens. Kept in one place so
 * that, for example, "is this shop open?" means the same thing everywhere.
 * The authoritative versions of the write rules (stock, order workflow) live
 * in the database functions; these mirror them for display.
 */
import type { Fulfilment, OrderStatus, Product, SellerProfile, StockState } from '@/types/models';

export function isShopOpenNow(shop: Pick<SellerProfile, 'acceptingOrders' | 'hours'>, at = new Date()): boolean {
  if (!shop.acceptingOrders) return false;
  if (!shop.hours.days.includes(at.getDay())) return false;
  const mins = at.getHours() * 60 + at.getMinutes();
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  return mins >= toMin(shop.hours.open) && mins < toMin(shop.hours.close);
}

export function stockStateOf(p: Product): StockState {
  if (!p.isAvailable) return 'unavailable';
  if (p.stock <= 0) return 'out_of_stock';
  if (p.stock <= p.lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

export function canBeOrdered(p: Product): boolean {
  return p.isAvailable && !p.isDeleted && p.stock > 0;
}

/** Allowed next statuses for the seller, given fulfilment type. */
export function nextSellerStatuses(status: OrderStatus, fulfilment: Fulfilment): OrderStatus[] {
  switch (status) {
    case 'pending':
      return ['accepted', 'rejected'];
    case 'accepted':
      return ['preparing', 'cancelled'];
    case 'preparing':
      return ['ready', 'cancelled'];
    case 'ready':
      return fulfilment === 'delivery' ? ['out_for_delivery'] : ['completed'];
    case 'out_for_delivery':
      return ['completed'];
    default:
      return [];
  }
}

export const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery'];
export const CLOSED_STATUSES: OrderStatus[] = ['completed', 'rejected', 'cancelled'];
