import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AreaField } from '@/components/AreaPicker';
import { AppText, Avatar, BottomSheet, Button, Chip, Header, ListGroup, ListItem, LoadingView, Screen, SmartImage, TextField } from '@/components/ui';
import { asset, type ImageKey } from '@/data/images';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { shop, storage } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { dayShort, formatPhone } from '@/utils/format';
import { validateForm, validatePhone, validateTime, required } from '@/utils/validation';

/** Bundled photos a seller can use as a shop cover without uploading one. */
const COVER_LIBRARY: ImageKey[] = ['marketNairobi', 'vendors', 'marketKisii', 'marketStall', 'darajani', 'vegetables', 'fruits', 'legumes', 'herbs'];

export default function ShopSettings() {
  const { user } = useAuth();
  const pick = useImagePicker();
  const q = useQuery(user ? `my-shop:${user.id}` : null, shop.getMyShop, ['sellers']);
  const [loaded, setLoaded] = useState(false);
  const [v, setV] = useState({ businessName: '', description: '', area: '', addressLine: '', landmark: '', phone: '', open: '07:00', close: '19:00', deliveryFee: '0', minOrder: '0' });
  const [days, setDays] = useState<number[]>([]);
  const [delivery, setDelivery] = useState(true);
  const [pickup, setPickup] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [coverUrl, setCoverUrl] = useState<string | undefined>();
  const [library, setLibrary] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const s = q.data;
    if (!s || loaded) return;
    setV({
      businessName: s.businessName, description: s.description, area: s.area, addressLine: s.addressLine, landmark: s.landmark ?? '',
      phone: formatPhone(s.phone), open: s.hours.open, close: s.hours.close, deliveryFee: String(s.deliveryFee), minOrder: String(s.minOrder),
    });
    setDays(s.hours.days);
    setDelivery(s.offersDelivery);
    setPickup(s.offersPickup);
    setLogoUrl(s.logoUrl);
    setCoverUrl(s.coverUrl);
    setLoaded(true);
  }, [q.data, loaded]);

  const save = useMutation(
    async () => {
      await shop.updateMyShop({
        businessName: v.businessName, description: v.description, area: v.area, addressLine: v.addressLine, landmark: v.landmark || undefined,
        phone: v.phone, hours: { open: v.open, close: v.close, days }, offersDelivery: delivery, offersPickup: pickup,
        deliveryFee: Number(v.deliveryFee || 0), minOrder: Number(v.minOrder || 0), logoUrl, coverUrl,
      });
      return true;
    },
    { success: 'Shop profile saved', toastErrors: false, onError: (e) => setErrors({ [e.field ?? 'businessName']: e.message }) },
  );
  const upload = useMutation(storage.uploadImage);

  const set = (k: keyof typeof v) => (t: string) => {
    setV((p) => ({ ...p, [k]: t }));
    setErrors((e) => ({ ...e, [k]: undefined, hours: undefined }));
  };

  const choose = async (which: 'logo' | 'cover') => {
    const img = await pick(which === 'logo' ? [1, 1] : [16, 9]);
    if (!img) return;
    const url = await upload.run(img, 'shops');
    if (url) (which === 'logo' ? setLogoUrl : setCoverUrl)(url);
  };

  const submit = async () => {
    const e: Record<string, string | undefined> = validateForm(v, {
      businessName: required('Business name'),
      addressLine: required('Location'),
      phone: validatePhone,
      open: validateTime,
      close: validateTime,
    });
    if (!e.open && !e.close && v.open >= v.close) e.close = 'Closing time must be after opening';
    if (!days.length) e.days = 'Choose at least one day';
    if (!delivery && !pickup) e.fulfilment = 'Offer delivery, pickup or both';
    if (Object.values(e).some(Boolean)) return setErrors(e);
    if (await save.run()) router.back();
  };

  if (!loaded) return <Screen header={<Header title="Shop profile" />} scroll={false}><LoadingView /></Screen>;

  return (
    <Screen keyboard header={<Header title="Shop profile" />} footer={<Button title="Save shop profile" size="lg" fullWidth loading={save.busy} onPress={submit} />}>
      <Pressable onPress={() => choose('cover')} style={styles.cover} accessibilityRole="button" accessibilityLabel="Change cover photo">
        <SmartImage src={coverUrl} style={StyleSheet.absoluteFill} fallbackIcon="image-outline" />
        <View style={styles.coverBadge}>
          <Ionicons name="camera" size={14} color={colors.white} />
          <AppText variant="caption" color={colors.white} style={{ fontWeight: '600' }}>
            Cover photo
          </AppText>
        </View>
      </Pressable>
      <Pressable onPress={() => choose('logo')} style={styles.logo} accessibilityRole="button" accessibilityLabel="Change shop logo">
        <Avatar name={v.businessName || 'Shop'} uri={logoUrl} size={80} ring />
        <View style={styles.logoCam}>
          <Ionicons name="camera" size={14} color={colors.white} />
        </View>
      </Pressable>
      <Button title="Choose from market photos" variant="ghost" size="sm" icon="images-outline" onPress={() => setLibrary(true)} style={{ alignSelf: 'flex-start', marginTop: -spacing.md, marginBottom: spacing.md }} />

      <TextField label="Business name" icon="storefront-outline" value={v.businessName} onChangeText={set('businessName')} error={errors.businessName} />
      <TextField label="About your shop" optional multiline placeholder="What makes your produce special?" value={v.description} onChangeText={set('description')} maxLength={500} />
      <TextField label="Phone for customers" icon="call-outline" keyboardType="phone-pad" value={v.phone} onChangeText={set('phone')} error={errors.phone} />

      <AppText variant="h3" style={styles.section}>Location</AppText>
      <AreaField value={v.area} onChange={set('area')} error={errors.area} />
      <TextField label="Stall / shop location" icon="navigate-outline" value={v.addressLine} onChangeText={set('addressLine')} error={errors.addressLine} />
      <TextField label="Landmark" optional icon="flag-outline" value={v.landmark} onChangeText={set('landmark')} />

      <AppText variant="h3" style={styles.section}>Opening hours</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label="Opens" icon="sunny-outline" placeholder="07:00" value={v.open} onChangeText={set('open')} error={errors.open} maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Closes" icon="moon-outline" placeholder="19:00" value={v.close} onChangeText={set('close')} error={errors.close} maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <AppText variant="label" style={{ marginBottom: spacing.sm }}>Working days</AppText>
      <View style={styles.days}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <Chip
            key={d}
            label={dayShort(d)}
            selected={days.includes(d)}
            onPress={() => {
              setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
              setErrors((e) => ({ ...e, days: undefined }));
            }}
          />
        ))}
      </View>
      {!!errors.days && <AppText variant="small" color={colors.danger} style={{ marginTop: 6 }}>{errors.days}</AppText>}

      <AppText variant="h3" style={styles.section}>Delivery & pickup</AppText>
      <ListGroup>
        <ListItem icon="bicycle-outline" title="I deliver" subtitle="Customers pay a delivery fee" toggle={{ value: delivery, onChange: (x) => { setDelivery(x); setErrors((e) => ({ ...e, fulfilment: undefined })); } }} />
        <ListItem icon="walk-outline" title="Customers can pick up" toggle={{ value: pickup, onChange: (x) => { setPickup(x); setErrors((e) => ({ ...e, fulfilment: undefined })); } }} last />
      </ListGroup>
      {!!errors.fulfilment && <AppText variant="small" color={colors.danger} style={{ marginTop: 6 }}>{errors.fulfilment}</AppText>}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        {delivery && (
          <View style={{ flex: 1 }}>
            <TextField label="Delivery fee" prefix="KSh" keyboardType="number-pad" value={v.deliveryFee} onChangeText={(t) => set('deliveryFee')(t.replace(/\D/g, ''))} error={errors.deliveryFee} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <TextField label="Minimum order" prefix="KSh" keyboardType="number-pad" value={v.minOrder} onChangeText={(t) => set('minOrder')(t.replace(/\D/g, ''))} error={errors.minOrder} hint="0 = no minimum" />
        </View>
      </View>

      <BottomSheet visible={library} onClose={() => setLibrary(false)} title="Market photos" subtitle="Pick a cover photo for your shop">
        <View style={styles.libGrid}>
          {COVER_LIBRARY.map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                setCoverUrl(asset(k));
                setLibrary(false);
              }}
              style={[styles.libItem, coverUrl === asset(k) && { borderColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${k} photo as cover`}
            >
              <SmartImage src={asset(k)} style={StyleSheet.absoluteFill} />
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  libGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  libItem: { width: '48%', aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent' },
  cover: { height: 150, borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.sm },
  coverBadge: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  logo: { alignSelf: 'flex-start', marginTop: -40, marginLeft: spacing.lg, marginBottom: spacing.lg },
  logoCam: { position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  section: { marginTop: spacing.lg, marginBottom: spacing.md },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
