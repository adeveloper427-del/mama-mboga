/**
 * Change events. Screens subscribe to the tables they display and reload
 * when one changes. Events come from two places: Supabase Realtime (changes
 * made by anyone, filtered by Row-Level Security) and the services themselves
 * right after a successful write (tables Realtime does not stream).
 */

export type TableName =
  | 'users'
  | 'sellers'
  | 'addresses'
  | 'categories'
  | 'products'
  | 'stockMovements'
  | 'orders'
  | 'orderItems'
  | 'payments'
  | 'notifications'
  | 'conversations'
  | 'messages'
  | 'favorites'
  | 'reviews';

type Listener = (tables: TableName[]) => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(tables: TableName[]): void {
  listeners.forEach((l) => {
    try {
      l(tables);
    } catch {
      // A broken listener must not affect the others.
    }
  });
}
