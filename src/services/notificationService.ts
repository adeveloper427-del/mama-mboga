/**
 * In-app notification centre. Notifications are created in the database by
 * the functions that own the event (orders, inventory, messages) and reach
 * the app through Realtime.
 *
 * Push delivery (later): an Edge Function sends an Expo push / FCM message
 * whenever a notifications row is inserted; registerPushToken() stores the device token.
 */
import { appConfig } from '@/config';
import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import type { AppNotification } from '@/types/models';

import { request, unwrap } from './api';
import { toNotification } from './mappers';
import { requireUser } from './session';

export async function listNotifications(): Promise<AppNotification[]> {
  return request(async () => {
    const me = requireUser();
    const rows = unwrap(
      await supabase.from('notifications').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(100),
    );
    return rows.map(toNotification);
  });
}

export async function unreadCount(): Promise<number> {
  return request(async () => {
    const me = requireUser();
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', me.id)
      .eq('read', false);
    if (error) throw error;
    return count ?? 0;
  });
}

export async function markRead(id: string): Promise<void> {
  return request(async () => {
    const me = requireUser();
    unwrap(await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', me.id));
    emit(['notifications']);
  });
}

export async function markAllRead(): Promise<void> {
  return request(async () => {
    const me = requireUser();
    unwrap(await supabase.from('notifications').update({ read: true }).eq('user_id', me.id).eq('read', false));
    emit(['notifications']);
  });
}

export async function deleteNotification(id: string): Promise<void> {
  return request(async () => {
    const me = requireUser();
    unwrap(await supabase.from('notifications').delete().eq('id', id).eq('user_id', me.id));
    emit(['notifications']);
  });
}

export async function clearAll(): Promise<void> {
  return request(async () => {
    const me = requireUser();
    unwrap(await supabase.from('notifications').delete().eq('user_id', me.id));
    emit(['notifications']);
  });
}

/** Stores this device's push token once push notifications are enabled. */
export async function registerPushToken(token: string, platform: string): Promise<void> {
  if (!appConfig.features.pushNotifications) return;
  return request(async () => {
    const me = requireUser();
    const { error } = await supabase.from('device_tokens').insert({ user_id: me.id, token, platform });
    if (error && error.code !== '23505') throw error; // already registered is fine
  });
}
