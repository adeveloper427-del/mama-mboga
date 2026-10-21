import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { resolveImage } from '@/data/images';
import { colors, font } from '@/theme';
import { initials } from '@/utils/format';

const PALETTE = ['#1B7F4B', '#F08A24', '#2563EB', '#7C3AED', '#0E9384', '#E2483D', '#B7791F'];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

interface Props {
  name: string;
  uri?: string;
  size?: number;
  ring?: boolean;
}

export function Avatar({ name, uri, size = 44, ring }: Props) {
  const src = resolveImage(uri);
  const dims = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[dims, ring && styles.ring, { overflow: 'hidden' }]} accessibilityLabel={`${name} picture`}>
      {src ? (
        <Image source={src} style={dims} contentFit="cover" transition={150} />
      ) : (
        <View style={[dims, styles.fallback, { backgroundColor: colorFor(name) }]}>
          <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name) || '?'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 3, borderColor: colors.white },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, fontWeight: font.weight.bold },
});
