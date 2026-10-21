import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  prefix?: string;
  suffix?: string;
  right?: ReactNode;
  password?: boolean;
  optional?: boolean;
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, icon, prefix, suffix, right, password, optional, multiline, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrap}>
      {label && (
        <Text style={styles.label} maxFontSizeMultiplier={1.3}>
          {label}
          {optional && <Text style={styles.optional}>  (optional)</Text>}
        </Text>
      )}
      <View style={[styles.field, { borderColor }, focused && styles.focused, multiline && styles.multiline]}>
        {icon && <Ionicons name={icon} size={20} color={focused ? colors.primary : colors.textMuted} style={styles.icon} />}
        {prefix && <Text style={styles.affix}>{prefix}</Text>}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={password && hidden}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          maxFontSizeMultiplier={1.3}
          {...rest}
        />
        {suffix && <Text style={styles.affix}>{suffix}</Text>}
        {password && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        )}
        {right}
      </View>
      {error ? (
        <View style={styles.msgRow}>
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.text, marginBottom: spacing.sm },
  optional: { fontWeight: font.weight.regular, color: colors.textMuted },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  focused: { backgroundColor: '#FBFEFC' },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  icon: { marginRight: 2 },
  affix: { fontSize: font.size.md, color: colors.textMuted, fontWeight: font.weight.medium },
  input: { flex: 1, fontSize: font.size.md, color: colors.text, paddingVertical: spacing.md, outlineStyle: 'none' } as never,
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  error: { fontSize: font.size.sm, color: colors.danger, flex: 1 },
  hint: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 6 },
});
