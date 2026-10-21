import { router } from 'expo-router';
import { useState } from 'react';

import { AppText, Button, Header, Screen, TextField } from '@/components/ui';
import { useMutation } from '@/hooks/useMutation';
import { auth } from '@/services';
import { spacing } from '@/theme';
import { validatePassword } from '@/utils/validation';

export default function ChangePassword() {
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useMutation(async () => {
    await auth.changePassword(v.current, v.next);
    return true;
  }, {
    success: 'Password changed',
    toastErrors: false,
    onError: (e) => setErrors({ [e.field ?? 'current']: e.message }),
  });

  const set = (k: keyof typeof v) => (t: string) => {
    setV((p) => ({ ...p, [k]: t }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const e: Record<string, string | undefined> = {};
    if (!v.current) e.current = 'Enter your current password';
    e.next = validatePassword(v.next);
    if (v.next !== v.confirm) e.confirm = 'Passwords do not match';
    if (Object.values(e).some(Boolean)) return setErrors(e);
    if (await save.run()) router.back();
  };

  return (
    <Screen keyboard header={<Header title="Change password" />} footer={<Button title="Update password" size="lg" fullWidth loading={save.busy} onPress={submit} />}>
      <AppText variant="body" style={{ marginBottom: spacing.xl, marginTop: spacing.sm }}>
        Use at least 8 characters with letters and numbers. Avoid passwords you use elsewhere.
      </AppText>
      <TextField label="Current password" icon="lock-closed-outline" password value={v.current} onChangeText={set('current')} error={errors.current} autoComplete="current-password" />
      <TextField label="New password" icon="key-outline" password value={v.next} onChangeText={set('next')} error={errors.next} autoComplete="new-password" />
      <TextField label="Confirm new password" icon="key-outline" password value={v.confirm} onChangeText={set('confirm')} error={errors.confirm} autoComplete="new-password" />
    </Screen>
  );
}
