import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, ErrorState, Header, IconButton, LoadingView, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { messages, toApiError } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { colors, radius, spacing } from '@/theme';
import { formatDate, formatTime, isSameDay } from '@/utils/format';

const QUICK_REPLIES = {
  customer: ['Is this available today?', 'Can you deliver before 6pm?', 'Asante!'],
  seller: ['Yes, it is available ✅', 'Your order is on the way 🛵', 'Karibu tena!'],
};

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const q = useQuery(`conversation:${id}`, () => messages.getConversation(id), ['messages']);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList>(null);

  const count = q.data?.messages.length ?? 0;
  useEffect(() => {
    if (count) messages.markConversationRead(id).catch(() => {});
  }, [id, count]);

  const send = async (body = text) => {
    const msg = body.trim();
    if (!msg || sending) return;
    setSending(true);
    setText('');
    try {
      await messages.sendMessage(id, msg);
    } catch (e) {
      setText(msg); // keep what they typed
      toast.show(toApiError(e).message, 'error');
    } finally {
      setSending(false);
    }
  };

  if (q.loading) return <Screen header={<Header title="Chat" />} scroll={false}><LoadingView /></Screen>;
  const conv = q.data;
  if (!conv) return <Screen header={<Header title="Chat" />} scroll={false}><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;

  const data = [...conv.messages].reverse(); // inverted list: newest at the bottom

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <Header
          title={conv.title}
          subtitle={user?.role === 'customer' ? 'Shop' : 'Customer'}
          border
          right={!!conv.phone && <IconButton icon="call-outline" label={`Call ${conv.title}`} onPress={() => Linking.openURL(`tel:${conv.phone}`)} />}
        />
      }
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 56}>
        <FlatList
          ref={list}
          inverted
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          renderItem={({ item, index }) => {
            const mine = item.senderId === user?.id;
            const older = data[index + 1];
            const showDate = !older || !isSameDay(new Date(older.createdAt), new Date(item.createdAt));
            return (
              <View>
                {showDate && (
                  <AppText variant="caption" align="center" style={styles.date}>
                    {isSameDay(new Date(item.createdAt), new Date()) ? 'Today' : formatDate(item.createdAt)}
                  </AppText>
                )}
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <AppText variant="body" color={mine ? colors.white : colors.text}>
                    {item.body}
                  </AppText>
                  <AppText variant="caption" color={mine ? 'rgba(255,255,255,0.75)' : colors.textMuted} align="right" style={{ marginTop: 2 }}>
                    {formatTime(item.createdAt)}
                  </AppText>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
              <Avatar name={conv.title} uri={conv.avatarUrl} size={64} />
              <AppText variant="h3" style={{ marginTop: spacing.md }}>
                Start a conversation
              </AppText>
              <AppText variant="small" align="center">
                Ask about prices, freshness or delivery times.
              </AppText>
            </View>
          }
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {!text && (
            <View style={styles.quick}>
              {QUICK_REPLIES[user?.role === 'seller' ? 'seller' : 'customer'].map((r) => (
                <Pressable key={r} onPress={() => send(r)} style={styles.quickChip} accessibilityRole="button">
                  <AppText variant="small" color={colors.primaryDark}>
                    {r}
                  </AppText>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={1000}
              accessibilityLabel="Message"
            />
            <Pressable
              onPress={() => send()}
              disabled={!text.trim() || sending}
              style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Ionicons name="send" size={20} color={colors.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: { marginVertical: spacing.sm },
  bubble: { maxWidth: '80%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  composer: { backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  quickChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primaryLight },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: colors.muted, paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: colors.text, outlineStyle: 'none' } as never,
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
