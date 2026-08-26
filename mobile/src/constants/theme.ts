/**
 * Design tokens — graphite grounds with an ice-cyan accent, the palette of the
 * work itself: dark paint, glass gloss, water beading under showroom light.
 * The same values drive the admin panel (as OKLCH) and the launcher icon, so
 * the product reads as one system.
 *
 * Grounds are deliberately not pure #fff / #000 — a soft off-white and a deep
 * blue-black let raised surfaces (cards, sheets) read as raised, which pure
 * white-on-white and black-on-black cannot. Neutrals carry a slight blue bias
 * so the greys read as chosen rather than inherited.
 *
 * Every foreground/background pair here is checked against WCAG AA (4.5:1 for
 * text, 3:1 for muted text and UI accents). If you change a value, re-check —
 * `success` in particular sat at 4.36:1 against its own soft ground before it
 * was darkened.
 *
 * `success` is no longer an alias of `primary`. Now that the accent is cyan,
 * "this worked" needs its own green or the two meanings collapse.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Grounds and surfaces, lowest to highest.
    background: '#F5F7F9',
    surface: '#FFFFFF',
    surfaceSunk: '#EBEFF3',

    // Text, strongest to weakest.
    text: '#10161C',
    textSecondary: '#54626E',
    textMuted: '#78868F',

    border: '#DFE5EB',

    primary: '#0B6E82',
    primaryText: '#FFFFFF',
    primarySoft: '#E2F2F6',

    error: '#C0392B',
    errorSoft: '#FBEAE8',
    warning: '#8A6410',
    warningSoft: '#FAF1DE',
    success: '#14713A',
    successSoft: '#E7F5EC',

    // Retained so screens not yet migrated keep compiling.
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EBEFF3',
  },
  dark: {
    background: '#0B0F13',
    surface: '#151B22',
    surfaceSunk: '#10151A',

    text: '#E9EEF3',
    textSecondary: '#9AA7B3',
    textMuted: '#7A8894',

    border: '#232C35',

    primary: '#3ED8E8',
    primaryText: '#04191E',
    primarySoft: '#10262C',

    error: '#F0796B',
    errorSoft: '#2B1815',
    warning: '#DCA84A',
    warningSoft: '#2A2113',
    success: '#4ADE80',
    successSoft: '#12291C',

    backgroundElement: '#151B22',
    backgroundSelected: '#10151A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii. `full` is a pill. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

/**
 * Elevation. iOS reads shadows, Android reads `elevation`, so both are set.
 * Shadows are tuned for the light ground; on dark, surfaces separate mainly
 * through their own lighter fill rather than a shadow nobody can see.
 */
export const Elevation = {
  card: Platform.select({
    ios: {
      shadowColor: '#10161C',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: '#10161C',
      shadowOpacity: 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }),
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
