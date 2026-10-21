/**
 * Orders: checkout, the seller's fulfilment workflow and customer tracking.
 *
 * Stock policy: stock is reserved (deducted) when the seller ACCEPTS an order,
 * so two customers can never be promised the same last bunch. It is released
 * if an accepted order is later cancelled. Completing an order records the
 * sale (sold count, cash payment collected).
 *
 * All writes run inside database functions (place_orders, update_order_status,
 * cancel_order), so prices come from the server and multi-table changes are atomic.
 */
import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import type { Fulfilment, OrderDetails, OrderStatus, PaymentMethod } from '@/types/models';
import { sanitizeText } from '@/utils/validation';

import { fail, request, rpc, unwrap } from './api';
import { ACTIVE_STATUSES } from './domain';
import { ORDER_SELECT, toOrderDetails } from './mappers';
import { getProvider } from './paymentService';
import { requireUser } from './session';

// ─── Checkout ───────────────────────────────────────────────────────────────

export interface CheckoutGroup {
  sellerId: string;
  items: { productId: string; quantity: number }[];
  fulfilment: Fulfilment;
  note?: string;
}

export interface CheckoutInput {
  groups: CheckoutGroup[];
  addressId?: string;
  paymentMethod: PaymentMethod;
}

export interface PlacedOrder {
  id: string;
  code: string;
}

/** Places one order per shop in a single atomic database call. */
export async function placeOrders(input: CheckoutInput): Promise<PlacedOrder[]> {
  return request(async () => {
    const me = requireUser('customer');
    if (!input.groups.length) fail('validation', 'Your cart is empty.');
    const provider = getProvider(input.paymentMethod);
    const placed = await rpc<PlacedOrder[]>('place_orders', {
      p_groups: input.groups.map((g) => ({
        seller_id: g.sellerId,
        fulfilment: g.fulfilment,
        note: g.note ? sanitizeText(g.note, 300) : null,
        items: g.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
      })),
      p_address_id: input.addressId ?? null,
      p_payment_method: provider.method,
    });
    emit(['orders', 'orderItems', 'payments', 'notifications']);
    // Start payment for each order (cash: nothing to collect yet).
    if (provider.method !== 'cash') for (const o of placed) await provider.initiate(o, { phone: me.phone });
    return placed;
  });
}

// ─── Reading orders ─────────────────────────────────────────────────────────

export type CustomerOrderScope = 'active' | 'past';

export async function listMyOrders(scope: CustomerOrderScope): Promise<OrderDetails[]> {
  return request(async () => {
    const me = requireUser('customer');
    const active = `(${ACTIVE_STATUSES.join(',')})`;
    let q = supabase.from('orders').select(ORDER_SELECT).eq('customer_id', me.id).order('created_at', { ascending: false });
    q = scope === 'active' ? q.in('status', ACTIVE_STATUSES) : q.not('status', 'in', active);
    return unwrap(await q).map(toOrderDetails);
  });
}

export type SellerOrderFilter = 'new' | 'active' | 'completed' | 'cancelled';

const SELLER_FILTERS: Record<SellerOrderFilter, OrderStatus[]> = {
  new: ['pending'],
  active: ['accepted', 'preparing', 'ready', 'out_for_delivery'],
  completed: ['completed'],
  cancelled: ['rejected', 'cancelled'],
};

export async function listSellerOrders(filter: SellerOrderFilter): Promise<OrderDetails[]> {
  return request(async () => {
    const me = requireUser('seller');
    // New orders: oldest first (first come, first served). Others: newest first.
    const rows = unwrap(
      await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .eq('seller_id', me.id)
        .in('status', SELLER_FILTERS[filter])
        .order('created_at', { ascending: filter === 'new' })
        .limit(300),
    );
    return rows.map(toOrderDetails);
  });
}

export async function sellerOrderCounts(): Promise<Record<SellerOrderFilter, number>> {
  return request(async () => {
    const me = requireUser('seller');
    const rows = unwrap(await supabase.from('orders').select('status').eq('seller_id', me.id));
    const count = (f: SellerOrderFilter) => rows.filter((o) => SELLER_FILTERS[f].includes(o.status)).length;
    return { new: count('new'), active: count('active'), completed: count('completed'), cancelled: count('cancelled') };
  });
}

export async function getOrder(id: string): Promise<OrderDetails> {
  return request(async () => {
    requireUser();
    // RLS returns the order only to its customer, its seller or an admin.
    const row = unwrap(await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle());
    return row ? toOrderDetails(row) : fail('not_found', 'Order not found.');
  });
}

// ─── Status workflow ────────────────────────────────────────────────────────

/** Seller moves an order forward (or rejects/cancels it). */
export async function updateOrderStatus(id: string, next: OrderStatus, reason?: string): Promise<OrderDetails> {
  return request(async () => {
    requireUser('seller');
    if ((next === 'rejected' || next === 'cancelled') && !reason?.trim()) fail('validation', 'Tell the customer why.', 'reason');
    await rpc('update_order_status', { p_order_id: id, p_next: next, p_reason: reason?.trim() || null });
    emit(['orders', 'products', 'stockMovements', 'payments', 'notifications']);
    return getOrder(id);
  });
}

/** Customers can cancel while the seller has not yet accepted. */
export async function cancelOrder(id: string, reason: string): Promise<void> {
  return request(async () => {
    requireUser('customer');
    await rpc('cancel_order', { p_order_id: id, p_reason: reason || 'Cancelled by customer' });
    emit(['orders', 'notifications']);
  });
}
