import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import type { FavoriteTarget, ProductView, Shop } from '@/types/models';

import { request, unwrap } from './api';
import { PRODUCT_SELECT, SHOP_SELECT, toProductView, toShop } from './mappers';
import { requireUser } from './session';

async function myFavorites(userId: string, type?: FavoriteTarget) {
  let q = supabase.from('favorites').select('target_id, target_type, created_at').eq('user_id', userId).order('created_at', { ascending: false });
  if (type) q = q.eq('target_type', type);
  return unwrap(await q);
}

export async function listFavoriteIds(): Promise<string[]> {
  return request(async () => {
    const me = requireUser('customer');
    return (await myFavorites(me.id)).map((f) => f.target_id as string);
  });
}

/** Returns the new state: true = now a favourite. */
export async function toggleFavorite(targetType: FavoriteTarget, targetId: string): Promise<boolean> {
  return request(async () => {
    const me = requireUser('customer');
    const removed = unwrap(
      await supabase.from('favorites').delete().eq('user_id', me.id).eq('target_type', targetType).eq('target_id', targetId).select('id'),
    );
    if (!removed.length) {
      const { error } = await supabase.from('favorites').insert({ user_id: me.id, target_type: targetType, target_id: targetId });
      if (error && error.code !== '23505') throw error; // double tap: already saved
    }
    emit(['favorites']);
    return removed.length === 0;
  });
}

export async function listFavoriteProducts(): Promise<ProductView[]> {
  return request(async () => {
    const me = requireUser('customer');
    const favs = await myFavorites(me.id, 'product');
    if (!favs.length) return [];
    const rows = unwrap(await supabase.from('products').select(PRODUCT_SELECT).in('id', favs.map((f) => f.target_id)).eq('is_deleted', false));
    const byId = new Map(rows.map((r) => [r.id as string, r]));
    return favs.flatMap((f) => (byId.has(f.target_id) ? [toProductView(byId.get(f.target_id)!)] : []));
  });
}

export async function listFavoriteShops(): Promise<Shop[]> {
  return request(async () => {
    const me = requireUser('customer');
    const favs = await myFavorites(me.id, 'seller');
    if (!favs.length) return [];
    const rows = unwrap(await supabase.from('sellers').select(SHOP_SELECT).in('id', favs.map((f) => f.target_id)).eq('products.is_deleted', false));
    return rows.map(toShop).filter((s) => s.status === 'active');
  });
}
