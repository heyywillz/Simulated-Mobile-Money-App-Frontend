/**
 * Design tokens — Typography
 *
 * Satoshi as primary typeface, loaded via Fontshare API.
 * Fallback: -apple-system, Segoe UI, sans-serif.
 */

export const typography = {
  fontFamily: {
    primary: "'Satoshi', -apple-system, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },

  fontSize: {
    xs:   '0.75rem',   // 12px
    sm:   '0.875rem',  // 14px
    base: '1rem',      // 16px
    lg:   '1.125rem',  // 18px
    xl:   '1.25rem',   // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
  },

  fontWeight: {
    regular:  '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
    black:    '900',
  },

  lineHeight: {
    tight:  '1.2',
    snug:   '1.375',
    normal: '1.5',
    relaxed: '1.625',
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight:   '-0.025em',
    normal:  '0em',
    wide:    '0.025em',
  },
} as const;

/**
 * Fontshare CDN link for Satoshi (include in HTML <head>)
 */
export const SATOSHI_FONT_URL =
  'https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700,900&display=swap';

export type TypographyToken = typeof typography;
