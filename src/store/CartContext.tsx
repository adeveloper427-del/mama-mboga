/**
 * Shopping cart. Kept on the device (per user) so it survives restarts and
 * works offline; prices and stock are always re-read from the catalogue when
 * the cart is displayed, and re-validated by the server at checkout.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Product } from '@/types/models';
import { localStore, storageKeys } from '@/utils/storage';

import { useAuth } from './AuthContext';

export interface CartLine {
  productId: string;
  sellerId: string;
  quantity: number;
  addedAt: string;
}

export interface AddResult {
  quantity: number;
  /** True when the requested amount was reduced to the available stock. */
  capped: boolean;
}

interface CartContextValue {
  lines: CartLine[];
  ready: boolean;
  itemCount: number;
  quantityOf: (productId: string) => number;
  add: (product: Pick<Product, 'id' | 'sellerId' | 'stock'>, quantity?: number) => AddResult;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  removeShop: (sellerId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.role === 'customer' ? user.id : null;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!userId) {
      setLines([]);
      setReady(true);
      return;
    }
    localStore.get<CartLine[]>(storageKeys.cart(userId), []).then((saved) => {
      if (cancelled) return;
      setLines(Array.isArray(saved) ? saved : []);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const commit = useCallback(
    (updater: (prev: CartLine[]) => CartLine[]) => {
      setLines((prev) => {
        const next = updater(prev);
        if (userId) localStore.set(storageKeys.cart(userId), next);
        return next;
      });
    },
    [userId],
  );

  const add = useCallback(
    (product: Pick<Product, 'id' | 'sellerId' | 'stock'>, quantity = 1): AddResult => {
      const existing = lines.find((l) => l.productId === product.id)?.quantity ?? 0;
      const wanted = existing + quantity;
      const finalQty = Math.max(0, Math.min(wanted, product.stock));
      commit((prev) => {
        const others = prev.filter((l) => l.productId !== product.id);
        if (finalQty <= 0) return others;
        const line = prev.find((l) => l.productId === product.id);
        return [...others, { productId: product.id, sellerId: product.sellerId, quantity: finalQty, addedAt: line?.addedAt ?? new Date().toISOString() }];
      });
      return { quantity: finalQty, capped: finalQty < wanted };
    },
    [lines, commit],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) =>
      commit((prev) =>
        quantity <= 0 ? prev.filter((l) => l.productId !== productId) : prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
      ),
    [commit],
  );

  const remove = useCallback((productId: string) => commit((prev) => prev.filter((l) => l.productId !== productId)), [commit]);
  const removeShop = useCallback((sellerId: string) => commit((prev) => prev.filter((l) => l.sellerId !== sellerId)), [commit]);
  const clear = useCallback(() => commit(() => []), [commit]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      itemCount: lines.length,
      quantityOf: (id) => lines.find((l) => l.productId === id)?.quantity ?? 0,
      add,
      setQuantity,
      remove,
      removeShop,
      clear,
    }),
    [lines, ready, add, setQuantity, remove, removeShop, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
