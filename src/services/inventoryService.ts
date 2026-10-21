/**
 * Inventory. Every stock change runs in the database (adjust_stock), which
 * validates it, logs a stock movement and raises low/out-of-stock alerts in
 * one transaction.
 */
import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import type { InventoryReason, ProductView, StockMovement } from '@/types/models';
import { sanitizeText } from '@/utils/validation';

import { fail, request, rpc, unwrap } from './api';
import { PRODUCT_SELECT, toProductView, toStockMovement } from './mappers';
import { requireUser } from './session';

export interface InventorySummary {
  products: ProductView[];
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  unavailable: number;
  /** Retail value of all stock on hand. */
  stockValue: number;
}

export async function getInventory(): Promise<InventorySummary> {
  return request(async () => {
    const me = requireUser('seller');
    const products = unwrap(await supabase.from('products').select(PRODUCT_SELECT).eq('seller_id', me.id).eq('is_deleted', false))
      .map(toProductView)
      .sort((a, b) => a.stock - a.lowStockThreshold - (b.stock - b.lowStockThreshold));
    return {
      products,
      totalProducts: products.length,
      lowStock: products.filter((p) => p.stockState === 'low_stock').length,
      outOfStock: products.filter((p) => p.stockState === 'out_of_stock').length,
      unavailable: products.filter((p) => p.stockState === 'unavailable').length,
      stockValue: products.reduce((sum, p) => sum + p.stock * p.price, 0),
    };
  });
}

export type AdjustMode = 'add' | 'remove' | 'set';

export interface StockAdjustment {
  mode: AdjustMode;
  quantity: number;
  reason: Extract<InventoryReason, 'restock' | 'adjustment' | 'spoilage'>;
  note?: string;
}

export async function adjustStock(productId: string, adj: StockAdjustment): Promise<number> {
  return request(async () => {
    requireUser('seller');
    if (!Number.isInteger(adj.quantity) || adj.quantity < 0 || adj.quantity > 100_000)
      fail('validation', 'Enter a whole number', 'quantity');
    if (adj.mode !== 'set' && adj.quantity === 0) fail('validation', 'Enter a quantity above 0', 'quantity');
    const stock = await rpc<number>('adjust_stock', {
      p_product_id: productId,
      p_mode: adj.mode,
      p_quantity: adj.quantity,
      p_reason: adj.reason,
      p_note: adj.note ? sanitizeText(adj.note, 120) : null,
    });
    emit(['products', 'stockMovements', 'notifications']);
    return stock;
  });
}

export async function getStockHistory(productId: string): Promise<StockMovement[]> {
  return request(async () => {
    const me = requireUser('seller');
    const rows = unwrap(
      await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .eq('seller_id', me.id)
        .order('created_at', { ascending: false })
        .limit(200),
    );
    return rows.map(toStockMovement);
  });
}
