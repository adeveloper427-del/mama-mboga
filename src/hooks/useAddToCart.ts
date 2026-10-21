import { useCallback } from 'react';

import { useAuth } from '@/store/AuthContext';
import { useCart } from '@/store/CartContext';
import { useToast } from '@/store/ToastContext';
import type { ProductView } from '@/types/models';
import { formatQty } from '@/utils/format';
import { haptic } from '@/utils/haptics';

/** One place for the add-to-cart rules so every button behaves the same. */
export function useAddToCart() {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();

  return useCallback(
    (product: ProductView, quantity = 1): boolean => {
      if (user?.role !== 'customer') {
        toast.show('Sign in with a customer account to shop.', 'info');
        return false;
      }
      if (product.stockState === 'unavailable') {
        toast.show(`${product.name} is not available right now.`, 'error');
        return false;
      }
      if (product.stockState === 'out_of_stock') {
        toast.show(`${product.name} is sold out.`, 'error');
        return false;
      }
      const res = cart.add(product, quantity);
      if (res.capped) {
        haptic.error();
        toast.show(`Only ${formatQty(product.stock, product.unit)} available — your cart has the maximum.`, 'info');
        return res.quantity > 0;
      }
      haptic.success();
      toast.show(`${product.name} added to cart`, 'success');
      return true;
    },
    [user, cart, toast],
  );
}
