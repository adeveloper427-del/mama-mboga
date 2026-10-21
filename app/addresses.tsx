import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, EmptyState, ErrorState, Header, IconButton, Screen, SkeletonList } from '@/components/ui';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { addresses } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useDialog } from '@/store/DialogContext';
import { colors, radius, spacing } from '@/theme';
import { formatPhone } from '@/utils/format';

export default function Addresses() {
  const { user } = useAuth();
  const dialog = useDialog();
  const q = useQuery(user ? `addresses:${user.id}` : null, addresses.listAddresses, ['addresses']);
  const del = useMutation(addresses.deleteAddress, { success: 'Address deleted' });

  return (
    <Screen
      header={<Header title="Delivery addresses" />}
      refreshing={q.refreshing}
      onRefresh={q.refetch}
      footer={<Button title="Add new address" icon="add" size="lg" fullWidth onPress={() => router.push('/address-form')} />}
    >
      {q.loading ? (
        <SkeletonList rows={2} />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState icon="location-outline" title="No saved addresses" message="Add your home or work address for faster checkout." />
      ) : (
        q.data.map((a) => (
          <Card key={a.id} style={{ marginBottom: spacing.md }} onPress={() => router.push({ pathname: '/address-form', params: { id: a.id } })} accessibilityLabel={`Edit ${a.label} address`}>
            <View style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name={a.label.toLowerCase() === 'work' ? 'briefcase-outline' : 'home-outline'} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <AppText variant="title">{a.label}</AppText>
                  {a.isDefault && <Badge label="Default" tone="primary" />}
                </View>
                <AppText variant="small">
                  {a.addressLine}, {a.area}
                </AppText>
                {!!a.landmark && <AppText variant="caption">{a.landmark}</AppText>}
                <AppText variant="caption">{formatPhone(a.phone)}</AppText>
              </View>
              <IconButton
                icon="trash-outline"
                label={`Delete ${a.label}`}
                color={colors.danger}
                onPress={async () => {
                  if (await dialog.confirm({ title: `Delete "${a.label}"?`, confirmLabel: 'Delete', destructive: true })) del.run(a.id);
                }}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
