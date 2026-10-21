import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { haptic } from '@/utils/haptics';

interface Props {
  value: number;
  size?: number;
  onChange?: (value: number) => void;
}

const STAR = '#F5A524';

export function RatingStars({ value, size = 16, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`${value} out of 5 stars`} accessibilityRole={onChange ? 'adjustable' : 'text'}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        const star = <Ionicons name={name} size={size} color={value >= i - 0.5 ? STAR : colors.border} />;
        if (!onChange) return <View key={i}>{star}</View>;
        return (
          <Pressable
            key={i}
            onPress={() => {
              haptic.tap();
              onChange(i);
            }}
            hitSlop={6}
            accessibilityLabel={`${i} star${i > 1 ? 's' : ''}`}
            style={{ padding: 4 }}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 2 } });
