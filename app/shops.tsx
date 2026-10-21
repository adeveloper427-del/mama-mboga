import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { ShopCard } from '@/components/ShopCard';
import { Chip, EmptyState, ErrorState, Header, Screen, SkeletonList, TextField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { catalog } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { colors, spacing } from '@/theme';

export default function Shops() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [nearby, setNearby] = useState(true);
  const [openOnly, setOpenOnly] = useState(false);
  const q = useQuery(`shops:list:${user?.area}:${nearby}`, () => catalog.listShops({ area: user?.area, nearbyOnly: nearby }), ['sellers', 'users', 'products']);

  const term = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter((s) => (!term || s.businessName.toLowerCase().includes(term) || s.area.toLowerCase().includes(term)) && (!openOnly || s.isOpenNow));

  return (
    <Screen header={<Header title="Shops" subtitle={user?.area ? `Sorted by distance from ${user.area}` : undefined} />} scroll={false} padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <TextField placeholder="Search shops or areas" icon="search" value={search} onChangeText={setSearch} autoCorrect={false} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.md }}>
          <Chip label="Near me" icon="location-outline" selected={nearby} onPress={() => setNearby((v) => !v)} />
          <Chip label="Open now" icon="time-outline" selected={openOnly} onPress={() => setOpenOnly((v) => !v)} />
        </View>
      </View>
      {q.loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList rows={5} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <ShopCard shop={item} variant="row" />}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title="No shops found"
              message={nearby ? 'No sellers near you match. Try showing all areas.' : 'Try a different search.'}
              actionLabel={nearby ? 'Show all areas' : undefined}
              onAction={() => setNearby(false)}
            />
          }
        />
      )}
    </Screen>
  );
}
