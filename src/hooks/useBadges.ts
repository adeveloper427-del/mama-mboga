import { messages, notifications } from '@/services';
import { useAuth } from '@/store/AuthContext';

import { useQuery } from './useQuery';

/** Unread counts for the bell and chat icons; updates live. */
export function useBadges() {
  const { user } = useAuth();
  const key = user ? user.id : null;
  const notif = useQuery(key && `unread-notifs:${key}`, notifications.unreadCount, ['notifications']);
  const chat = useQuery(
    key && user?.role !== 'admin' ? `unread-msgs:${key}` : null,
    messages.unreadMessageCount,
    ['conversations'],
  );
  return { notifications: notif.data ?? 0, messages: chat.data ?? 0 };
}
