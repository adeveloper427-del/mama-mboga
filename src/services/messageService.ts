/**
 * Customer ↔ seller messaging. One conversation per customer/shop pair.
 * A database trigger updates the conversation preview, unread counters and
 * the recipient's notification whenever a message is inserted; Realtime
 * delivers new messages to the other side.
 */
import { emit } from '@/backend/events';
import { supabase } from '@/backend/supabase';
import type { ConversationView, Message } from '@/types/models';
import { sanitizeText } from '@/utils/validation';

import { fail, request, rpc, unwrap } from './api';
import { toConversation, toMessage, type Row } from './mappers';
import { requireUser } from './session';

const CONVERSATION_SELECT =
  '*, customer:profiles(full_name, avatar_url, phone), shop:sellers(business_name, logo_url, cover_url, phone)';

function toView(r: Row, meId: string): ConversationView & { otherUserId: string; phone: string } {
  const c = toConversation(r);
  const isCustomer = c.customerId === meId;
  return {
    ...c,
    title: isCustomer ? (r.shop?.business_name ?? 'Shop') : (r.customer?.full_name ?? 'Customer'),
    avatarUrl: (isCustomer ? (r.shop?.logo_url ?? r.shop?.cover_url) : r.customer?.avatar_url) ?? undefined,
    unread: isCustomer ? c.unreadByCustomer : c.unreadBySeller,
    otherUserId: isCustomer ? c.sellerId : c.customerId,
    phone: (isCustomer ? r.shop?.phone : r.customer?.phone) ?? '',
  };
}

export async function listConversations(): Promise<ConversationView[]> {
  return request(async () => {
    const me = requireUser('customer', 'seller');
    const rows = unwrap(await supabase.from('conversations').select(CONVERSATION_SELECT).order('last_message_at', { ascending: false }));
    return rows.map((r) => toView(r, me.id));
  });
}

export async function unreadMessageCount(): Promise<number> {
  return request(async () => {
    const me = requireUser();
    if (me.role === 'admin') return 0;
    const rows = unwrap(await supabase.from('conversations').select('customer_id, unread_by_customer, unread_by_seller'));
    return rows.reduce((sum, c) => sum + (c.customer_id === me.id ? c.unread_by_customer : c.unread_by_seller), 0);
  });
}

/** Customer opens a chat with a shop (created on first use). */
export async function openConversationWithShop(sellerId: string): Promise<string> {
  return request(async () => {
    requireUser('customer');
    const id = await rpc<string>('open_conversation', { p_seller_id: sellerId });
    emit(['conversations']);
    return id;
  });
}

/** Seller opens a chat with a customer from an order. */
export async function openConversationWithCustomer(customerId: string): Promise<string> {
  return request(async () => {
    requireUser('seller');
    const id = await rpc<string>('open_conversation_with_customer', { p_customer_id: customerId });
    emit(['conversations']);
    return id;
  });
}

export async function getConversation(id: string): Promise<ConversationView & { messages: Message[]; otherUserId: string; phone: string }> {
  return request(async () => {
    const me = requireUser();
    const [conv, msgs] = await Promise.all([
      supabase.from('conversations').select(CONVERSATION_SELECT).eq('id', id).maybeSingle().then(unwrap),
      supabase.from('messages').select('*').eq('conversation_id', id).order('created_at').limit(500).then(unwrap),
    ]);
    if (!conv) return fail('not_found', 'Conversation not found');
    return { ...toView(conv, me.id), unread: 0, messages: msgs.map(toMessage) };
  });
}

export async function markConversationRead(id: string): Promise<void> {
  return request(async () => {
    requireUser();
    await rpc('mark_conversation_read', { p_conversation_id: id });
    emit(['conversations', 'notifications']);
  });
}

export async function sendMessage(conversationId: string, text: string): Promise<Message> {
  return request(async () => {
    const me = requireUser('customer', 'seller');
    const body = sanitizeText(text, 1000);
    if (!body) fail('validation', 'Type a message');
    const row = unwrap(
      await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: me.id, body }).select('*').single(),
    );
    emit(['messages', 'conversations']);
    return toMessage(row);
  });
}
