/**
 * Mama Mboga design tokens.
 * Every component reads colours, spacing and type from here so the whole app stays consistent.
 */

export const colors = {
  // Brand — fresh leaf greens with warm market accents
  primary: '#1B7F4B',
  primaryDark: '#14532D',
  primaryLight: '#E7F4EC',
  accent: '#F08A24', // mango — highlights, promos
  accentLight: '#FEF1E3',
  tomato: '#E2483D', // prices on sale, destructive
  tomatoLight: '#FDECEA',

  // Surfaces
  background: '#F5F7F4',
  card: '#FFFFFF',
  muted: '#EEF2EE',

  // Text
  text: '#14231A',
  textSecondary: '#4A5A50',
  textMuted: '#7D8C83',
  textOnPrimary: '#FFFFFF',

  // Lines
  border: '#E1E8E3',
  divider: '#EDF1EE',

  // Status
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',

  overlay: 'rgba(10, 25, 15, 0.45)',
  white: '#FFFFFF',
  black: '#000000',
};

export const gradients = {
  brand: ['#14532D', '#1B7F4B'] as const,
  fresh: ['#1B7F4B', '#3FA66B'] as const,
  sunrise: ['#F08A24', '#F6B34A'] as const,
  fade: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)'] as const,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const font = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    hero: 30,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

/** Soft card shadow (boxShadow works on Android, iOS and web in RN 0.86). */
export const shadow = {
  sm: { boxShadow: '0px 1px 3px rgba(20, 35, 26, 0.08)', elevation: 1 },
  md: { boxShadow: '0px 4px 14px rgba(20, 35, 26, 0.08)', elevation: 3 },
  lg: { boxShadow: '0px 10px 30px rgba(20, 35, 26, 0.14)', elevation: 8 },
};

/** Minimum comfortable touch target (WCAG / Material guidance). */
export const TOUCH = 44;
