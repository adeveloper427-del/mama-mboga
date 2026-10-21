import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, ErrorState, Header, Screen, SegmentedControl, SkeletonList, TextField } from '@/components/ui';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { admin } from '@/services';
import { useDialog } from '@/store/DialogContext';
import { colors, radius, spacing } from '@/theme';
import type { Role } from '@/types/models';
import { formatDate, formatPhone } from '@/utils/format';

export default function AdminUsers() {
  const dialog = useDialog();
  const [role, setRole] = useState<Role>('customer');
  const [search, setSearch] = useState('');
  const q = useQuery(`admin:users:${role}`, () => admin.listUsers(role), ['users']);
  const status = useMutation((id: string, s: 'active' | 'suspended') => admin.setUserStatus(id, s), { success: 'Account updated' });

  const term = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter((u) => !term || u.fullName.toLowerCase().includes(term) || u.email.includes(term) || u.phone.includes(term));

  return (
    <Screen header={<Header title="Users" back={false} large />} scroll={false} padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SegmentedControl
          value={role}
          onChange={setRole}
          segments={[
            { value: 'customer', label: 'Customers' },
            { value: 'seller', label: 'Sellers' },
          ]}
        />
        <View style={{ marginTop: spacing.md }}>
          <TextField placeholder="Search name, email or phone" icon="search" value={search} onChangeText={setSearch} autoCapitalize="none" />
        </View>
      </View>
      {q.loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList rows={6} height={70} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item: u }) => {
            const suspended = u.status === 'suspended';
            return (
              <View style={styles.row}>
                <Avatar name={u.fullName} uri={u.avatarUrl} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <AppText variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {u.fullName}
                    </AppText>
                    {suspended && <Badge label="Suspended" tone="danger" />}
                  </View>
                  <AppText variant="caption" numberOfLines={1}>
                    {u.email} · {formatPhone(u.phone)}
                  </AppText>
                  <AppText variant="caption">
                    {u.area ?? '—'} · joined {formatDate(u.createdAt)}
                  </AppText>
                </View>
                <Button
                  title={suspended ? 'Restore' : 'Suspend'}
                  size="sm"
                  variant={suspended ? 'secondary' : 'danger'}
                  onPress={async () => {
                    const ok = await dialog.confirm({
                      title: suspended ? `Restore ${u.fullName}?` : `Suspend ${u.fullName}?`,
                      message: suspended ? 'They will be able to sign in again.' : 'They will be signed out and blocked from signing in.',
                      confirmLabel: suspended ? 'Restore' : 'Suspend',
                      destructive: !suspended,
                    });
                    if (ok) status.run(u.id, suspended ? 'active' : 'suspended');
                  }}
                />
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg },
});
