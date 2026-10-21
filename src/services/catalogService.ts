/**
 * Public catalogue: categories, products, shops, search and discovery.
 * Row-Level Security already hides deleted products and suspended shops from
 * customers; ranking and search scoring happen here.
 */
import { supabase } from '@/backend/supabase';
import { NEIGHBOURS } from '@/data/areas';
import type { Category, ProductView, Review, Shop } from '@/types/models';

import { fail, request, unwrap } from './api';
import { PRODUCT_SELECT, SHOP_SELECT, toCategory, toProductView, toReview, toShop, type Row } from './mappers';
import { optionalUser } from './session';

export type ProductSort = 'relevance' | 'popular' | 'price_asc' | 'price_desc' | 'newest' | 'rating';

export interface ProductQuery {
  search?: string;
  categoryId?: string;
  sellerId?: string;
  inStockOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  limit?: number;
}

export const POPULAR_SEARCHES = ['Sukuma wiki', 'Tomatoes', 'Avocados', 'Onions', 'Mangoes', 'Eggs', 'Potatoes', 'Managu'];

function relevance(p: ProductView, terms: string[]): number {
  const name = p.name.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (name.startsWith(t)) score += 10;
    else if (name.split(/[\s()]+/).some((w) => w.startsWith(t))) score += 7;
    else if (name.includes(t)) score += 5;
    else if (p.categoryName.toLowerCase().includes(t)) score += 3;
    else if (p.sellerName.toLowerCase().includes(t)) score += 2;
    else if (p.description.toLowerCase().includes(t)) score += 1;
    else return 0; // every term must match somewhere
  }
  return score;
}

/** Sold-out and paused items sink below items that can be ordered. */
const orderable = (p: ProductView) => (p.stockState === 'in_stock' || p.stockState === 'low_stock' ? 0 : 1);

/** Products customers can see: not deleted, from active shops (the latter enforced by RLS). */
function listedProducts() {
  return supabase.from('products').select(PRODUCT_SELECT).eq('is_deleted', false);
}

export async function listCategories(): Promise<Category[]> {
  return request(async () => unwrap(await supabase.from('categories').select('*').order('sort_order')).map(toCategory));
}

export async function getCategory(id: string): Promise<Category> {
  return request(async () => {
    const row = unwrap(await supabase.from('categories').select('*').eq('id', id).maybeSingle());
    return row ? toCategory(row) : fail('not_found', 'Category not found');
  });
}

export async function listProducts(q: ProductQuery = {}): Promise<ProductView[]> {
  return request(async () => {
    let query = listedProducts();
    if (q.categoryId) query = query.eq('category_id', q.categoryId);
    if (q.sellerId) query = query.eq('seller_id', q.sellerId);
    if (q.minPrice !== undefined) query = query.gte('price', q.minPrice);
    if (q.maxPrice !== undefined) query = query.lte('price', q.maxPrice);
    let rows = unwrap(await query).map(toProductView);
    if (q.inStockOnly) rows = rows.filter((p) => p.stockState === 'in_stock' || p.stockState === 'low_stock');

    const terms = (q.search ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const scores = new Map<string, number>();
    if (terms.length) {
      rows = rows.filter((p) => {
        const s = relevance(p, terms);
        scores.set(p.id, s);
        return s > 0;
      });
    }

    const sort = q.sort ?? (terms.length ? 'relevance' : 'popular');
    const cmp: Record<ProductSort, (a: ProductView, b: ProductView) => number> = {
      relevance: (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || b.soldCount - a.soldCount,
      popular: (a, b) => b.soldCount - a.soldCount,
      price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      rating: (a, b) => b.sellerRating - a.sellerRating,
    };
    rows.sort((a, b) => orderable(a) - orderable(b) || cmp[sort](a, b));
    return q.limit ? rows.slice(0, q.limit) : rows;
  });
}

export async function getProduct(id: string): Promise<ProductView> {
  return request(async () => {
    // RLS lets owners open their own unlisted items; customers only see listed ones.
    const row = unwrap(await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle());
    const me = optionalUser();
    if (!row || (row.is_deleted && row.seller_id !== me?.id)) return fail('not_found', 'This product is no longer available.');
    return toProductView(row);
  });
}

/** Used by the cart to refresh prices/stock; missing ids are simply omitted. */
export async function getProductsByIds(ids: string[]): Promise<ProductView[]> {
  return request(async () => {
    if (!ids.length) return [];
    return unwrap(await listedProducts().in('id', ids)).map(toProductView);
  });
}

function areaRank(shopArea: string, userArea?: string): number {
  if (!userArea) return 1;
  if (shopArea === userArea) return 0;
  if (NEIGHBOURS[userArea]?.includes(shopArea)) return 1;
  return 2;
}

export interface ShopQuery {
  area?: string;
  search?: string;
  nearbyOnly?: boolean;
}

async function fetchShops(): Promise<Shop[]> {
  return unwrap(await supabase.from('sellers').select(SHOP_SELECT).eq('products.is_deleted', false)).map(toShop);
}

export async function listShops(q: ShopQuery = {}): Promise<Shop[]> {
  return request(async () => {
    const term = q.search?.trim().toLowerCase();
    return (await fetchShops())
      .filter((s) => s.status === 'active')
      .filter((s) => !term || s.businessName.toLowerCase().includes(term) || s.area.toLowerCase().includes(term))
      .filter((s) => !q.nearbyOnly || areaRank(s.area, q.area) < 2)
      .sort(
        (a, b) =>
          areaRank(a.area, q.area) - areaRank(b.area, q.area) ||
          Number(b.isOpenNow) - Number(a.isOpenNow) ||
          b.rating - a.rating,
      );
  });
}

export async function getShop(id: string): Promise<Shop> {
  return request(async () => {
    const row = unwrap(await supabase.from('sellers').select(SHOP_SELECT).eq('id', id).eq('products.is_deleted', false).maybeSingle());
    if (!row) return fail('not_found', 'This shop could not be found.');
    const shop = toShop(row);
    if (shop.status !== 'active' && optionalUser()?.role !== 'admin') return fail('not_found', 'This shop is currently unavailable.');
    return shop;
  });
}

export async function listShopReviews(sellerId: string, limit?: number): Promise<Review[]> {
  return request(async () => {
    let query = supabase.from('reviews').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false });
    if (limit) query = query.limit(limit);
    return unwrap(await query).map(toReview);
  });
}

/**
 * Personal recommendations: products from the categories the customer buys and
 * saves most, excluding what they already favourited, falling back to bestsellers.
 */
export async function recommendedProducts(limit = 8): Promise<ProductView[]> {
  return request(async () => {
    const me = optionalUser();
    const [products, bought, favs] = await Promise.all([
      listedProducts().eq('is_available', true).gt('stock', 0).then(unwrap),
      me?.role === 'customer'
        ? supabase.from('order_items').select('product:products(category_id), order:orders!inner(customer_id)').eq('order.customer_id', me.id).then(unwrap)
        : Promise.resolve([]),
      me?.role === 'customer' ? supabase.from('favorites').select('target_id, target_type').eq('user_id', me.id).then(unwrap) : Promise.resolve([]),
    ]);
    const all = products.map(toProductView);
    const categoryOf = new Map(all.map((p) => [p.id, p.categoryId]));
    const weight = new Map<string, number>();
    for (const i of bought as Row[]) {
      const cat = i.product?.category_id;
      if (cat) weight.set(cat, (weight.get(cat) ?? 0) + 1);
    }
    for (const f of favs) {
      const cat = f.target_type === 'product' ? categoryOf.get(f.target_id) : undefined;
      if (cat) weight.set(cat, (weight.get(cat) ?? 0) + 2);
    }
    const favIds = new Set(favs.map((f) => f.target_id));
    const userArea = me?.area;
    return all
      .filter((p) => !favIds.has(p.id) && p.sellerId !== me?.id)
      .sort(
        (a, b) =>
          (weight.get(b.categoryId) ?? 0) - (weight.get(a.categoryId) ?? 0) ||
          areaRank(a.sellerArea, userArea) - areaRank(b.sellerArea, userArea) ||
          b.soldCount - a.soldCount,
      )
      // One product name per list keeps the row varied.
      .filter((p, i, arr) => arr.findIndex((x) => x.name === p.name) === i)
      .slice(0, limit);
  });
}
