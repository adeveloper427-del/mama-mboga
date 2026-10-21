import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AreaField } from '@/components/AreaPicker';
import { Button, Chip, Header, ListGroup, ListItem, Screen, TextField } from '@/components/ui';
import { useMutation } from '@/hooks/useMutation';
import { addresses } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { spacing } from '@/theme';
import { formatPhone } from '@/utils/format';
import { required, validateForm, validatePhone } from '@/utils/validation';

const LABELS = ['Home', 'Work', 'Other'];

export default function AddressForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const [v, setV] = useState({ label: 'Home', area: user?.area ?? '', addressLine: '', landmark: '', phone: user ? formatPhone(user.phone) : '' });
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useMutation(() => addresses.saveAddress({ ...v, isDefault }, id), {
    success: id ? 'Address updated' : 'Address saved',
    toastErrors: false,
    onError: (e) => setErrors({ [e.field ?? 'addressLine']: e.message }),
  });

  useEffect(() => {
    if (!id) return;
    addresses.listAddresses().then((list) => {
      const a = list.find((x) => x.id === id);
      if (a) {
        setV({ label: a.label, area: a.area, addressLine: a.addressLine, landmark: a.landmark ?? '', phone: formatPhone(a.phone) });
        setIsDefault(a.isDefault);
      }
    });
  }, [id]);

  const set = (k: keyof typeof v) => (t: string) => {
    setV((p) => ({ ...p, [k]: t }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const e = validateForm(v, { label: required('Label'), area: required('Area'), addressLine: required('Address'), phone: validatePhone });
    if (Object.keys(e).length) return setErrors(e);
    const res = await save.run();
    if (res) router.back();
  };

  return (
    <Screen keyboard header={<Header title={id ? 'Edit address' : 'New address'} />} footer={<Button title="Save address" size="lg" fullWidth loading={save.busy} onPress={submit} />}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        {LABELS.map((l) => (
          <Chip key={l} label={l} icon={l === 'Home' ? 'home-outline' : l === 'Work' ? 'briefcase-outline' : 'location-outline'} selected={v.label === l} onPress={() => set('label')(l)} />
        ))}
      </View>
      <AreaField value={v.area} onChange={set('area')} error={errors.area} />
      <TextField label="Building, house or street" placeholder="e.g. Apartment 4B, Ndemi Court" icon="business-outline" value={v.addressLine} onChangeText={set('addressLine')} error={errors.addressLine} />
      <TextField label="Landmark" optional placeholder="e.g. Opposite Yaya Centre" icon="flag-outline" value={v.landmark} onChangeText={set('landmark')} hint="Helps the rider find you faster" />
      <TextField label="Contact phone for rider" icon="call-outline" keyboardType="phone-pad" value={v.phone} onChangeText={set('phone')} error={errors.phone} />
      <ListGroup>
        <ListItem title="Set as default address" subtitle="Used automatically at checkout" icon="star-outline" toggle={{ value: isDefault, onChange: setIsDefault }} last />
      </ListGroup>
    </Screen>
  );
}
