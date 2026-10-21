import { useMemo } from 'react';

import { catalog } from '@/services';
import { useCart, type CartLine } from '@/store/CartContext';
import type { ProductView, Shop } from '@/types/models';

import { useQuery } from './useQuery';

export type LineIssue = 'removed' | 'unavailable' | 'out_of_stock' | 'insufficient' | null;

export interface CartItemView extends CartLine {
  product?: ProductView;
  lineTotal: number;
  issue: LineIssue;
}

export interface CartShopGroup {
  sellerId: string;
  shop?: Shop;
  items: CartItemView[];
  subtotal: number;
  /** Items that can actually be ordered. */
  orderable: CartItemView[];
  belowMinimum: boolean;
  blocked: string | null; // reason this shop's order cannot be placed
}

/** Joins cart lines with live product and shop data, grouped by shop. */
export function useCartDetails() {
  const cart = useCart();
  const ids = cart.lines.map((l) => l.productId).sort();
  const sellerIds = [...new Set(cart.lines.map((l) => l.sellerId))].sort();

  const productsQ = useQuery(ids.length ? `cart-products:${ids.join(',')}` : null, () => catalog.getProductsByIds(ids), ['products', 'sellers']);
  const shopsQ = useQuery(sellerIds.length ? 'shops:all' : null, () => catalog.listShops(), ['sellers', 'users']);

  const groups = useMemo<CartShopGroup[]>(() => {
    const products = new Map((productsQ.data ?? []).map((p) => [p.id, p]));
    const shops = new Map((shopsQ.data ?? []).map((s) => [s.id, s]));
    return sellerIds.map((sellerId) => {
      const items: CartItemView[] = cart.lines
        .filter((l) => l.sellerId === sellerId)
        .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
        .map((l) => {
          const product = products.get(l.productId);
          let issue: LineIssue = null;
          if (!product) issue = 'removed';
          else if (!product.isAvailable) issue = 'unavailable';
          else if (product.stock <= 0) issue = 'out_of_stock';
          else if (product.stock < l.quantity) issue = 'insufficient';
          return { ...l, product, issue, lineTotal: product ? product.price * l.quantity : 0 };
        });
      const orderable = items.filter((i) => !i.issue);
      const subtotal = orderable.reduce((s, i) => s + i.lineTotal, 0);
      const shop = shops.get(sellerId);
      const belowMinimum = !!shop && subtotal < shop.minOrder;
      let blocked: string | null = null;
      if (!shop) blocked = 'This shop is no longer available';
      else if (!shop.acceptingOrders) blocked = 'Not taking orders right now';
      else if (!orderable.length) blocked = 'No items available to order';
      else if (belowMinimum) blocked = `Minimum order is KSh ${shop.minOrder.toLocaleString()}`;
      return { sellerId, shop, items, subtotal, orderable, belowMinimum, blocked };
    });
  }, [cart.lines, productsQ.data, shopsQ.data, sellerIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = (productsQ.loading && !productsQ.data) || (shopsQ.loading && !shopsQ.data);
  const error = productsQ.error ?? shopsQ.error;
  const ready = groups.filter((g) => !g.blocked);
  const subtotal = ready.reduce((s, g) => s + g.subtotal, 0);

  return {
    groups,
    loading: cart.ready ? loading : true,
    error,
    refetch: async () => {
      await Promise.all([productsQ.refetch(), shopsQ.refetch()]);
    },
    refreshing: productsQ.refreshing || shopsQ.refreshing,
    readyGroups: ready,
    subtotal,
  };
}
