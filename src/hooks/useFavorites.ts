import { useCallback } from 'react';

import { favorites } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import type { FavoriteTarget } from '@/types/models';
import { haptic } from '@/utils/haptics';

import { useQuery } from './useQuery';

/** Favourite ids with optimistic toggling (the heart fills instantly). */
export function useFavorites() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'customer';
  const q = useQuery(isCustomer ? `fav-ids:${user!.id}` : null, favorites.listFavoriteIds, ['favorites']);
  const toast = useToast();
  const ids = new Set(q.data ?? []);

  const toggle = useCallback(
    async (type: FavoriteTarget, id: string) => {
      if (!isCustomer) return;
      haptic.tap();
      const wasFav = (q.data ?? []).includes(id);
      q.setData((prev) => (wasFav ? (prev ?? []).filter((x) => x !== id) : [...(prev ?? []), id]));
      try {
        const now = await favorites.toggleFavorite(type, id);
        toast.show(now ? (type === 'seller' ? 'Shop saved to favourites' : 'Saved to favourites') : 'Removed from favourites', 'success');
      } catch (e) {
        q.setData((prev) => (wasFav ? [...(prev ?? []), id] : (prev ?? []).filter((x) => x !== id)));
        toast.show((e as Error).message, 'error');
      }
    },
    [isCustomer, q, toast],
  );

  return { isFavorite: (id: string) => ids.has(id), toggle, enabled: isCustomer };
}
