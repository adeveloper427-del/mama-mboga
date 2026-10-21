/**
 * Seller-side product management. Ownership is enforced by Row-Level Security
 * (`seller_id = auth.uid()`); stock can only change through inventoryService.
 */
import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import { UNITS, type Product, type ProductView, type Unit } from '@/types/models';
import { sanitizeText } from '@/utils/validation';

import { fail, nowIso, request, unwrap } from './api';
import { PRODUCT_SELECT, toProduct, toProductView } from './mappers';
import { requireUser } from './session';

export interface ProductInput {
  name: string;
  categoryId: string;
  description: string;
  price: number;
  unit: Unit;
  stock: number;
  lowStockThreshold: number;
  imageUrl?: string;
  isAvailable: boolean;
}

function validate(input: ProductInput) {
  const name = input.name.trim();
  if (name.length < 2) fail('validation', 'Enter a product name', 'name');
  if (name.length > 60) fail('validation', 'Product name is too long', 'name');
  if (!input.categoryId) fail('validation', 'Choose a category', 'categoryId');
  if (!UNITS.includes(input.unit)) fail('validation', 'Choose a unit', 'unit');
  if (!Number.isFinite(input.price) || input.price <= 0 || input.price > 100_000)
    fail('validation', 'Enter a price between KSh 1 and 100,000', 'price');
  if (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > 100_000)
    fail('validation', 'Stock must be a whole number of 0 or more', 'stock');
  if (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0)
    fail('validation', 'Low-stock alert must be a whole number', 'lowStockThreshold');
}

async function assertUniqueName(sellerId: string, name: string, exceptId?: string) {
  let q = supabase.from('products').select('id').eq('seller_id', sellerId).eq('is_deleted', false).ilike('name', name.replace(/[%_\\]/g, '\\$&'));
  if (exceptId) q = q.neq('id', exceptId);
  if (unwrap(await q).length) fail('conflict', 'You already have a product with this name.', 'name');
}

async function ownProduct(id: string, sellerId: string) {
  const row = unwrap(await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).eq('is_deleted', false).maybeSingle());
  if (!row) return fail('not_found', 'Product not found');
  if (row.seller_id !== sellerId) return fail('forbidden', 'You can only manage your own products.');
  return row;
}

export async function listMyProducts(): Promise<ProductView[]> {
  return request(async () => {
    const me = requireUser('seller');
    const rows = unwrap(await supabase.from('products').select(PRODUCT_SELECT).eq('seller_id', me.id).eq('is_deleted', false).order('name'));
    return rows.map(toProductView);
  });
}

export async function getMyProduct(id: string): Promise<ProductView> {
  return request(async () => {
    const me = requireUser('seller');
    return toProductView(await ownProduct(id, me.id));
  });
}

export async function createProduct(input: ProductInput): Promise<Product> {
  return request(async () => {
    const me = requireUser('seller');
    validate(input);
    const name = sanitizeText(input.name, 60);
    await assertUniqueName(me.id, name);
    // A trigger records the opening stock as the first stock movement.
    const row = unwrap(
      await supabase
        .from('products')
        .insert({
          seller_id: me.id,
          category_id: input.categoryId,
          name,
          description: sanitizeText(input.description, 600),
          price: Math.round(input.price),
          unit: input.unit,
          stock: input.stock,
          low_stock_threshold: input.lowStockThreshold,
          image_url: input.imageUrl ?? null,
          is_available: input.isAvailable,
        })
        .select('*')
        .single(),
    );
    emit(['products', 'stockMovements']);
    return toProduct(row);
  });
}

/** Stock is not edited here; it changes through inventoryService so every change is logged. */
export async function updateProduct(id: string, input: Omit<ProductInput, 'stock'>): Promise<Product> {
  return request(async () => {
    const me = requireUser('seller');
    const existing = await ownProduct(id, me.id);
    validate({ ...input, stock: existing.stock });
    const name = sanitizeText(input.name, 60);
    await assertUniqueName(me.id, name, id);
    const row = unwrap(
      await supabase
        .from('products')
        .update({
          name,
          category_id: input.categoryId,
          description: sanitizeText(input.description, 600),
          price: Math.round(input.price),
          unit: input.unit,
          low_stock_threshold: input.lowStockThreshold,
          image_url: input.imageUrl ?? null,
          is_available: input.isAvailable,
          updated_at: nowIso(),
        })
        .eq('id', id)
        .select('*')
        .single(),
    );
    emit(['products']);
    return toProduct(row);
  });
}

export async function setAvailability(id: string, isAvailable: boolean): Promise<void> {
  return request(async () => {
    const me = requireUser('seller');
    await ownProduct(id, me.id);
    unwrap(await supabase.from('products').update({ is_available: isAvailable, updated_at: nowIso() }).eq('id', id));
    emit(['products']);
  });
}

/** Soft delete: past orders keep referring to the product. */
export async function deleteProduct(id: string): Promise<void> {
  return request(async () => {
    const me = requireUser('seller');
    await ownProduct(id, me.id);
    unwrap(await supabase.from('products').update({ is_deleted: true, is_available: false, updated_at: nowIso() }).eq('id', id));
    emit(['products', 'favorites']);
  });
}
