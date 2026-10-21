import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageContentFit } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { resolveImage } from '@/data/images';
import { colors } from '@/theme';

interface Props {
  src?: string;
  style?: StyleProp<ViewStyle>;
  fit?: ImageContentFit;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackTint?: string;
  accessibilityLabel?: string;
}

/**
 * Cached image (expo-image keeps memory + disk caches) with a soft fade-in and
 * a branded placeholder when there is no picture or it fails to load.
 */
export function SmartImage({ src, style, fit = 'cover', fallbackIcon = 'leaf-outline', fallbackTint = colors.primary, accessibilityLabel }: Props) {
  const [failed, setFailed] = useState(false);
  const source = resolveImage(src);
  return (
    <View style={[styles.wrap, style]} accessibilityLabel={accessibilityLabel} accessible={!!accessibilityLabel} accessibilityRole="image">
      {source && !failed ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={src}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: `${fallbackTint}14` }]}>
          <Ionicons name={fallbackIcon} size={32} color={`${fallbackTint}99`} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colors.muted },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
