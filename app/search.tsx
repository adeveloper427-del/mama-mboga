import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ProductBrowser } from '@/components/ProductBrowser';
import { ShopCard } from '@/components/ShopCard';
import { AppText, Chip, IconButton, Screen, SegmentedControl, goBack } from '@/components/ui';
import { useLocalList } from '@/hooks/useLocalList';
import { useQuery } from '@/hooks/useQuery';
import { catalog } from '@/services';
import { POPULAR_SEARCHES, type ProductSort } from '@/services/catalogService';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { storageKeys } from '@/utils/storage';

export default function Search() {
  const params = useLocalSearchParams<{ q?: string; sort?: ProductSort }>();
  const { user } = useAuth();
  const [text, setText] = useState(params.q ?? '');
  const [term, setTerm] = useState(params.q ?? '');
  const [tab, setTab] = useState<'products' | 'shops'>('products');
  const history = useLocalList(user ? storageKeys.searchHistory(user.id) : null, 8);

  // Debounce typing so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const shops = useQuery(term ? `shops:search:${term}` : null, () => catalog.listShops({ search: term, area: user?.area }), ['sellers']);
  const browsing = term.length > 0 || !!params.sort;

  const submit = (value = text) => {
    const v = value.trim();
    if (!v) return;
    setText(v);
    setTerm(v);
    history.push(v);
  };

  return (
    <Screen padded={false} scroll={false}>
      <View style={styles.bar}>
        <IconButton icon="arrow-back" label="Go back" onPress={() => goBack('/home')} />
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search produce or shops"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus={!params.sort}
            returnKeyType="search"
            onSubmitEditing={() => submit()}
            autoCorrect={false}
            accessibilityLabel="Search"
            maxLength={60}
          />
          {!!text && (
            <Pressable onPress={() => setText('')} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {!browsing ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {history.items.length > 0 && (
            <>
              <View style={styles.rowBetween}>
                <AppText variant="h3">Recent searches</AppText>
                <Pressable onPress={history.clear} hitSlop={8}>
                  <AppText variant="label" color={colors.primary}>
                    Clear
                  </AppText>
                </Pressable>
              </View>
              {history.items.map((h) => (
                <Pressable key={h} onPress={() => submit(h)} style={styles.historyRow} accessibilityRole="button">
                  <Ionicons name="time-outline" size={18} color={colors.textMuted} />
                  <AppText variant="body" color={colors.text} style={{ flex: 1 }}>
                    {h}
                  </AppText>
                  <Pressable onPress={() => history.removeItem(h)} hitSlop={10} accessibilityLabel={`Remove ${h}`}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </Pressable>
              ))}
            </>
          )}
          <AppText variant="h3" style={{ marginTop: history.items.length ? spacing.xl : 0, marginBottom: spacing.md }}>
            Popular searches
          </AppText>
          <View style={styles.wrap}>
            {POPULAR_SEARCHES.map((s) => (
              <Chip key={s} label={s} icon="trending-up" onPress={() => submit(s)} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <>
          {term.length > 0 && (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
              <SegmentedControl
                value={tab}
                onChange={setTab}
                segments={[
                  { value: 'products', label: 'Products' },
                  { value: 'shops', label: 'Shops', count: shops.data?.length },
                ]}
              />
            </View>
          )}
          {tab === 'products' || !term ? (
            <ProductBrowser search={term} initialSort={params.sort} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
              {shops.data?.length ? (
                shops.data.map((s) => <ShopCard key={s.id} shop={s} variant="row" />)
              ) : (
                <AppText variant="body" align="center" color={colors.textMuted} style={{ marginTop: spacing.xxl }}>
                  No shops match "{term}"
                </AppText>
              )}
            </ScrollView>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 48, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: spacing.md, borderWidth: 1.5, borderColor: colors.primary, marginRight: spacing.sm },
  input: { flex: 1, fontSize: 16, color: colors.text, outlineStyle: 'none' } as never,
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
