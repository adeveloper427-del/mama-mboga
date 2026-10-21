/**
 * Live updates. One Realtime channel streams row changes for the tables the
 * app displays (Supabase only sends rows the user may read under RLS) and
 * re-broadcasts them as change events; services add their own events after
 * each write. The channel follows the signed-in session.
 */
import { emit, subscribe, type TableName } from '@/backend/events';
import { supabase } from '@/backend/supabase';

import { session } from './session';

export type { TableName };

/** Database table → the app's table names that depend on it. */
const STREAMED: Record<string, TableName[]> = {
  orders: ['orders', 'orderItems'],
  payments: ['payments'],
  notifications: ['notifications'],
  messages: ['messages'],
  conversations: ['conversations'],
  products: ['products'],
  sellers: ['sellers'],
  profiles: ['users'],
  reviews: ['reviews'],
};

let channel: ReturnType<typeof supabase.channel> | null = null;
let pending = new Set<TableName>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Bursts of changes (e.g. accepting an order touches several tables) refresh screens once. */
function queue(tables: TableName[]) {
  tables.forEach((t) => pending.add(t));
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = [...pending];
    pending = new Set();
    emit(batch);
  }, 150);
}

function connect() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
  if (!session.userId()) return;
  let ch = supabase.channel(`live:${session.userId()}`);
  for (const table of Object.keys(STREAMED)) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => queue(STREAMED[table]));
  }
  channel = ch.subscribe();
}

session.onChange(connect);

export function onTablesChanged(tables: TableName[], callback: () => void): () => void {
  const watched = new Set(tables);
  return subscribe((changed) => {
    if (changed.some((t) => watched.has(t))) callback();
  });
}

/** Fires when the signed-in session changes, so screens opened before the session was restored can reload. */
export function onSessionChanged(callback: () => void): () => void {
  return session.onChange(callback);
}
