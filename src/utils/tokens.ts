/**
 * IIC Design Token System
 * ─────────────────────────────────────────────────────────────────
 * CSS class names that map to CSS custom properties defined in index.css.
 * Use `tokens.*` in className props instead of hard-coded Tailwind strings
 * for radius, shadow, and card surface so the admin theme controls everything
 * from one place.
 *
 * Usage:
 *   import { tokens, cx } from '../utils/tokens';
 *   <div className={cx(tokens.card, tokens.shadow.md, 'p-4')} />
 */

export const tokens = {
  /** Border-radius classes ↔ --nst-r-* CSS variables */
  radius: {
    sm: 'nst-r-sm',
    md: 'nst-r-md',
    lg: 'nst-r-lg',
    xl: 'nst-r-xl',
  },

  /** Box-shadow classes ↔ --nst-shadow-* CSS variables */
  shadow: {
    sm: 'nst-shadow-sm',
    md: 'nst-shadow-md',
    lg: 'nst-shadow-lg',
  },

  /** Standard surface card — white bg, subtle border, token radius + shadow */
  card: 'nst-card',

  /** Brand-accented card — left border uses --nst-color-brand */
  cardBrand: 'nst-card-brand',

  /** Chapter list item — replaces inline rounded-xl border pattern */
  chapterCard: 'nst-chapter-card',

  /** MCQ option button — base state (unselected, unrevealed) */
  mcqOption: 'nst-mcq-option',

  /**
   * CSS variable names (without `var()`) for use in inline style objects.
   * Example: style={{ borderColor: `var(${tokens.var.brand})` }}
   */
  var: {
    brand:   '--nst-color-brand',
    surface: '--nst-color-surface',
    border:  '--nst-color-border',
    text:    '--nst-color-text',
    muted:   '--nst-color-muted',
    rSm:     '--nst-r-sm',
    rMd:     '--nst-r-md',
    rLg:     '--nst-r-lg',
    rXl:     '--nst-r-xl',
    shadowSm: '--nst-shadow-sm',
    shadowMd: '--nst-shadow-md',
    shadowLg: '--nst-shadow-lg',
  },
} as const;

/**
 * Merge class strings, filtering falsy values.
 * Zero-dep alternative to clsx/classnames.
 *
 * cx('foo', false && 'bar', null, 'baz') → 'foo baz'
 */
export function cx(...classes: (string | false | null | undefined | 0)[]): string {
  return classes.filter(Boolean).join(' ');
}
