import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Header, ListGroup, ListItem, Screen } from '@/components/ui';
import { appConfig } from '@/config';
import { IMAGES } from '@/data/images';
import { colors, radius, spacing } from '@/theme';

const PILLARS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'storefront-outline', title: 'Digital shop for every mama mboga', body: 'List produce, take orders and reach customers beyond the stall.' },
  { icon: 'stats-chart-outline', title: 'Records that build credit', body: 'Automatic sales and stock records help traders understand and grow their business.' },
  { icon: 'people-outline', title: 'Fresh food, closer to home', body: 'Customers buy from trusted local sellers in their own estate.' },
];

export default function About() {
  return (
    <Screen header={<Header title={`About ${appConfig.name}`} />}>
      <View style={styles.hero}>
        <Image source={IMAGES.marketNairobi} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(20,83,45,0.2)', 'rgba(20,83,45,0.92)']} style={StyleSheet.absoluteFill} />
        <View style={styles.heroText}>
          <AppText variant="h1" color={colors.white}>
            {appConfig.name}
          </AppText>
          <AppText variant="body" color="rgba(255,255,255,0.9)">
            {appConfig.tagline}
          </AppText>
        </View>
      </View>

      <AppText variant="body" style={{ marginTop: spacing.xl }}>
        Mama Mboga is a marketplace and business tool for Kenya's small-scale fresh-produce vendors. It replaces notebooks and
        memory with simple digital inventory, order management and sales tracking — while giving customers an easy way to buy
        fresh produce from the mama mbogas they already trust.
      </AppText>

      {PILLARS.map((p) => (
        <Card key={p.title} style={styles.pillar}>
          <View style={styles.pillarIcon}>
            <Ionicons name={p.icon} size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{p.title}</AppText>
            <AppText variant="small">{p.body}</AppText>
          </View>
        </Card>
      ))}

      <ListGroup title="App information">
        <ListItem icon="code-slash-outline" title="Version" value={appConfig.version} />
        <ListItem icon="school-outline" title="Project" subtitle="BSc Computer Science final-year project, Umma University" />
        <ListItem icon="person-outline" title="Developer" value="Noordin Ali Bute" />
        <ListItem icon="images-outline" title="Photo credits" subtitle="Produce and market photographs from Wikimedia Commons contributors, used under Creative Commons licences" last />
      </ListGroup>
      <AppText variant="caption" align="center" style={{ marginTop: spacing.xl }}>
        © {new Date().getFullYear()} {appConfig.name}. Made in Kenya 🇰🇪
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 180, borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.sm },
  heroText: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: spacing.xl },
  pillar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  pillarIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
