import { useWindowDimensions } from 'react-native';

import { spacing } from '@/theme';

/** Card width for an N-column grid inside a screen with standard side padding. */
export function useGridWidth(columns = 2, gap = spacing.md, sidePadding = spacing.lg) {
  const { width } = useWindowDimensions();
  const usable = Math.min(width, 720) - sidePadding * 2;
  const cols = width >= 600 ? columns + 1 : columns; // tablets / wide web get an extra column
  return { itemWidth: Math.floor((usable - gap * (cols - 1)) / cols), columns: cols, gap };
}
