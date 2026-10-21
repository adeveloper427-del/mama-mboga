import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Screen, TextField } from '@/components/ui';
import { auth, toApiError } from '@/services';
import { useToast } from '@/store/ToastContext';
import { colors, radius, spacing } from '@/theme';
import { validatePassword } from '@/utils/validation';

type Step = 'request' | 'reset' | 'done';

export default function ForgotPassword() {
  const toast = useToast();
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  const request = async () => {
    if (!identifier.trim()) return setErrors({ identifier: 'Enter your email address' });
    setBusy(true);
    try {
      const res = await auth.requestPasswordReset(identifier);
      setDestination(res.destination);
      setStep('reset');
    } catch (e) {
      setErrors({ identifier: toApiError(e).message });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const e: Record<string, string | undefined> = {};
    if (!/^\d{6}$/.test(code.trim())) e.code = 'Enter the 6-digit code';
    e.password = validatePassword(password);
    if (e.code || e.password) return setErrors(e);
    setBusy(true);
    try {
      await auth.resetPassword(identifier, code, password);
      setStep('done');
    } catch (err) {
      const a = toApiError(err);
      setErrors({ [a.field ?? 'code']: a.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      keyboard
      header={<Header title="Reset password" />}
      footer={
        step === 'request' ? (
          <Button title="Send reset code" size="lg" fullWidth loading={busy} onPress={request} />
        ) : step === 'reset' ? (
          <Button title="Set new password" size="lg" fullWidth loading={busy} onPress={reset} />
        ) : (
          <Button title="Back to sign in" size="lg" fullWidth onPress={() => router.replace('/login')} />
        )
      }
    >
      {step === 'request' && (
        <>
          <Icon name="key-outline" />
          <AppText variant="h1">Forgot your password?</AppText>
          <AppText variant="body" style={styles.lead}>
            Enter the email address on your account and we'll email you a 6-digit code to reset it.
          </AppText>
          <TextField
            label="Email address"
            icon="mail-outline"
            placeholder="you@example.com"
            value={identifier}
            onChangeText={(t) => { setIdentifier(t); setErrors({}); }}
            error={errors.identifier}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={request}
          />
        </>
      )}

      {step === 'reset' && (
        <>
          <Icon name="mail-unread-outline" />
          <AppText variant="h1">Check your email</AppText>
          <AppText variant="body" style={styles.lead}>
            If an account exists for {destination}, we've sent a 6-digit code. It expires in 1 hour; check your spam folder if you can't find it.
          </AppText>
          <TextField label="6-digit code" icon="keypad-outline" placeholder="123456" value={code} onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setErrors({}); }} error={errors.code} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" />
          <TextField label="New password" icon="lock-closed-outline" placeholder="At least 8 characters" password value={password} onChangeText={(t) => { setPassword(t); setErrors({}); }} error={errors.password} autoComplete="new-password" />
          <Button title="Resend code" variant="ghost" onPress={async () => { await request(); toast.show('A new code has been sent', 'success'); }} />
        </>
      )}

      {step === 'done' && (
        <View style={{ alignItems: 'center', marginTop: spacing.xxxl }}>
          <Icon name="checkmark-circle" />
          <AppText variant="h1" align="center">Password updated</AppText>
          <AppText variant="body" align="center" style={styles.lead}>
            You've been signed out on all devices. Sign in with your new password.
          </AppText>
        </View>
      )}
    </Screen>
  );
}

function Icon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.icon}>
      <Ionicons name={name} size={30} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  lead: { marginTop: spacing.sm, marginBottom: spacing.xxl },
});
