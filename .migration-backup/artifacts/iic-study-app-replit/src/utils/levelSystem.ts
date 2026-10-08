export interface LevelInfo {
  level: number;
  minScore: number;
  label: string;
  emoji: string;
  color: string;
  gradient: string;
  glowColor: string;
  discount: number;
  coinReward: number; // Coins (credits) awarded upon reaching this level (Total ~1390 coins L2-L15)
  animationIntensity: 0 | 1 | 2 | 3 | 4;
  nameColor?: string;
}

export const LEVEL_INFO: LevelInfo[] = [
  { level: 1,  minScore: 0,          label: 'Beginner',         emoji: '🌱', color: '#94a3b8', gradient: 'from-slate-400 to-slate-500',                  glowColor: 'rgba(148,163,184,0.35)', discount: 0,  coinReward: 0,   animationIntensity: 0 },
  { level: 2,  minScore: 1000,       label: 'Learner',          emoji: '🌿', color: '#6ee7b7', gradient: 'from-emerald-300 to-teal-400',                 glowColor: 'rgba(110,231,183,0.35)', discount: 0,  coinReward: 20,  animationIntensity: 0 },
  { level: 3,  minScore: 2500,       label: 'Active Learner',   emoji: '🔍', color: '#38bdf8', gradient: 'from-sky-400 to-cyan-500',                     glowColor: 'rgba(56,189,248,0.4)',   discount: 2,  coinReward: 30,  animationIntensity: 1 },
  { level: 4,  minScore: 5000,       label: 'Consistent Learner', emoji: '✨', color: '#06b6d4', gradient: 'from-cyan-400 to-sky-500',                   glowColor: 'rgba(6,182,212,0.45)',   discount: 3,  coinReward: 40,  animationIntensity: 1, nameColor: '#06b6d4' },
  { level: 5,  minScore: 10000,      label: 'Dedicated Student', emoji: '⚡', color: '#3b82f6', gradient: 'from-blue-400 to-indigo-500',                 glowColor: 'rgba(59,130,246,0.5)',   discount: 5,  coinReward: 50,  animationIntensity: 2, nameColor: '#3b82f6' },
  { level: 6,  minScore: 25000,      label: 'Rising Achiever',  emoji: '🔥', color: '#f97316', gradient: 'from-orange-400 to-red-500',                   glowColor: 'rgba(249,115,22,0.55)',  discount: 8,  coinReward: 60,  animationIntensity: 2, nameColor: '#f97316' },
  { level: 7,  minScore: 75000,      label: 'Expert Learner',   emoji: '💫', color: '#a855f7', gradient: 'from-violet-400 to-purple-600',                glowColor: 'rgba(168,85,247,0.6)',   discount: 10, coinReward: 75,  animationIntensity: 2, nameColor: '#a855f7' },
  { level: 8,  minScore: 200000,     label: 'Master Learner',   emoji: '💎', color: '#f59e0b', gradient: 'from-amber-400 to-yellow-500',                 glowColor: 'rgba(245,158,11,0.65)',  discount: 13, coinReward: 90,  animationIntensity: 3, nameColor: '#f59e0b' },
  { level: 9,  minScore: 500000,     label: 'Elite',            emoji: '🌟', color: '#eab308', gradient: 'from-yellow-400 to-amber-500',                 glowColor: 'rgba(234,179,8,0.75)',   discount: 17, coinReward: 110, animationIntensity: 3, nameColor: '#eab308' },
  { level: 10, minScore: 1000000,    label: 'Champion',         emoji: '👑', color: '#f59e0b', gradient: 'from-amber-400 to-orange-400',                 glowColor: 'rgba(245,158,11,0.8)',   discount: 20, coinReward: 130, animationIntensity: 3, nameColor: '#f59e0b' },
  { level: 11, minScore: 2500000,    label: 'Legend',           emoji: '🏆', color: '#10b981', gradient: 'from-emerald-400 via-cyan-400 to-violet-500',  glowColor: 'rgba(16,185,129,0.9)',   discount: 20, coinReward: 150, animationIntensity: 4, nameColor: '#10b981' },
  { level: 12, minScore: 5000000,    label: 'Mythic',           emoji: '🔮', color: '#8b5cf6', gradient: 'from-violet-400 via-purple-500 to-pink-500',   glowColor: 'rgba(139,92,246,0.9)',   discount: 22, coinReward: 170, animationIntensity: 4, nameColor: '#8b5cf6' },
  { level: 13, minScore: 10000000,   label: 'Supreme',          emoji: '⚜️', color: '#ec4899', gradient: 'from-pink-400 via-rose-500 to-red-500',        glowColor: 'rgba(236,72,153,0.9)',   discount: 25, coinReward: 190, animationIntensity: 4, nameColor: '#ec4899' },
  { level: 14, minScore: 25000000,   label: 'Eternal',          emoji: '🌠', color: '#f43f5e', gradient: 'from-rose-400 via-red-500 to-orange-500',      glowColor: 'rgba(244,63,94,0.95)',   discount: 28, coinReward: 225, animationIntensity: 4, nameColor: '#f43f5e' },
  { level: 15, minScore: 50000000,   label: 'Absolute Legend',  emoji: '💠', color: '#a5f3fc', gradient: 'from-white via-cyan-200 to-violet-400',         glowColor: 'rgba(165,243,252,0.95)', discount: 30, coinReward: 250, animationIntensity: 4, nameColor: '#7c3aed' },
];

export const getLevelCoinReward = (level: number): number => {
  const item = LEVEL_INFO.find(l => l.level === level);
  return item?.coinReward || 0;
};

export const MAX_LEVEL = 15;
export const LEVEL_THRESHOLDS = LEVEL_INFO.map(l => l.minScore);

// ── Progress Bonus System ─────────────────────────────────────────────────────
// Unlocks at Level 4. Bonus % based on how much of the daily goal is complete.
// Level 8+ caps at the L8 table. Max bonus = 45%.
// Each row: [at 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%]
const _PROGRESS_BONUS_ROWS: Record<number, number[]> = {
  4: [ 1,  3,  5,  7,  9, 11, 13, 14, 15, 15],
  5: [ 2,  5,  8, 11, 14, 17, 19, 20, 21, 22],
  6: [ 3,  7, 11, 15, 19, 23, 26, 28, 29, 30],
  7: [ 4,  9, 14, 19, 24, 29, 33, 35, 37, 38],
  8: [ 5, 11, 17, 23, 29, 34, 39, 42, 44, 45],
};

export const PROGRESS_BONUS_MAX_PCT = 45;

/**
 * Returns the progress bonus percentage (0–45) for a given level and daily
 * progress percentage (0–100). Returns 0 for levels below 4.
 * L9–L15 still receive the L8 Progress Bonus (45% max) in addition to Daily Limit Bonus.
 */
export const getProgressBonus = (level: number, dailyProgressPct: number): number => {
  if (level < 4 || dailyProgressPct <= 0) return 0;
  const effectiveLevel = Math.min(level, 8); // L8+ uses L8 table (45% cap)
  const row = _PROGRESS_BONUS_ROWS[effectiveLevel];
  if (!row) return 0;
  const bucketIdx = Math.min(9, Math.floor(Math.max(0, dailyProgressPct - 1) / 10));
  return row[bucketIdx] ?? 0;
};

/**
 * Applies the progress bonus to a base score amount.
 * Returns the final score after adding the bonus.
 */
export const applyProgressBonus = (
  baseScore: number,
  level: number,
  dailyProgressPct: number,
): number => {
  const bonusPct = getProgressBonus(level, dailyProgressPct);
  if (bonusPct <= 0) return baseScore;
  return Math.round(baseScore * (1 + bonusPct / 100));
};

// ── Daily Limit Bonus System (L9–L15) ────────────────────────────────────────
// Unlocks at Level 9. Scales linearly with daily progress (per 10% bucket).
// L15 is capped at the same max as L14 (500%). Max cap = 500%.
// The bonus multiplies the effective daily score/limit cap for that session.
//
// Base bonus added per 10%-progress bucket:
//   L9 → 10% per bucket (max 100%)
//   L10 → 20%           (max 200%)
//   L11 → 25%           (max 250%)
//   L12 → 32%           (max 320%)
//   L13 → 40%           (max 400%)
//   L14 → 50%           (max 500%)
//   L15 → 50% (capped)  (max 500%)
const _DAILY_LIMIT_BONUS_PER_BUCKET: Record<number, number> = {
  9:  10,
  10: 20,
  11: 25,
  12: 32,
  13: 40,
  14: 50,
  15: 50, // same cap as L14
};

export const DAILY_LIMIT_BONUS_MAX_PCT = 0;

/**
 * Returns the Daily Limit Bonus percentage.
 * Permanently disabled (returns 0) per user mandate:
 * "multiplier level 14 se 15 tak jate jate 4x 5x ho jata hai uskiye permanent hatega ye"
 */
export const getDailyLimitBonus = (level: number, dailyProgressPct: number): number => {
  return 0;
};

/**
 * Applies the Daily Limit Bonus multiplier to a daily limit value.
 * e.g. if daily MCQ limit is 100 and bonus is 200%, returns 300.
 */
export const applyDailyLimitBonus = (
  baseLimit: number,
  level: number,
  dailyProgressPct: number,
): number => {
  if (baseLimit >= UNLIMITED) return UNLIMITED;
  const bonusPct = getDailyLimitBonus(level, dailyProgressPct);
  if (bonusPct <= 0) return baseLimit;
  return Math.round(baseLimit * (1 + bonusPct / 100));
};

// ── Per-tier limit structure ─────────────────────────────────────────────────
export interface LevelTierLimits {
  free: number;
  basic: number;
  ultra: number;
}

// Special sentinel value meaning "unlimited" in the level system
export const UNLIMITED = 9999;

// ── Unified daily limits per level ───────────────────────────────────────────
// Level system no longer caps or restricts daily limits. All limits are UNLIMITED.
export interface LevelDailyLimits {
  mcq:               LevelTierLimits;
  dl:                LevelTierLimits;
  pdf:               LevelTierLimits;
  video:             LevelTierLimits;
  notes:             LevelTierLimits;
  tts:               LevelTierLimits;
  write:             LevelTierLimits;
  concept:           LevelTierLimits;
  retention:         LevelTierLimits;
  flashcard:         LevelTierLimits;
  creditWriteMax:    number;
  bonusLoginCredits: number;
}

// ── Helper to build one level row ────────────────────────────────────────────
// All features are set to UNLIMITED (Level system limits removed as requested)
const _BONUS_LOGIN = [0, 5, 10, 15, 20, 30, 40, 50, 65, 80, 100, 120, 150, 185, 220];
const _CREDIT_WRITE_MAX = [100, 100, 100, 100, 100, 110, 120, 130, 140, 145, 150, 155, 160, 165, 170];

const _UNLIMITED_TIER: LevelTierLimits = { free: UNLIMITED, basic: UNLIMITED, ultra: UNLIMITED };

// ── Star lock: Free users cannot bookmark at L1–L4; unlocks at L5 ────────────
/** Returns true when a Free-tier user at this level has the star/bookmark feature locked. */
export const isFreeStarLocked = (level: number): boolean => false;

const buildTable = (): Record<number, LevelDailyLimits> => {
  const tbl: Record<number, LevelDailyLimits> = {};
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const n = i - 1; // 0-indexed
    tbl[i] = {
      mcq:       { free: 300, basic: 1500, ultra: 3000 },
      dl:        { ..._UNLIMITED_TIER },
      pdf:       { ..._UNLIMITED_TIER },
      video:     { ..._UNLIMITED_TIER },
      notes:     { ..._UNLIMITED_TIER },
      tts:       { ..._UNLIMITED_TIER },
      write:     { ..._UNLIMITED_TIER },
      concept:   { ..._UNLIMITED_TIER },
      retention: { ..._UNLIMITED_TIER },
      flashcard: { ..._UNLIMITED_TIER },
      creditWriteMax:    UNLIMITED,
      bonusLoginCredits: _BONUS_LOGIN[n],
    };
  }
  return tbl;
};

export const LEVEL_DAILY_LIMITS_TABLE = buildTable();

// ── Get base limits (without admin override) ─────────────────────────────────
export const getLevelDailyLimits = (level: number): LevelDailyLimits => {
  const lvl = Math.min(MAX_LEVEL, Math.max(1, level));
  return LEVEL_DAILY_LIMITS_TABLE[lvl] ?? LEVEL_DAILY_LIMITS_TABLE[1];
};

// ── Get limits with optional admin override ───────────────────────────────────
// Admin can override per-level per-tier limits via settings.levelLimitsOverride
export const getLevelDailyLimitsWithOverride = (
  level: number,
  settings?: { levelLimitsOverride?: Record<string, Partial<LevelDailyLimitsOverride>> } | null
): LevelDailyLimits => {
  const base = getLevelDailyLimits(level);
  if (!settings?.levelLimitsOverride) return base;
  const ov = settings.levelLimitsOverride[String(level)];
  if (!ov) return base;

  const mergeTier = (b: LevelTierLimits, o?: Partial<LevelTierLimits>): LevelTierLimits =>
    o ? { free: o.free ?? b.free, basic: o.basic ?? b.basic, ultra: o.ultra ?? b.ultra } : b;

  return {
    mcq:               mergeTier(base.mcq,       ov.mcq),
    dl:                mergeTier(base.dl,         ov.dl),
    pdf:               mergeTier(base.pdf,        ov.pdf),
    video:             mergeTier(base.video,      ov.video),
    notes:             mergeTier(base.notes,      ov.notes),
    tts:               mergeTier(base.tts,        ov.tts),
    write:             mergeTier(base.write,      ov.write),
    concept:           mergeTier(base.concept,    ov.concept),
    retention:         mergeTier(base.retention,  ov.retention),
    flashcard:         mergeTier(base.flashcard,  ov.flashcard),
    creditWriteMax:    ov.creditWriteMax    ?? base.creditWriteMax,
    bonusLoginCredits: ov.bonusLoginCredits ?? base.bonusLoginCredits,
  };
};

// Type for admin override (all optional)
export interface LevelDailyLimitsOverride {
  mcq?:               Partial<LevelTierLimits>;
  dl?:                Partial<LevelTierLimits>;
  pdf?:               Partial<LevelTierLimits>;
  video?:             Partial<LevelTierLimits>;
  notes?:             Partial<LevelTierLimits>;
  tts?:               Partial<LevelTierLimits>;
  write?:             Partial<LevelTierLimits>;
  concept?:           Partial<LevelTierLimits>;
  retention?:         Partial<LevelTierLimits>;
  flashcard?:         Partial<LevelTierLimits>;
  creditWriteMax?:    number;
  bonusLoginCredits?: number;
}

// ── Unified effective daily limit getter ─────────────────────────────────────
export type DailyLimitFeature = 'mcq' | 'video' | 'pdf' | 'dl' | 'write' | 'notes' | 'tts' | 'concept' | 'retention' | 'flashcard';

export const getEffectiveDailyLimit = (
  feature: DailyLimitFeature,
  level: number,
  tier: 'FREE' | 'BASIC' | 'ULTRA',
  settings?: { mcqLimitFree?: number; mcqLimitBasic?: number; mcqLimitUltra?: number; levelLimitsOverride?: Record<string, Partial<LevelDailyLimitsOverride>> } | null
): number => {
  if (feature === 'mcq') {
    if (tier === 'ULTRA') return settings?.mcqLimitUltra ?? 3000;
    if (tier === 'BASIC') return settings?.mcqLimitBasic ?? 1500;
    return settings?.mcqLimitFree ?? 300;
  }
  return UNLIMITED;
};

// ── Backward-compat: LevelLimitBonus (derived from new table) ────────────────
export interface LevelLimitBonus {
  mcqBonus:          number;
  writeFreeBonus:    number;
  dlBonus:           number;
  videoFreeBonus:    number;
  pdfFreeBonus:      number;
  creditWriteMax:    number;
  bonusLoginCredits: number;
}

export const getLevelLimitBonus = (level: number): LevelLimitBonus => {
  const cur = getLevelDailyLimits(level);
  return {
    mcqBonus:          0,
    writeFreeBonus:    0,
    dlBonus:           0,
    videoFreeBonus:    0,
    pdfFreeBonus:      0,
    creditWriteMax:    cur.creditWriteMax,
    bonusLoginCredits: cur.bonusLoginCredits,
  };
};

export const getLevelInfo = (
  score: number,
  settings?: { levelScoreOverride?: Record<string, number> } | null
): LevelInfo => {
  let info = LEVEL_INFO[0];
  const overrides = settings?.levelScoreOverride;
  for (const l of LEVEL_INFO) {
    const threshold = overrides?.[String(l.level)] ?? l.minScore;
    if (score >= threshold) info = { ...l, minScore: threshold };
    else break;
  }
  return info;
};

export const getLevelFromScore = (score: number, settings?: { levelScoreOverride?: Record<string, number> } | null): number => getLevelInfo(score, settings).level;
export const getScoreDiscountFromScore = (score: number, settings?: { levelScoreOverride?: Record<string, number> } | null): number => getLevelInfo(score, settings).discount;

export const getScoreForLevel = (level: number): number => {
  const idx = Math.max(0, Math.min(level - 1, MAX_LEVEL - 1));
  return LEVEL_INFO[idx].minScore;
};

export const getScoreAfterLevelDrop = (score: number): number => {
  const currentLevel = getLevelFromScore(score);
  if (currentLevel <= 1) return 0;
  return getScoreForLevel(currentLevel - 1);
};

export const getNextLevelInfo = (score: number): LevelInfo | null => {
  const current = getLevelInfo(score);
  if (current.level >= MAX_LEVEL) return null;
  return LEVEL_INFO[current.level] ?? null;
};

export const getLevelProgress = (score: number): number => {
  const current = getLevelInfo(score);
  const next = getNextLevelInfo(score);
  if (!next) return 100;
  const range = next.minScore - current.minScore;
  const gained = score - current.minScore;
  return Math.min(100, Math.round((gained / range) * 100));
};

export const ACTIVITY_SCORES = {
  VIDEO: 4,
  PDF: 3,
  MCQ_PER_ANSWER: 2,
  AUDIO: 2,
  NOTES_READ: 2,
  TTS: 3,
  DAILY_LOGIN: 10,
  REDEEM_CODE: 5,
  GIFT_CLAIM: 5,
  CREDIT_SPEND: 0.5,
  SUBSCRIPTION_ANY: 100,
};

export const SUBSCRIPTION_BONUS: Record<string, { score: number; bonusCredits: number }> = {
  'WEEKLY_BASIC':    { score: 100, bonusCredits: 30 },
  'WEEKLY_ULTRA':    { score: 100, bonusCredits: 50 },
  'MONTHLY_BASIC':   { score: 100, bonusCredits: 150 },
  'MONTHLY_ULTRA':   { score: 100, bonusCredits: 250 },
  '3_MONTHLY_BASIC': { score: 100, bonusCredits: 500 },
  '3_MONTHLY_ULTRA': { score: 100, bonusCredits: 800 },
  'YEARLY_BASIC':    { score: 100, bonusCredits: 2100 },
  'YEARLY_ULTRA':    { score: 100, bonusCredits: 3500 },
  'LIFETIME_BASIC':  { score: 100, bonusCredits: 0 },
  'LIFETIME_ULTRA':  { score: 100, bonusCredits: 0 },
};

// Returns max reading/watching seconds for time-based scoring (Notes, PDF, Video, Audio)
// Base 600s (10 min) for all levels. Level 9+ gets +60s (1 min) per level above 8.
// L1–L8: 600s (10m)  L9: 660s (11m)  L10: 720s (12m)  L11: 780s (13m)  L12: 840s (14m) ...
export const getMaxReadingSeconds = (level: number): number => {
  const base = 600;
  if (level <= 8) return base;
  return base + (level - 8) * 60;
};

export const getLevelTopBarEffects = (lvl: LevelInfo): Array<{id:string;enabled:boolean;color:string;speed?:number;opacity?:number}> => {
  const c = lvl.color;
  const g = lvl.glowColor;
  switch (lvl.animationIntensity) {
    case 0: return [];
    case 1:
      return [{ id: 'shimmer-forward', enabled: true, color: c, speed: 3, opacity: 0.3 }];
    case 2:
      return [
        { id: 'shimmer-forward', enabled: true, color: c, speed: 2, opacity: 0.5 },
        { id: 'glow-bottom',     enabled: true, color: g, speed: 1.5, opacity: 0.6 },
      ];
    case 3:
      return [
        { id: 'shimmer-forward', enabled: true, color: c, speed: 1.5 },
        { id: 'shimmer-reverse', enabled: true, color: c, speed: 2 },
        { id: 'glow-both',       enabled: true, color: g, speed: 1 },
        { id: 'sparkle-top',     enabled: true, color: c, speed: 1 },
      ];
    case 4:
      return [
        { id: 'shimmer-forward', enabled: true, color: c, speed: 1 },
        { id: 'shimmer-reverse', enabled: true, color: c, speed: 1.2 },
        { id: 'glow-both',       enabled: true, color: g, speed: 0.8 },
        { id: 'sparkle-full',    enabled: true, color: c, speed: 0.8 },
        { id: 'sparkle-top',     enabled: true, color: '#fbbf24', speed: 1.2 },
      ];
    default: return [];
  }
};

// ── Multi-Tier Sub-System (Roman I-V, Greek Alpha/Beta/Gamma, Metal Leagues) ────
export type RomanSubStep = 'I' | 'II' | 'III' | 'IV' | 'V';
export type GreekTier = 'Alpha' | 'Beta' | 'Gamma';
export type MetalLeague = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export const ROMAN_STEPS: RomanSubStep[] = ['I', 'II', 'III', 'IV', 'V'];

export interface LevelSubTier {
  level: number;
  stageType: 'BASE' | 'GREEK' | 'METAL';
  roman: RomanSubStep;
  romanIndex: number;
  greek?: GreekTier;
  greekSymbol?: string;
  metal?: MetalLeague;
  metalEmoji?: string;
  badgeText: string;
  shortBadgeText: string;
  fullTitle: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  stepProgressPct: number;
  nextStepTitle: string;
}

export const METAL_LEAGUES: Array<{
  name: MetalLeague;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}> = [
  { name: 'Bronze',   emoji: '🥉', color: '#f59e0b', bgColor: 'rgba(180, 83, 9, 0.25)',   borderColor: 'rgba(245, 158, 11, 0.45)', glowColor: 'rgba(245, 158, 11, 0.6)' },
  { name: 'Silver',   emoji: '🥈', color: '#e2e8f0', bgColor: 'rgba(148, 163, 184, 0.25)', borderColor: 'rgba(203, 213, 225, 0.45)', glowColor: 'rgba(226, 232, 240, 0.6)' },
  { name: 'Gold',     emoji: '🥇', color: '#fbbf24', bgColor: 'rgba(217, 119, 6, 0.25)',   borderColor: 'rgba(251, 191, 36, 0.5)',  glowColor: 'rgba(251, 191, 36, 0.7)' },
  { name: 'Platinum', emoji: '💠', color: '#38bdf8', bgColor: 'rgba(14, 165, 233, 0.25)',  borderColor: 'rgba(56, 189, 248, 0.5)',  glowColor: 'rgba(56, 189, 248, 0.7)' },
  { name: 'Diamond',  emoji: '💎', color: '#c084fc', bgColor: 'rgba(168, 85, 247, 0.25)',  borderColor: 'rgba(192, 132, 252, 0.5)', glowColor: 'rgba(192, 132, 252, 0.8)' },
];

/**
 * Computes exact Sub-Tier (Roman I-V, Greek Alpha/Beta/Gamma, Metal League)
 * based on level (1-15) and progress within level (0-100%).
 */
export const getLevelSubTier = (level: number, progressPct: number): LevelSubTier => {
  const lvl = Math.min(MAX_LEVEL, Math.max(1, level));
  const safeProgress = Math.min(100, Math.max(0, progressPct));

  // ── Range 1: Level 1 se 5 (Foundational Ranks: Roman I se V) ──
  if (lvl <= 5) {
    const romanIndex = Math.min(4, Math.floor(safeProgress / 20));
    const roman = ROMAN_STEPS[romanIndex];
    const stepProgress = Math.min(100, Math.round(((safeProgress % 20) / 20) * 100));
    const nextRoman = romanIndex < 4 ? ROMAN_STEPS[romanIndex + 1] : null;
    const nextTitle = nextRoman ? `Rank ${nextRoman}` : `Level ${lvl + 1} · Rank I`;
    const lvlInfo = LEVEL_INFO[lvl - 1];

    return {
      level: lvl,
      stageType: 'BASE',
      roman,
      romanIndex,
      badgeText: `Rank ${roman}`,
      shortBadgeText: roman,
      fullTitle: `Level ${lvl} · Rank ${roman}`,
      color: lvlInfo.color,
      bgColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: `${lvlInfo.color}60`,
      glowColor: lvlInfo.glowColor,
      stepProgressPct: safeProgress >= 100 ? 100 : stepProgress,
      nextStepTitle: nextTitle,
    };
  }

  // ── Range 2: Level 6 se 10 (Greek Divisions: Alpha 25%, Beta 35%, Gamma 40%) ──
  if (lvl <= 10) {
    let greek: GreekTier = 'Alpha';
    let greekSymbol = 'α';
    let greekProgressPct = 0;
    let greekColor = '#38bdf8';
    let greekBg = 'rgba(56, 189, 248, 0.18)';
    let greekBorder = 'rgba(56, 189, 248, 0.45)';
    let greekGlow = 'rgba(56, 189, 248, 0.65)';
    let nextGreek: GreekTier | null = 'Beta';

    if (safeProgress < 25) {
      greek = 'Alpha';
      greekSymbol = 'α';
      greekProgressPct = (safeProgress / 25) * 100;
      greekColor = '#38bdf8';
      greekBg = 'rgba(56, 189, 248, 0.18)';
      greekBorder = 'rgba(56, 189, 248, 0.45)';
      greekGlow = 'rgba(56, 189, 248, 0.65)';
      nextGreek = 'Beta';
    } else if (safeProgress < 60) {
      greek = 'Beta';
      greekSymbol = 'β';
      greekProgressPct = ((safeProgress - 25) / 35) * 100;
      greekColor = '#a855f7';
      greekBg = 'rgba(168, 85, 247, 0.18)';
      greekBorder = 'rgba(168, 85, 247, 0.45)';
      greekGlow = 'rgba(168, 85, 247, 0.65)';
      nextGreek = 'Gamma';
    } else {
      greek = 'Gamma';
      greekSymbol = 'γ';
      greekProgressPct = ((safeProgress - 60) / 40) * 100;
      greekColor = '#f59e0b';
      greekBg = 'rgba(245, 158, 11, 0.18)';
      greekBorder = 'rgba(245, 158, 11, 0.45)';
      greekGlow = 'rgba(245, 158, 11, 0.7)';
      nextGreek = null;
    }

    const romanIndex = Math.min(4, Math.floor(greekProgressPct / 20));
    const roman = ROMAN_STEPS[romanIndex];
    const stepProgress = Math.min(100, Math.round(((greekProgressPct % 20) / 20) * 100));

    let nextTitle = '';
    if (romanIndex < 4) {
      nextTitle = `${greek} ${ROMAN_STEPS[romanIndex + 1]}`;
    } else if (nextGreek) {
      nextTitle = `${nextGreek} I`;
    } else {
      nextTitle = `Level ${lvl + 1} · Alpha I`;
    }

    return {
      level: lvl,
      stageType: 'GREEK',
      roman,
      romanIndex,
      greek,
      greekSymbol,
      badgeText: `${greek} ${roman}`,
      shortBadgeText: `${greekSymbol}-${roman}`,
      fullTitle: `Level ${lvl} · ${greek} ${roman}`,
      color: greekColor,
      bgColor: greekBg,
      borderColor: greekBorder,
      glowColor: greekGlow,
      stepProgressPct: safeProgress >= 100 ? 100 : stepProgress,
      nextStepTitle: nextTitle,
    };
  }

  // ── Range 3: Level 11 se 15 (Metal Leagues: Bronze, Silver, Gold, Platinum, Diamond) ──
  // 5 Metals across 0–100% (each 20%). Inside each metal: Alpha (25%), Beta (35%), Gamma (40%) with Roman I–V
  const metalIndex = Math.min(4, Math.floor(safeProgress / 20));
  const metalObj = METAL_LEAGUES[metalIndex];
  const metalProgress = Math.min(100, Math.max(0, ((safeProgress - metalIndex * 20) / 20) * 100));

  let greek: GreekTier = 'Alpha';
  let greekSymbol = 'α';
  let greekProgressPct = 0;
  let nextGreek: GreekTier | null = 'Beta';

  if (metalProgress < 25) {
    greek = 'Alpha';
    greekSymbol = 'α';
    greekProgressPct = (metalProgress / 25) * 100;
    nextGreek = 'Beta';
  } else if (metalProgress < 60) {
    greek = 'Beta';
    greekSymbol = 'β';
    greekProgressPct = ((metalProgress - 25) / 35) * 100;
    nextGreek = 'Gamma';
  } else {
    greek = 'Gamma';
    greekSymbol = 'γ';
    greekProgressPct = ((metalProgress - 60) / 40) * 100;
    nextGreek = null;
  }

  const romanIndex = Math.min(4, Math.floor(greekProgressPct / 20));
  const roman = ROMAN_STEPS[romanIndex];
  const stepProgress = Math.min(100, Math.round(((greekProgressPct % 20) / 20) * 100));

  let nextTitle = '';
  if (romanIndex < 4) {
    nextTitle = `${metalObj.name} ${greek} ${ROMAN_STEPS[romanIndex + 1]}`;
  } else if (nextGreek) {
    nextTitle = `${metalObj.name} ${nextGreek} I`;
  } else if (metalIndex < 4) {
    nextTitle = `${METAL_LEAGUES[metalIndex + 1].name} Alpha I`;
  } else if (lvl < MAX_LEVEL) {
    nextTitle = `Level ${lvl + 1} · Bronze Alpha I`;
  } else {
    nextTitle = 'Max Tier Champion 👑';
  }

  return {
    level: lvl,
    stageType: 'METAL',
    roman,
    romanIndex,
    greek,
    greekSymbol,
    metal: metalObj.name,
    metalEmoji: metalObj.emoji,
    badgeText: `${metalObj.emoji} ${metalObj.name} ${greekSymbol}-${roman}`,
    shortBadgeText: `${metalObj.emoji} ${greekSymbol}-${roman}`,
    fullTitle: `Level ${lvl} · ${metalObj.name} ${greek} ${roman}`,
    color: metalObj.color,
    bgColor: metalObj.bgColor,
    borderColor: metalObj.borderColor,
    glowColor: metalObj.glowColor,
    stepProgressPct: safeProgress >= 100 ? 100 : stepProgress,
    nextStepTitle: nextTitle,
  };
};

/**
 * Returns LevelSubTier directly given a user's total score.
 */
export const getSubTierInfoFromScore = (
  score: number,
  settings?: { levelScoreOverride?: Record<string, number> } | null
): LevelSubTier => {
  const lvlInfo = getLevelInfo(score, settings);
  const progressPct = getLevelProgress(score);
  return getLevelSubTier(lvlInfo.level, progressPct);
};

export const formatScoreNumber = (num: number): string => {
  if (num == null || isNaN(num)) return '0';
  return num.toLocaleString('en-IN');
};

export const formatScoreCompact = (num: number): string => {
  if (num >= 10000000) return `${(num / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(2).replace(/\.00$/, '')}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(num);
};

export interface SubTierBlock {
  id: string;
  title: string;
  short: string;
  roman: RomanSubStep;
  greek?: GreekTier;
  greekSymbol?: string;
  metal?: MetalLeague;
  metalEmoji?: string;
  minPct: number;
  maxPct: number;
  minScore: number;
  maxScore: number;
  color: string;
  coinReward?: number;
  diamondReward?: number;
  isSpecialPinnacle?: boolean;
}

/**
 * Returns all sub-tier blocks that constitute a given level with exact required XP scores.
 * Used to render visual progression trees and exact score calculations in Level Roadmaps.
 */
export const getAllSubTiersForLevel = (level: number): SubTierBlock[] => {
  const lvl = Math.min(MAX_LEVEL, Math.max(1, level));
  const currentLvlInfo = LEVEL_INFO.find(l => l.level === lvl) || LEVEL_INFO[0];
  const nextLvlInfo = LEVEL_INFO.find(l => l.level === lvl + 1);
  const startScore = currentLvlInfo.minScore;
  const range = nextLvlInfo ? (nextLvlInfo.minScore - startScore) : 25000000;

  if (lvl <= 5) {
    return ROMAN_STEPS.map((r, i) => {
      const minPct = i * 20;
      const maxPct = (i + 1) * 20;
      const minScore = Math.round(startScore + (range * minPct) / 100);
      const maxScore = Math.round(startScore + (range * maxPct) / 100);
      return {
        id: `base-${r}`,
        title: `Rank ${r}`,
        short: r,
        roman: r,
        minPct,
        maxPct,
        minScore,
        maxScore,
        color: LEVEL_INFO[lvl - 1].color,
      };
    });
  }

  if (lvl <= 10) {
    const greekDefs: Array<{ greek: GreekTier; symbol: string; min: number; max: number; color: string }> = [
      { greek: 'Alpha', symbol: 'α', min: 0,  max: 25,  color: '#38bdf8' },
      { greek: 'Beta',  symbol: 'β', min: 25, max: 60,  color: '#a855f7' },
      { greek: 'Gamma', symbol: 'γ', min: 60, max: 100, color: '#f59e0b' },
    ];

    const list: SubTierBlock[] = [];
    greekDefs.forEach(g => {
      const span = g.max - g.min;
      ROMAN_STEPS.forEach((r, ri) => {
        const stepMin = g.min + (span * (ri * 20)) / 100;
        const stepMax = g.min + (span * ((ri + 1) * 20)) / 100;
        const minScore = Math.round(startScore + (range * stepMin) / 100);
        const maxScore = Math.round(startScore + (range * stepMax) / 100);
        list.push({
          id: `${g.greek}-${r}`,
          title: `${g.greek} ${r}`,
          short: `${g.symbol}-${r}`,
          roman: r,
          greek: g.greek,
          greekSymbol: g.symbol,
          minPct: Number(stepMin.toFixed(2)),
          maxPct: Number(stepMax.toFixed(2)),
          minScore,
          maxScore,
          color: g.color,
        });
      });
    });
    return list;
  }

  // Level 11 se 15
  const list: SubTierBlock[] = [];
  METAL_LEAGUES.forEach((m, mi) => {
    const metalMin = mi * 20;
    const metalSpan = 20;
    const greekDefs: Array<{ greek: GreekTier; symbol: string; minRatio: number; maxRatio: number }> = [
      { greek: 'Alpha', symbol: 'α', minRatio: 0,   maxRatio: 0.25 },
      { greek: 'Beta',  symbol: 'β', minRatio: 0.25, maxRatio: 0.60 },
      { greek: 'Gamma', symbol: 'γ', minRatio: 0.60, maxRatio: 1.00 },
    ];

    greekDefs.forEach(g => {
      const gSpan = g.maxRatio - g.minRatio;
      ROMAN_STEPS.forEach((r, ri) => {
        const stepMinRatio = g.minRatio + (gSpan * (ri * 20)) / 100;
        const stepMaxRatio = g.minRatio + (gSpan * ((ri + 1) * 20)) / 100;
        const stepMin = metalMin + metalSpan * stepMinRatio;
        const stepMax = metalMin + metalSpan * stepMaxRatio;
        const minScore = Math.round(startScore + (range * stepMin) / 100);
        const maxScore = Math.round(startScore + (range * stepMax) / 100);
        const isPinnacle = lvl === 15 && m.name === 'Diamond' && g.greek === 'Gamma' && r === 'V';
        list.push({
          id: `${m.name}-${g.greek}-${r}`,
          title: isPinnacle ? `👑 ${m.emoji} ${m.name} ${g.greek} ${r} (ABSOLUTE LEGEND)` : `${m.emoji} ${m.name} ${g.greek} ${r}`,
          short: `${m.emoji} ${g.symbol}-${r}`,
          roman: r,
          greek: g.greek,
          greekSymbol: g.symbol,
          metal: m.name,
          metalEmoji: m.emoji,
          minPct: Number(stepMin.toFixed(2)),
          maxPct: Number(stepMax.toFixed(2)),
          minScore,
          maxScore,
          color: isPinnacle ? '#c084fc' : m.color,
          coinReward: isPinnacle ? LEVEL_15_DIAMOND_GAMMA_V_COINS : SUB_TIER_COIN_REWARD,
          diamondReward: isPinnacle ? LEVEL_15_DIAMOND_GAMMA_V_DIAMONDS : 0,
          isSpecialPinnacle: isPinnacle,
        });
      });
    });
  });
  return list;
};

/** Reward in coins (credits) awarded every time a student unlocks or advances to a standard sub-tier / rank */
export const SUB_TIER_COIN_REWARD = 50;

/** Grand Pinnacle Rewards specifically for LEVEL 15 (ABSOLUTE LEGEND) Diamond Gamma V */
export const LEVEL_15_DIAMOND_GAMMA_V_COINS = 1000;
export const LEVEL_15_DIAMOND_GAMMA_V_DIAMONDS = 100;

/** Check if score qualifies for Level 15 Diamond Gamma V (Absolute Legend highest tier) */
export const isLevel15DiamondGammaV = (
  score: number,
  settings?: { levelScoreOverride?: Record<string, number> } | null
): boolean => {
  const lvlInfo = getLevelInfo(score, settings);
  if (lvlInfo.level < 15) return false;
  const progressPct = getLevelProgress(score);
  const subTier = getLevelSubTier(15, progressPct);
  return subTier.metal === 'Diamond' && subTier.greek === 'Gamma' && subTier.roman === 'V';
};

/**
 * Returns all unlocked sub-tier IDs earned for a given total score.
 * Initial state (Level 1, Rank I at 0 XP) is excluded from earned rewards so the first 50-coin reward is earned upon reaching Rank II (20% progress = 200 XP).
 */
export const getUnlockedSubTierKeys = (
  score: number,
  settings?: { levelScoreOverride?: Record<string, number> } | null
): string[] => {
  const currentLvlInfo = getLevelInfo(score, settings);
  const currentProgress = getLevelProgress(score);

  const unlocked: string[] = [];

  // Completed levels prior to current level: all sub-tiers unlocked
  for (let l = 1; l < currentLvlInfo.level; l++) {
    const list = getAllSubTiersForLevel(l);
    list.forEach(item => {
      const key = `L${l}_${item.id}`;
      if (key !== 'L1_base-I') {
        unlocked.push(key);
      }
    });
  }

  // Current level sub-tiers up to current progress
  const currentList = getAllSubTiersForLevel(currentLvlInfo.level);
  currentList.forEach(item => {
    if (currentProgress >= item.minPct) {
      const key = `L${currentLvlInfo.level}_${item.id}`;
      if (key !== 'L1_base-I') {
        unlocked.push(key);
      }
    }
  });

  return unlocked;
};

/**
 * Calculates unclaimed sub-tier rewards for a given score and list of already claimed keys.
 * Level 15 Diamond Gamma V uniquely awards 100 Diamonds + 1,000 Coins!
 */
export const getSubTierRewardSummary = (
  score: number,
  claimedKeys: string[] = []
): {
  unlockedKeys: string[];
  unclaimedKeys: string[];
  unclaimedCoins: number;
  unclaimedDiamonds: number;
  hasPinnacleReward: boolean;
} => {
  const unlockedKeys = getUnlockedSubTierKeys(score);
  const claimedSet = new Set(claimedKeys);
  const unclaimedKeys = unlockedKeys.filter(k => !claimedSet.has(k));

  let unclaimedCoins = 0;
  let unclaimedDiamonds = 0;
  let hasPinnacleReward = false;

  unclaimedKeys.forEach(k => {
    if (k === 'L15_Diamond-Gamma-V') {
      unclaimedCoins += LEVEL_15_DIAMOND_GAMMA_V_COINS; // 1,000 Coins
      unclaimedDiamonds += LEVEL_15_DIAMOND_GAMMA_V_DIAMONDS; // 100 Diamonds
      hasPinnacleReward = true;
    } else {
      unclaimedCoins += SUB_TIER_COIN_REWARD; // 50 Coins
    }
  });

  return {
    unlockedKeys,
    unclaimedKeys,
    unclaimedCoins,
    unclaimedDiamonds,
    hasPinnacleReward,
  };
};

/**
 * Quick search / lookup for a specific sub-rank:
 * e.g. level: 11, metal: 'Silver', greek: 'Beta', roman: 'III'
 */
export const findSubTierByCriteria = (
  level: number,
  criteria: {
    metal?: string;
    greek?: string;
    roman?: string;
  }
): SubTierBlock | undefined => {
  const list = getAllSubTiersForLevel(level);
  return list.find(item => {
    if (criteria.metal && item.metal && item.metal.toLowerCase() !== criteria.metal.toLowerCase()) return false;
    if (criteria.greek && item.greek && item.greek.toLowerCase() !== criteria.greek.toLowerCase()) return false;
    if (criteria.roman && item.roman !== criteria.roman) return false;
    return true;
  });
};

export interface GlobalSubTierRow extends SubTierBlock {
  globalIndex: number; // 1 to 475
  level: number;
  levelLabel: string;
  levelEmoji: string;
  levelColor: string;
}

let _cachedGlobalSubTiers: GlobalSubTierRow[] | null = null;

export const getAllGlobalSubTiers = (): GlobalSubTierRow[] => {
  if (_cachedGlobalSubTiers) return _cachedGlobalSubTiers;
  const all: GlobalSubTierRow[] = [];
  let idx = 1;
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const lvlInfo = LEVEL_INFO.find(item => item.level === l) || LEVEL_INFO[0];
    const blocks = getAllSubTiersForLevel(l);
    blocks.forEach(b => {
      all.push({
        ...b,
        globalIndex: idx++,
        level: l,
        levelLabel: lvlInfo.label,
        levelEmoji: lvlInfo.emoji,
        levelColor: lvlInfo.color,
      });
    });
  }
  _cachedGlobalSubTiers = all;
  return all;
};



