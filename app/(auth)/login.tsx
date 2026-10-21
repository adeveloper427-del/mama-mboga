import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { AuthHero } from '@/components/AuthHero';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { toApiError } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';
import { homeFor } from '@/utils/routes';

export default function Login() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    const id = identifier;
    const pw = password;
    const next: typeof errors = {};
    if (!id.trim()) next.identifier = 'Enter your email address';
    if (!pw) next.password = 'Enter your password';
    setErrors(next);
    if (next.identifier || next.password) return;
    setBusy(true);
    try {
      const user = await signIn(id, pw);
      haptic.success();
      router.replace(homeFor(user.role) as never);
    } catch (e) {
      haptic.error();
      setErrors({ form: toApiError(e).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen keyboard>
      <AuthHero title="Welcome back" subtitle="Sign in to continue to Mama Mboga" />

      {!!errors.form && (
        <View style={styles.formError} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <AppText variant="small" color={colors.danger} style={{ flex: 1 }}>
            {errors.form}
          </AppText>
        </View>
      )}

      <TextField
        label="Email address"
        placeholder="you@example.com"
        icon="mail-outline"
        value={identifier}
        onChangeText={(t) => {
          setIdentifier(t);
          setErrors((e) => ({ ...e, identifier: undefined, form: undefined }));
        }}
        error={errors.identifier}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        placeholder="Your password"
        icon="lock-closed-outline"
        password
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setErrors((e) => ({ ...e, password: undefined, form: undefined }));
        }}
        error={errors.password}
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Link href="/forgot-password" asChild>
        <Pressable style={styles.forgot} hitSlop={8} accessibilityRole="link">
          <AppText variant="label" color={colors.primary}>
            Forgot password?
          </AppText>
        </Pressable>
      </Link>

      <Button title="Sign in" size="lg" fullWidth loading={busy} onPress={submit} />

      <View style={styles.footer}>
        <AppText variant="body">New to Mama Mboga?</AppText>
        <Link href="/register" asChild>
          <Pressable hitSlop={8} accessibilityRole="link">
            <AppText variant="bodyStrong" color={colors.primary}>
              Create an account
            </AppText>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formError: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.xl, paddingVertical: 4 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.xxxl, flexWrap: 'wrap' },
});
