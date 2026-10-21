import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, radius, shadow, spacing } from '@/theme';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  /** Quick-pick answers shown as chips above the text box. */
  suggestions?: string[];
  required?: boolean;
}

interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Resolves with the entered text, or null if cancelled. */
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi>({
  confirm: async () => false,
  prompt: async () => null,
});

type State = (PromptOptions & { kind: 'confirm' | 'prompt' }) | null;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null);
  const [text, setText] = useState('');
  const resolver = useRef<((v: unknown) => void) | null>(null);

  const close = useCallback((value: unknown) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve as (v: unknown) => void;
        setState({ ...opts, kind: 'confirm' });
      }),
    [],
  );

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        resolver.current = resolve as (v: unknown) => void;
        setText('');
        setState({ ...opts, kind: 'prompt' });
      }),
    [],
  );

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);
  const isPrompt = state?.kind === 'prompt';
  const canSubmit = !isPrompt || !state?.required || text.trim().length > 0;
  const tone = state?.destructive ? colors.danger : colors.primary;

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => close(isPrompt ? null : false)} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close(isPrompt ? null : false)} accessibilityLabel="Close dialog" />
          {state && (
            <View style={styles.card} accessibilityViewIsModal>
              <View style={[styles.iconWrap, { backgroundColor: state.destructive ? colors.dangerLight : colors.primaryLight }]}>
                <Ionicons name={state.icon ?? (state.destructive ? 'alert-circle-outline' : 'help-circle-outline')} size={28} color={tone} />
              </View>
              <Text style={styles.title}>{state.title}</Text>
              {!!state.message && <Text style={styles.message}>{state.message}</Text>}

              {isPrompt && (
                <ScrollView style={{ maxHeight: 260, alignSelf: 'stretch' }} keyboardShouldPersistTaps="handled">
                  {!!state.suggestions?.length && (
                    <View style={styles.chips}>
                      {state.suggestions.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => setText(s)}
                          style={[styles.chip, text === s && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                        >
                          <Text style={[styles.chipText, text === s && { color: colors.primaryDark }]}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={state.placeholder ?? 'Type here…'}
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    multiline
                    maxLength={200}
                  />
                </ScrollView>
              )}

              <View style={styles.actions}>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => close(isPrompt ? null : false)} accessibilityRole="button">
                  <Text style={styles.btnGhostText}>{state.cancelLabel ?? 'Cancel'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, { backgroundColor: tone, opacity: canSubmit ? 1 : 0.5 }]}
                  disabled={!canSubmit}
                  onPress={() => close(isPrompt ? text.trim() : true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.btnText}>{state.confirmLabel ?? 'Confirm'}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </DialogContext.Provider>
  );
}

export const useDialog = () => useContext(DialogContext);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    ...shadow.lg,
  },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, textAlign: 'center' },
  message: { fontSize: font.size.md, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: font.size.sm, color: colors.textSecondary, fontWeight: font.weight.medium },
  input: {
    marginTop: spacing.md,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: font.size.md,
    color: colors.text,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl, alignSelf: 'stretch' },
  btn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: colors.muted },
  btnGhostText: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  btnText: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.white },
});
