import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AreaField } from '@/components/AreaPicker';
import { AppText, Avatar, Button, Header, Screen, TextField } from '@/components/ui';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useMutation } from '@/hooks/useMutation';
import { auth, storage } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { colors, spacing } from '@/theme';
import { formatPhone } from '@/utils/format';
import { validateEmail, validateForm, validateName, validatePhone } from '@/utils/validation';

export default function Profile() {
  const { user } = useAuth();
  const pick = useImagePicker();
  const [v, setV] = useState({ fullName: user?.fullName ?? '', phone: user ? formatPhone(user.phone) : '', email: user?.email ?? '', area: user?.area ?? '' });
  const [avatar, setAvatar] = useState(user?.avatarUrl);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useMutation(() => auth.updateProfile({ ...v, avatarUrl: avatar ?? null }), {
    success: 'Profile updated',
    toastErrors: false,
    onError: (e) => setErrors({ [e.field ?? 'fullName']: e.message }),
  });
  const upload = useMutation(storage.uploadImage);

  if (!user) return null;

  const set = (k: keyof typeof v) => (t: string) => {
    setV((p) => ({ ...p, [k]: t }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const changePhoto = async () => {
    const img = await pick([1, 1]);
    if (!img) return;
    const url = await upload.run(img, 'avatars');
    if (url) setAvatar(url);
  };

  const submit = async () => {
    const e = validateForm(v, { fullName: validateName, phone: validatePhone, email: validateEmail });
    if (Object.keys(e).length) return setErrors(e);
    if (await save.run()) router.back();
  };

  return (
    <Screen keyboard header={<Header title="Edit profile" />} footer={<Button title="Save changes" size="lg" fullWidth loading={save.busy} onPress={submit} />}>
      <View style={styles.avatarWrap}>
        <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <Avatar name={v.fullName || user.fullName} uri={avatar} size={104} />
          <View style={styles.camera}>
            <Ionicons name="camera" size={18} color={colors.white} />
          </View>
        </Pressable>
        {avatar && (
          <Button title="Remove photo" variant="ghost" size="sm" onPress={() => setAvatar(undefined)} />
        )}
      </View>
      <TextField label="Full name" icon="person-outline" value={v.fullName} onChangeText={set('fullName')} error={errors.fullName} autoCapitalize="words" />
      <TextField label="Phone number" icon="call-outline" keyboardType="phone-pad" value={v.phone} onChangeText={set('phone')} error={errors.phone} />
      <TextField label="Email address" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" value={v.email} onChangeText={set('email')} error={errors.email} />
      {user.role !== 'admin' && <AreaField value={v.area} onChange={set('area')} />}
      <AppText variant="caption">
        Member since {new Date(user.createdAt).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', marginVertical: spacing.xl, gap: spacing.sm },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background },
});
