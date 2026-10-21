import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { LayoutAnimation, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Chip, Header, ListGroup, ListItem, Screen } from '@/components/ui';
import { appConfig } from '@/config';
import { useAuth } from '@/store/AuthContext';
import { colors, spacing } from '@/theme';

type Audience = 'customer' | 'seller';

const FAQ: { q: string; a: string; for: Audience | 'all' }[] = [
  { for: 'customer', q: 'How do I place an order?', a: 'Find a product, choose the quantity and tap Add. Open your cart, tap Proceed to checkout, choose delivery or pickup, then Place order. The shop is notified immediately.' },
  { for: 'customer', q: 'Can I order from more than one shop?', a: 'Yes. Your cart groups items by shop, and checkout creates a separate order for each shop so each mama mboga can prepare hers.' },
  { for: 'customer', q: 'How do I pay?', a: 'Right now you pay in cash on delivery or at pickup. M-Pesa payments are coming soon and will appear at checkout once available.' },
  { for: 'customer', q: 'Can I cancel an order?', a: 'You can cancel for free while the order is Pending. Once the shop accepts it, message the seller to ask for changes.' },
  { for: 'customer', q: 'How do I track my order?', a: 'Open Orders and tap the order. The timeline updates live as the seller accepts, prepares and sends it, and you also get a notification at each step.' },
  { for: 'seller', q: 'How do I add a product?', a: 'Go to Products and tap Add product. Add a clear photo, the price per unit (kg, bunch, heap…), how many you have, and a low-stock alert level.' },
  { for: 'seller', q: 'When does my stock go down?', a: 'Stock is reserved the moment you accept an order, so you never sell the same item twice. If the order is cancelled, the stock is returned automatically.' },
  { for: 'seller', q: 'How do I handle a new order?', a: 'Open the order and tap Accept (or Decline with a reason). Then move it along: Start preparing → Ready → Out for delivery → Delivered & paid.' },
  { for: 'seller', q: 'How do I stop orders for the day?', a: 'Turn off "Accepting orders" on your dashboard. Customers can still see your shop but cannot place new orders until you turn it back on.' },
  { for: 'seller', q: 'Where can I see my sales?', a: 'Your dashboard shows today\'s sales and the last 7 days. Tap Sales report for 7, 30 or 90-day totals, best sellers and customer insights.' },
  { for: 'all', q: 'I forgot my password', a: 'On the sign-in screen tap Forgot password, enter your email or phone number and follow the code we send you.' },
  { for: 'all', q: 'Is my information safe?', a: 'Your password is never stored in plain text, and only you and the shops you order from can see your order details and phone number.' },
];

export default function Help() {
  const { user } = useAuth();
  const [audience, setAudience] = useState<Audience>(user?.role === 'seller' ? 'seller' : 'customer');
  const [open, setOpen] = useState<string | null>(null);
  const items = FAQ.filter((f) => f.for === 'all' || f.for === audience);

  return (
    <Screen header={<Header title="Help & support" />}>
      <Card style={{ backgroundColor: colors.primaryDark }}>
        <AppText variant="h2" color={colors.white}>
          How can we help?
        </AppText>
        <AppText variant="body" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
          Our team is available Monday – Saturday, 7am – 8pm.
        </AppText>
      </Card>

      <ListGroup title="Contact us">
        <ListItem icon="logo-whatsapp" iconColor="#16A34A" iconBg="#DCFCE7" title="Chat on WhatsApp" subtitle="Fastest response" onPress={() => Linking.openURL(`https://wa.me/${appConfig.supportWhatsApp}`)} />
        <ListItem icon="call-outline" title="Call support" subtitle={appConfig.supportPhone} onPress={() => Linking.openURL(`tel:${appConfig.supportPhone}`)} />
        <ListItem icon="mail-outline" title="Email us" subtitle={appConfig.supportEmail} onPress={() => Linking.openURL(`mailto:${appConfig.supportEmail}?subject=Mama%20Mboga%20support`)} last />
      </ListGroup>

      <View style={styles.faqHead}>
        <AppText variant="h3">Frequently asked questions</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Chip label="Buying" selected={audience === 'customer'} onPress={() => setAudience('customer')} />
          <Chip label="Selling" selected={audience === 'seller'} onPress={() => setAudience('seller')} />
        </View>
      </View>

      <View style={styles.faq}>
        {items.map((f, i) => {
          const isOpen = open === f.q;
          return (
            <Pressable
              key={f.q}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setOpen(isOpen ? null : f.q);
              }}
              style={[styles.faqItem, i < items.length - 1 && styles.divider]}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <View style={styles.faqQ}>
                <AppText variant="title" style={{ flex: 1 }}>
                  {f.q}
                </AppText>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </View>
              {isOpen && (
                <AppText variant="body" style={{ marginTop: spacing.sm }}>
                  {f.a}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  faqHead: { marginTop: spacing.xxl, marginBottom: spacing.md },
  faq: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' },
  faqItem: { padding: spacing.lg },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
