// @ts-nocheck
import { User } from '../types';

export type UserTier = 'ultra' | 'basic' | 'free';

export const getUserTier = (
  user: Pick<User, 'isPremium' | 'subscriptionLevel' | 'subscriptionEndDate'>
): UserTier => {
  const isActive = user.isPremium
    ? user.subscriptionEndDate
      ? new Date(user.subscriptionEndDate) > new Date()
      : true
    : false;
  if (isActive && (user.subscriptionLevel === 'ULTRA' || (user.subscriptionLevel as any) === 'PRO'))
    return 'ultra';
  if (isActive && user.subscriptionLevel === 'BASIC') return 'basic';
  return 'free';
};

export const TIER_THEME = {
  ultra: {
    tier: 'ultra' as UserTier,
    primary:       '#1e3a8a',
    mid:           '#2563eb',
    light:         '#dbeafe',
    border:        '#1e3a8a',
    borderSoft:    '#bfdbfe',
    text:          '#1e3a8a',
    soft:          '#eff6ff',
    navGlow:       'rgba(96,165,250,0.12)',
    navBorder:     'rgba(255,255,255,0.08)',
    navRing:       'rgba(96,165,250,0.35)',
    pillGrad:      'linear-gradient(90deg,#2563eb,#60a5fa,#3b82f6)',
    topBarGrad:    'linear-gradient(135deg,#040912 0%,#08121f 45%,#040912 100%)',
    btnGrad:       'linear-gradient(135deg,#0a1628,#1e3a8a)',
    shadowColor:   'rgba(4,9,18,0.60)',
    profileBg:     '#040912',
    profileCardBg: '#08121f',
    navBg:         '#070d1a',
    label:         'ULTRA',
    emoji:         '💙',
    flashcardBg1:  '#040912',
    flashcardBg2:  '#08121f',
    chapterAccent: '#1e3a8a',
    mcqTabActive:  '#1e3a8a',
  },
  basic: {
    tier: 'basic' as UserTier,
    primary:       '#2563eb',
    mid:           '#3b82f6',
    light:         '#dbeafe',
    border:        '#60a5fa',
    borderSoft:    '#bfdbfe',
    text:          '#1d4ed8',
    soft:          '#eff6ff',
    navGlow:       'rgba(37,99,235,0.14)',
    navBorder:     'rgba(37,99,235,0.20)',
    navRing:       'rgba(37,99,235,0.22)',
    pillGrad:      'linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa)',
    topBarGrad:    'linear-gradient(135deg,#1d4ed8 0%,#2563eb 50%,#1e40af 100%)',
    btnGrad:       'linear-gradient(135deg,#2563eb,#3b82f6)',
    shadowColor:   'rgba(37,99,235,0.32)',
    profileBg:     '#0c1a4a',
    profileCardBg: '#122060',
    navBg:         '#ffffff',
    label:         'BASIC',
    emoji:         '⭐',
    flashcardBg1:  '#0c1a4a',
    flashcardBg2:  '#1d4ed8',
    chapterAccent: '#2563eb',
    mcqTabActive:  '#2563eb',
  },
  free: {
    tier: 'free' as UserTier,
    primary:       '#0ea5e9',
    mid:           '#38bdf8',
    light:         '#e0f2fe',
    border:        '#7dd3fc',
    borderSoft:    '#bae6fd',
    text:          '#0369a1',
    soft:          '#f0f9ff',
    navGlow:       'rgba(14,165,233,0.14)',
    navBorder:     'rgba(14,165,233,0.20)',
    navRing:       'rgba(14,165,233,0.22)',
    pillGrad:      'linear-gradient(90deg,#0284c7,#0ea5e9,#38bdf8)',
    topBarGrad:    'linear-gradient(135deg,#0284c7 0%,#0ea5e9 50%,#0369a1 100%)',
    btnGrad:       'linear-gradient(135deg,#0284c7,#0ea5e9)',
    shadowColor:   'rgba(14,165,233,0.28)',
    profileBg:     '#03131f',
    profileCardBg: '#062030',
    navBg:         '#ffffff',
    label:         'FREE',
    emoji:         '🎓',
    flashcardBg1:  '#03131f',
    flashcardBg2:  '#0284c7',
    chapterAccent: '#0ea5e9',
    mcqTabActive:  '#0ea5e9',
  },
} as const;

export const getTierTheme = (
  user: Pick<User, 'isPremium' | 'subscriptionLevel' | 'subscriptionEndDate'>
) => TIER_THEME[getUserTier(user)];

export const buildOverrideTierTheme = (
  base: typeof TIER_THEME[UserTier],
  hexColor: string,
  tier?: UserTier
) => {
  const hex = hexColor.replace('#', '').padEnd(6, '0');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Tier-aware luminosity: free=lighter, basic=medium, ultra=darkest
  const darkMult = tier === 'free' ? 0.32 : tier === 'basic' ? 0.18 : 0.12;
  const midMult  = tier === 'free' ? 0.55 : tier === 'basic' ? 0.30 : 0.20;
  const rD = Math.round(r * darkMult), gD = Math.round(g * darkMult), bD = Math.round(b * darkMult);
  const rM = Math.round(r * midMult),  gM = Math.round(g * midMult),  bM = Math.round(b * midMult);
  const rBg = Math.max(Math.round(r * 0.07), 3);
  const gBg = Math.max(Math.round(g * 0.07), 3);
  const bBg = Math.max(Math.round(b * 0.07), 3);
  const rCBg = Math.max(Math.round(r * 0.13), 5);
  const gCBg = Math.max(Math.round(g * 0.13), 5);
  const bCBg = Math.max(Math.round(b * 0.13), 5);
  return {
    ...base,
    primary:      hexColor,
    mid:          hexColor,
    border:       `rgba(${r},${g},${b},0.70)`,
    borderSoft:   `rgba(${r},${g},${b},0.28)`,
    text:         hexColor,
    navGlow:      `rgba(${r},${g},${b},0.16)`,
    navBorder:    `rgba(${r},${g},${b},0.22)`,
    navRing:      `rgba(${r},${g},${b},0.24)`,
    pillGrad:     `linear-gradient(90deg,${hexColor}bb,${hexColor},${hexColor}dd)`,
    btnGrad:      `linear-gradient(135deg,${hexColor}cc,${hexColor})`,
    shadowColor:  `rgba(${r},${g},${b},0.32)`,
    topBarGrad:   `linear-gradient(135deg,rgb(${rD},${gD},${bD}) 0%,rgb(${rM},${gM},${bM}) 50%,rgb(${rD},${gD},${bD}) 100%)`,
    profileBg:    base.profileBg,
    profileCardBg: base.profileCardBg,
    navBg:        base.navBg,
    flashcardBg1: `rgb(${rD},${gD},${bD})`,
    flashcardBg2: `rgb(${rM},${gM},${bM})`,
    chapterAccent: hexColor,
    mcqTabActive:  hexColor,
  };
};

// Build subColor helpers (for UniversalChat / FullBookCompare) from a hex color
export const buildSubColorsFromHex = (hexColor: string) => {
  const hex = hexColor.replace('#', '').padEnd(6, '0');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return {
    subColor:       hexColor,
    subColorLight:  `rgba(${r},${g},${b},0.08)`,
    subColorBorder: `rgba(${r},${g},${b},0.30)`,
  };
};

// Named theme presets for admin
export const ADMIN_NAMED_THEMES = [
  { id: 'GOLD',    name: 'Gold',       color: '#c8a020', emoji: '⚡' },
  { id: 'ROYAL',   name: 'Royal Blue', color: '#2563eb', emoji: '👑' },
  { id: 'NAVY',    name: 'Navy',       color: '#1e3a8a', emoji: '💙' },
  { id: 'EMERALD', name: 'Emerald',    color: '#059669', emoji: '💚' },
  { id: 'RUBY',    name: 'Ruby',       color: '#e11d48', emoji: '❤️' },
  { id: 'VIOLET',  name: 'Violet',     color: '#7c3aed', emoji: '💜' },
  { id: 'ORANGE',  name: 'Sunset',     color: '#f97316', emoji: '🔥' },
  { id: 'CYAN',    name: 'Cyan',       color: '#0891b2', emoji: '🌊' },
  { id: 'PINK',    name: 'Pink',       color: '#db2777', emoji: '🌸' },
  { id: 'LIME',    name: 'Lime',       color: '#65a30d', emoji: '🍀' },
  { id: 'SILVER',  name: 'Silver',     color: '#64748b', emoji: '⚪' },
  { id: 'MAROON',  name: 'Maroon',     color: '#9f1239', emoji: '🍷' },
] as const;

// Build a FULL tier-theme object from granular personalTheme colors.
// This ensures the new theme COMPLETELY replaces the old one — no layering.
export const buildGranularTierTheme = (
  base: typeof TIER_THEME[UserTier],
  t: {
    bgColor?: string; topBarStart?: string; topBarEnd?: string;
    navBg?: string; navBorder?: string; navActive?: string;
    cardBg?: string; cardColor?: string; cardBorder?: string;
    btnStart?: string; btnEnd?: string; accentColor?: string;
    textColor?: string; textSecondary?: string;
    accentGlow?: string; progressColor?: string;
  }
): typeof TIER_THEME[UserTier] => {
  const accent = t.btnStart || t.accentColor || base.primary;
  const hex = accent.replace('#', '').padEnd(6, '0');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const topBarGrad = (t.topBarStart && t.topBarEnd)
    ? `linear-gradient(135deg,${t.topBarStart},${t.topBarEnd})`
    : `linear-gradient(135deg,rgb(${Math.round(r*0.12)},${Math.round(g*0.12)},${Math.round(b*0.12)}) 0%,rgb(${Math.round(r*0.20)},${Math.round(g*0.20)},${Math.round(b*0.20)}) 50%,rgb(${Math.round(r*0.12)},${Math.round(g*0.12)},${Math.round(b*0.12)}) 100%)`;
  const btnGrad = (t.btnStart && t.btnEnd)
    ? `linear-gradient(135deg,${t.btnStart},${t.btnEnd})`
    : `linear-gradient(135deg,${accent}cc,${accent})`;
  const rBgD = Math.max(Math.round(r * 0.07), 3);
  const gBgD = Math.max(Math.round(g * 0.07), 3);
  const bBgD = Math.max(Math.round(b * 0.07), 3);
  const rCBgD = Math.max(Math.round(r * 0.13), 5);
  const gCBgD = Math.max(Math.round(g * 0.13), 5);
  const bCBgD = Math.max(Math.round(b * 0.13), 5);
  return {
    ...base,
    primary:         accent,
    mid:             t.accentGlow || accent,
    border:          `rgba(${r},${g},${b},0.70)`,
    borderSoft:      `rgba(${r},${g},${b},0.28)`,
    text:            accent,
    navGlow:         `rgba(${r},${g},${b},0.16)`,
    navBorder:       t.navBorder  ? `1px solid ${t.navBorder}` : `rgba(${r},${g},${b},0.22)`,
    navRing:         `rgba(${r},${g},${b},0.24)`,
    pillGrad:        `linear-gradient(90deg,${accent}bb,${accent},${accent}dd)`,
    btnGrad,
    shadowColor:     `rgba(${r},${g},${b},0.32)`,
    topBarGrad,
    profileBg:       (t.bgColor && t.bgColor !== '#ffffff' && t.bgColor !== '#f8fafc' && t.bgColor !== '#f1f5f9') ? t.bgColor : `rgb(${rBgD},${gBgD},${bBgD})`,
    profileCardBg:   (t.cardBg && t.cardBg !== '#ffffff' && t.cardBg !== '#f8fafc') ? t.cardBg : (t.cardColor || `rgb(${rCBgD},${gCBgD},${bCBgD})`),
    navBg:           (t as any).navBg !== undefined ? (t as any).navBg : base.navBg,
    flashcardBg1:    (t as any).flashcardBg1 || `rgb(${Math.round(r*0.12)},${Math.round(g*0.12)},${Math.round(b*0.12)})`,
    flashcardBg2:    (t as any).flashcardBg2 || `rgb(${Math.round(r*0.22)},${Math.round(g*0.22)},${Math.round(b*0.22)})`,
    chapterAccent:   (t as any).chapterAccent || accent,
    mcqTabActive:    (t as any).mcqTabActive  || accent,
    // Granular extras — accessible via (tierTheme as any).xxx
    navActive:       t.navActive    || accent,
    navBorderColor:  t.navBorder    || `rgba(${r},${g},${b},0.22)`,
    cardBorderColor: t.cardBorder   || `rgba(${r},${g},${b},0.28)`,
    textPrimary:     t.textColor    || accent,
    textSecondary:   t.textSecondary|| base.text,
    progressColor:   t.progressColor|| accent,
    accentGlowColor: t.accentGlow   || accent,
    appBgColor:      t.bgColor      || null,
  };
};

// Get the effective theme override color:
//   1. user.tempThemeColor (if not expired) — personal redeem code color
//   2. user.personalThemeColor — user's own chosen color (permanent)
//   2b. user.useDefaultTheme === true — user explicitly locked to default, skip all admin overrides
//   3. adminActiveTheme.color (if not expired) — admin temporary global theme
//   4. Tier-specific color from settings (ultraThemeColor / basicThemeColor / freeThemeColor)
//   5. settingsThemeColor — admin global color (applied to all tiers)
//   6. null — use default tierTheme
export const getEffectiveOverrideColor = (
  user: Pick<User, 'tempThemeColor' | 'tempThemeColorExpiry' | 'isPremium' | 'subscriptionLevel' | 'subscriptionEndDate' | 'useDefaultTheme'> & { personalThemeColor?: string },
  settingsThemeColor?: string,
  tierSettings?: {
    ultraThemeColor?: string;
    basicThemeColor?: string;
    freeThemeColor?: string;
    adminActiveTheme?: { id: string; name: string; color: string; expiresAt?: string };
  } | null
): string | null => {
  // 1. Personal redeem theme (highest priority — from redeem code, expires)
  if (user.tempThemeColor && user.tempThemeColorExpiry) {
    if (new Date(user.tempThemeColorExpiry) > new Date()) {
      return user.tempThemeColor;
    }
  }
  // 2. User's own permanently chosen theme (from ThemeCustomizer)
  if (user.personalThemeColor) return user.personalThemeColor;
  // 2b. By default every user is shielded from admin overrides.
  //     Admin themes only reach a user when they have EXPLICITLY opted in (useDefaultTheme === false).
  if (user.useDefaultTheme !== false) return null;
  // 3. Admin temporary global theme (with expiry check)
  if (tierSettings?.adminActiveTheme?.color) {
    const theme = tierSettings.adminActiveTheme;
    if (!theme.expiresAt || new Date(theme.expiresAt) > new Date()) {
      return theme.color;
    }
  }
  // 4. Tier-specific permanent color
  if (tierSettings) {
    const tier = getUserTier(user);
    const tierColor =
      tier === 'ultra' ? tierSettings.ultraThemeColor :
      tier === 'basic' ? tierSettings.basicThemeColor :
      tierSettings.freeThemeColor;
    if (tierColor) return tierColor;
  }
  // 5. Global admin color
  if (settingsThemeColor) return settingsThemeColor;
  return null;
};
