/**
 * Design tokens — Colors
 *
 * Deep red for primary actions, alerts, flagged/danger states.
 * Black/near-black for primary text and high-emphasis figures.
 * White as dominant surface. Avoid overusing red.
 */

export const colors = {
  // ─── Primary ──────────────────────────────
  primary: {
    DEFAULT: '#8A0F13',
    50:  '#FEF2F2',
    100: '#FDE3E3',
    200: '#FCCDCD',
    300: '#F9A8A8',
    400: '#F27476',
    500: '#E84749',
    600: '#D52B2E',
    700: '#B21E21',
    800: '#8A0F13',
    900: '#761316',
    950: '#410507',
  },

  // ─── Neutrals ─────────────────────────────
  neutral: {
    0:   '#FFFFFF',
    50:  '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },

  // ─── Status (non-traffic-light) ───────────
  status: {
    blocked:     '#8A0F13',   // Deep red
    flagged:     '#C2393D',   // Mid red
    underReview: '#F2D5D6',   // Muted pink tint (bg)
    underReviewText: '#8A0F13', // Deep red text on pink bg
    completed:   '#404040',   // Dark gray
    completedBg: '#F5F5F5',   // Light gray bg
    pending:     '#737373',   // Medium gray
  },

  // ─── Semantic ─────────────────────────────
  background: '#FFFFFF',
  surface:    '#FAFAFA',
  card:       '#FFFFFF',
  border:     '#E5E5E5',
  textPrimary:   '#171717',
  textSecondary: '#525252',
  textMuted:     '#A3A3A3',
} as const;

export type ColorToken = typeof colors;
