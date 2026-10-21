import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './ui';

/** Brand mark + heading shared by the sign-in / sign-up screens. */
export function AuthHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.logo}>
        <Ionicons name="basket" size={30} color={colors.white} />
        <View style={styles.leaf}>
          <Ionicons name="leaf" size={12} color={colors.white} />
        </View>
      </View>
      <AppText variant="h1" style={{ marginTop: spacing.xl }}>
        {title}
      </AppText>
      <AppText variant="body" style={{ marginTop: spacing.xs }}>
        {subtitle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  logo: { width: 60, height: 60, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  leaf: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background },
});
