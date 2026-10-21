import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Avatar, Button, Chip, Header, RatingStars, Screen, TextField } from '@/components/ui';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { orders, reviews } from '@/services';
import { colors, spacing } from '@/theme';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent!'];
const QUICK = ['Fresh produce', 'Fast service', 'Well packed', 'Friendly seller', 'Fair prices'];

export default function Review() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const order = useQuery(`order:${orderId}`, () => orders.getOrder(orderId), ['orders']);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const submit = useMutation(() => reviews.submitReview(orderId, rating, comment), { success: 'Thank you for your review!' });

  const toggleQuick = (q: string) => setComment((c) => (c.includes(q) ? c.replace(q, '').replace(/^,\s*|,\s*$|,\s*(?=,)/g, '').trim() : c ? `${c}, ${q}` : q));

  return (
    <Screen
      keyboard
      header={<Header title="Rate your order" />}
      footer={
        <Button
          title="Submit review"
          size="lg"
          fullWidth
          disabled={!rating}
          loading={submit.busy}
          onPress={async () => {
            if (await submit.run()) router.back();
          }}
        />
      }
    >
      {order.data && (
        <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
          <Avatar name={order.data.shopName} uri={order.data.shopLogoUrl} size={80} />
          <AppText variant="h2" align="center" style={{ marginTop: spacing.md }}>
            How was {order.data.shopName}?
          </AppText>
          <AppText variant="small" align="center">
            Order {order.data.code}
          </AppText>
          <View style={{ marginTop: spacing.xl }}>
            <RatingStars value={rating} size={40} onChange={setRating} />
          </View>
          <AppText variant="h3" color={rating ? colors.accent : colors.textMuted} style={{ marginTop: spacing.sm, minHeight: 24 }}>
            {rating ? LABELS[rating] : 'Tap a star to rate'}
          </AppText>
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.lg, justifyContent: 'center' }}>
        {QUICK.map((q) => (
          <Chip key={q} label={q} selected={comment.includes(q)} onPress={() => toggleQuick(q)} />
        ))}
      </View>
      <TextField label="Tell others about your experience" optional multiline placeholder="What did you like? What could be better?" value={comment} onChangeText={setComment} maxLength={500} />
    </Screen>
  );
}
