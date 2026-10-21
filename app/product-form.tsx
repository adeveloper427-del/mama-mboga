import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Chip, Header, ListGroup, ListItem, LoadingView, Screen, SmartImage, TextField } from '@/components/ui';
import { asset, type ImageKey } from '@/data/images';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { catalog, products, storage } from '@/services';
import { useDialog } from '@/store/DialogContext';
import { colors, radius, spacing } from '@/theme';
import { UNITS, type Unit } from '@/types/models';
import { formatQty, perUnit, unitLabel } from '@/utils/format';
import { validateForm, validatePrice, validateWholeNumber } from '@/utils/validation';

const LIBRARY: ImageKey[] = [
  'kale', 'spinach', 'managu', 'cabbage', 'kunde', 'tomatoes', 'onions', 'carrots', 'capsicum', 'frenchBeans', 'eggplant',
  'bananas', 'mangoes', 'avocados', 'oranges', 'watermelon', 'pineapple', 'passion', 'lemons', 'potatoes', 'sweetPotatoes',
  'cassava', 'arrowroots', 'dhania', 'garlic', 'ginger', 'chillies', 'beans', 'greenGrams', 'maize', 'eggs',
];

export default function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const dialog = useDialog();
  const pick = useImagePicker();
  const categories = useQuery('categories', catalog.listCategories, ['categories']);
  const existing = useQuery(id ? `my-product:${id}` : null, () => products.getMyProduct(id!), ['products']);

  const [v, setV] = useState({ name: '', description: '', price: '', stock: '', threshold: '5' });
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState<Unit>('kg');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [available, setAvailable] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [library, setLibrary] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => {
    const p = existing.data;
    if (!p || loaded) return;
    setV({ name: p.name, description: p.description, price: String(p.price), stock: String(p.stock), threshold: String(p.lowStockThreshold) });
    setCategoryId(p.categoryId);
    setUnit(p.unit);
    setImageUrl(p.imageUrl);
    setAvailable(p.isAvailable);
    setLoaded(true);
  }, [existing.data, loaded]);

  const onError = (e: { field?: string; message: string }) => setErrors({ [e.field === 'lowStockThreshold' ? 'threshold' : (e.field ?? 'name')]: e.message });
  const create = useMutation(products.createProduct, { success: (p) => `${p.name} added to your shop`, toastErrors: false, onError });
  const update = useMutation((pid: string, input: Parameters<typeof products.updateProduct>[1]) => products.updateProduct(pid, input), { success: 'Product updated', toastErrors: false, onError });
  const remove = useMutation(
    async (pid: string) => {
      await products.deleteProduct(pid);
      return true;
    },
    { success: 'Product removed' },
  );
  const upload = useMutation(storage.uploadImage);

  const set = (k: keyof typeof v) => (t: string) => {
    setV((p) => ({ ...p, [k]: t }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const choosePhoto = async () => {
    const img = await pick([4, 3]);
    if (!img) return;
    const url = await upload.run(img, 'products');
    if (url) setImageUrl(url);
  };

  const submit = async () => {
    const e = validateForm(v, {
      name: (t) => (t.trim().length < 2 ? 'Enter a product name' : undefined),
      price: validatePrice,
      threshold: validateWholeNumber('Alert level', { max: 10000 }),
      ...(editing ? {} : { stock: validateWholeNumber('Stock', { max: 100000 }) }),
    });
    if (!categoryId) (e as Record<string, string>).categoryId = 'Choose a category';
    if (Object.keys(e).length) return setErrors(e);

    const base = {
      name: v.name,
      description: v.description,
      categoryId,
      unit,
      price: Number(v.price),
      lowStockThreshold: Number(v.threshold),
      imageUrl,
      isAvailable: available,
    };
    const ok = editing ? await update.run(id!, base) : await create.run({ ...base, stock: Number(v.stock) });
    if (ok) router.back();
  };

  const del = async () => {
    const yes = await dialog.confirm({
      title: `Remove ${v.name}?`,
      message: 'Customers will no longer see it. Your past orders and sales records are kept.',
      confirmLabel: 'Remove product',
      destructive: true,
      icon: 'trash-outline',
    });
    if (yes && (await remove.run(id!))) router.back();
  };

  if (editing && !loaded) return <Screen header={<Header title="Edit product" />} scroll={false}><LoadingView /></Screen>;
  const busy = create.busy || update.busy;
  const pricePreview = Number(v.price) > 0 ? `KSh ${Number(v.price).toLocaleString()} ${perUnit(unit)}` : undefined;

  return (
    <Screen
      keyboard
      header={<Header title={editing ? 'Edit product' : 'Add product'} />}
      footer={<Button title={editing ? 'Save changes' : 'Add to my shop'} size="lg" fullWidth loading={busy} onPress={submit} icon="checkmark" />}
    >
      {/* Photo */}
      <Pressable onPress={choosePhoto} style={styles.photo} accessibilityRole="button" accessibilityLabel={imageUrl ? 'Change photo' : 'Add photo'}>
        {imageUrl ? (
          <SmartImage src={imageUrl} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.photoEmpty}>
            <Ionicons name="camera-outline" size={36} color={colors.primary} />
            <AppText variant="title" color={colors.primaryDark}>
              Add a photo
            </AppText>
            <AppText variant="caption">Clear photos sell up to 3× more</AppText>
          </View>
        )}
        {imageUrl && (
          <View style={styles.photoBadge}>
            <Ionicons name="camera" size={16} color={colors.white} />
            <AppText variant="caption" color={colors.white} style={{ fontWeight: '600' }}>
              Change
            </AppText>
          </View>
        )}
      </Pressable>
      <Button title="Choose from produce photos" variant="ghost" size="sm" icon="images-outline" onPress={() => setLibrary(true)} style={{ alignSelf: 'center', marginBottom: spacing.md }} />

      <TextField label="Product name" placeholder="e.g. Sukuma Wiki" value={v.name} onChangeText={set('name')} error={errors.name} autoCapitalize="words" maxLength={60} />

      <AppText variant="label" style={styles.label}>
        Category
      </AppText>
      <View style={styles.wrap}>
        {categories.data?.map((c) => (
          <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => { setCategoryId(c.id); setErrors((e) => ({ ...e, categoryId: undefined })); }} />
        ))}
      </View>
      {!!errors.categoryId && <AppText variant="small" color={colors.danger} style={{ marginTop: 6 }}>{errors.categoryId}</AppText>}

      <AppText variant="label" style={[styles.label, { marginTop: spacing.lg }]}>
        Sold per
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}>
        {UNITS.map((u) => (
          <Chip key={u} label={unitLabel(u)} selected={unit === u} onPress={() => setUnit(u)} />
        ))}
      </ScrollView>

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <TextField label="Price" prefix="KSh" keyboardType="decimal-pad" placeholder="0" value={v.price} onChangeText={set('price')} error={errors.price} hint={pricePreview} />
        </View>
        <View style={{ flex: 1 }}>
          {editing ? (
            <View style={{ marginBottom: spacing.lg }}>
              <AppText variant="label" style={{ marginBottom: spacing.sm }}>
                In stock
              </AppText>
              <Pressable style={styles.stockBox} onPress={() => router.push(`/stock/${id}`)} accessibilityRole="button" accessibilityLabel="Adjust stock">
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {formatQty(Number(existing.data?.stock ?? v.stock), unit)}
                </AppText>
                <AppText variant="label" color={colors.primary}>
                  Adjust
                </AppText>
              </Pressable>
            </View>
          ) : (
            <TextField label="Quantity in stock" keyboardType="number-pad" placeholder="0" suffix={unitLabel(unit, 2)} value={v.stock} onChangeText={set('stock')} error={errors.stock} />
          )}
        </View>
      </View>

      <TextField
        label="Low-stock alert at"
        keyboardType="number-pad"
        value={v.threshold}
        onChangeText={set('threshold')}
        error={errors.threshold}
        suffix={unitLabel(unit, 2)}
        hint="We'll notify you when stock falls to this level"
      />
      <TextField label="Description" optional multiline placeholder="Freshness, origin, how to cook it…" value={v.description} onChangeText={set('description')} maxLength={600} />

      <ListGroup>
        <ListItem
          icon={available ? 'eye-outline' : 'eye-off-outline'}
          title="Visible to customers"
          subtitle={available ? 'Customers can find and order this' : 'Hidden — customers cannot order it'}
          toggle={{ value: available, onChange: setAvailable }}
          last
        />
      </ListGroup>

      {editing && (
        <Button title="Remove product" variant="danger" icon="trash-outline" fullWidth style={{ marginTop: spacing.xl }} loading={remove.busy} onPress={del} />
      )}

      <BottomSheet visible={library} onClose={() => setLibrary(false)} title="Produce photos" subtitle="Pick a photo that matches your product">
        <View style={styles.libGrid}>
          {LIBRARY.map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                setImageUrl(asset(k));
                setLibrary(false);
              }}
              style={[styles.libItem, imageUrl === asset(k) && { borderColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${k} photo`}
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
  photo: { height: 200, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.primaryLight, marginTop: spacing.sm, marginBottom: spacing.sm, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9FD3B4' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoBadge: { position: 'absolute', right: spacing.md, bottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  label: { marginBottom: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  stockBox: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.card },
  libGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  libItem: { width: '31%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent' },
});
