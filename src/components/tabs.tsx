import { Ionicons } from '@expo/vector-icons';
import { Platform, type ColorValue } from 'react-native';

import { colors, font } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Shared bottom-tab styling for the customer, seller and admin areas. */
export const tabScreenOptions = {
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
  tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.card, ...(Platform.OS === 'web' ? { height: 62, paddingBottom: 6 } : null) },
  tabBarBadgeStyle: { backgroundColor: colors.tomato, fontSize: 11 },
  headerShown: false,
  sceneStyle: { backgroundColor: colors.background },
} as const;

export function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={24} color={color as string} />;
  };
}
