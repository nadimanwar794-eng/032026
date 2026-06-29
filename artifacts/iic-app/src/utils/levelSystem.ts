export interface LevelInfo {
  level: number;
  minScore: number;
  label: string;
  emoji: string;
  color: string;
  gradient: string;
  glowColor: string;
  discount: number;
  animationIntensity: 0 | 1 | 2 | 3 | 4;
  nameColor?: string;
}

export const LEVEL_INFO: LevelInfo[] = [
  { level: 1,  minScore: 0,          label: 'Beginner',         emoji: '🌱', color: '#94a3b8', gradient: 'from-slate-400 to-slate-500',                  glowColor: 'rgba(148,163,184,0.35)', discount: 0,  animationIntensity: 0 },
  { level: 2,  minScore: 1000,       label: 'Learner',          emoji: '🌿', color: '#6ee7b7', gradient: 'from-emerald-300 to-teal-400',                 glowColor: 'rgba(110,231,183,0.35)', discount: 0,  animationIntensity: 0 },
  { level: 3,  minScore: 2500,       label: 'Active Learner',   emoji: '🔍', color: '#38bdf8', gradient: 'from-sky-400 to-cyan-500',                     glowColor: 'rgba(56,189,248,0.4)',   discount: 2,  animationIntensity: 1 },
  { level: 4,  minScore: 5000,       label: 'Consistent Learner', emoji: '✨', color: '#06b6d4', gradient: 'from-cyan-400 to-sky-500',                   glowColor: 'rgba(6,182,212,0.45)',   discount: 3,  animationIntensity: 1, nameColor: '#06b6d4' },
  { level: 5,  minScore: 10000,      label: 'Dedicated Student', emoji: '⚡', color: '#3b82f6', gradient: 'from-blue-400 to-indigo-500',                 glowColor: 'rgba(59,130,246,0.5)',   discount: 5,  animationIntensity: 2 },
  { level: 6,  minScore: 25000,      label: 'Rising Achiever',  emoji: '🔥', color: '#f97316', gradient: 'from-orange-400 to-red-500',                   glowColor: 'rgba(249,115,22,0.55)',  discount: 8,  animationIntensity: 2 },
  { level: 7,  minScore: 75000,      label: 'Expert Learner',   emoji: '💫', color: '#a855f7', gradient: 'from-violet-400 to-purple-600',                glowColor: 'rgba(168,85,247,0.6)',   discount: 10, animationIntensity: 2, nameColor: '#a855f7' },
  { level: 8,  minScore: 200000,     label: 'Master Learner',   emoji: '💎', color: '#f59e0b', gradient: 'from-amber-400 to-yellow-500',                 glowColor: 'rgba(245,158,11,0.65)',  discount: 13, animationIntensity: 3, nameColor: '#f59e0b' },
  { level: 9,  minScore: 500000,     label: 'Elite',            emoji: '🌟', color: '#eab308', gradient: 'from-yellow-400 to-amber-500',                 glowColor: 'rgba(234,179,8,0.75)',   discount: 17, animationIntensity: 3, nameColor: '#eab308' },
  { level: 10, minScore: 1000000,    label: 'Champion',         emoji: '👑', color: '#f59e0b', gradient: 'from-amber-400 to-orange-400',                 glowColor: 'rgba(245,158,11,0.8)',   discount: 20, animationIntensity: 3, nameColor: '#f59e0b' },
  { level: 11, minScore: 2500000,    label: 'Legend',           emoji: '🏆', color: '#10b981', gradient: 'from-emerald-400 via-cyan-400 to-violet-500',  glowColor: 'rgba(16,185,129,0.9)',   discount: 20, animationIntensity: 4, nameColor: '#10b981' },
  { level: 12, minScore: 5000000,    label: 'Mythic',           emoji: '🔮', color: '#8b5cf6', gradient: 'from-violet-400 via-purple-500 to-pink-500',   glowColor: 'rgba(139,92,246,0.9)',   discount: 22, animationIntensity: 4, nameColor: '#8b5cf6' },
  { level: 13, minScore: 10000000,   label: 'Supreme',          emoji: '⚜️', color: '#ec4899', gradient: 'from-pink-400 via-rose-500 to-red-500',        glowColor: 'rgba(236,72,153,0.9)',   discount: 25, animationIntensity: 4, nameColor: '#ec4899' },
  { level: 14, minScore: 25000000,   label: 'Eternal',          emoji: '🌠', color: '#f43f5e', gradient: 'from-rose-400 via-red-500 to-orange-500',      glowColor: 'rgba(244,63,94,0.95)',   discount: 28, animationIntensity: 4, nameColor: '#f43f5e' },
  { level: 15, minScore: 50000000,   label: 'Absolute Legend',  emoji: '💠', color: '#a5f3fc', gradient: 'from-white via-cyan-200 to-violet-400',         glowColor: 'rgba(165,243,252,0.95)', discount: 30, animationIntensity: 4, nameColor: '#7c3aed' },
];

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

export const DAILY_LIMIT_BONUS_MAX_PCT = 500;

/**
 * Returns the Daily Limit Bonus percentage (0–500) for a given level and
 * daily progress percentage (0–100). Applies only to L9+.
 * Scales linearly: each completed 10% of daily goal adds the level's bucket bonus.
 * L15 is capped at 500% (same as L14).
 */
export const getDailyLimitBonus = (level: number, dailyProgressPct: number): number => {
  if (level < 9 || dailyProgressPct <= 0) return 0;
  const effectiveLevel = Math.min(level, 15);
  const perBucket = _DAILY_LIMIT_BONUS_PER_BUCKET[effectiveLevel] ?? 0;
  const buckets = Math.min(10, Math.floor(dailyProgressPct / 10));
  return Math.min(DAILY_LIMIT_BONUS_MAX_PCT, buckets * perBucket);
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

// Special sentinel value meaning "unlimited" in the level table
export const UNLIMITED = 9999;

// ── Unified daily limits per level ───────────────────────────────────────────
// notes     = Chunk Notes Reading free sessions/day
// tts       = Audio/TTS free sessions/day
// concept   = Concept (DEEP_DIVE) tab free opens/day — Free=0, Basic/Ultra scaled with write
// retention = Retention (PREMIUM) tab free opens/day — Free=0 (N/A), Basic/Ultra scaled with write
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
// MCQ:       base Free=50, Basic=70, Ultra=100; +30 per level (all tiers)
// DL:        base Free=2,  Basic=5,  Ultra=10;  Free+2, Basic+3, Ultra+5 per level
// PDF:       Free: L1-L4=0 (blocked), L5=1, L6=2, L7=3, L8=4, L9=5, L10=6, L11=7, L12=8, L13=9, L14=10, L15=11
//            Basic L1=1; L1-L5: +1/level, L6-L8: +2/level, L9-L11: +3/level, L12-L15: +4/5/6/7
//            Ultra L1=3; L1-L5: +2/level, L6-L8: +3/level, L9-L11: +4/level, L12-L15: +5/6/7/8
// Video:     base Free=0,  Basic=2,  Ultra=5;   Free+1(from L2), Basic+2, Ultra+2 per level
// Notes:     base Free=10, Basic=10, Ultra=10;  Free+2, Basic+4, Ultra+6 per level; L9+ = UNLIMITED
// TTS:       Same as Notes
// Write:     base Free=0 (credit-only: 5 CR/view), Basic=5, Ultra=10; Basic+1, Ultra+1 per level from L4
// Concept:   base Free=5,  Basic=5,  Ultra=5;   Free+2, Basic+4, Ultra+6 per level (Free also open now)
// Retention: Same formula as Write (Free=0 N/A, Basic/Ultra scaled — Premium only)
// Flashcard: base Free=10, Basic=15, Ultra=20;  +10 per level (all tiers)
// bonusLoginCredits: 0,5,10,15,20,30,40,50,65,80,100

const _BONUS_LOGIN = [0, 5, 10, 15, 20, 30, 40, 50, 65, 80, 100, 120, 150, 185, 220];
const _CREDIT_WRITE_MAX = [100, 100, 100, 100, 100, 110, 120, 130, 140, 145, 150, 155, 160, 165, 170];

// MCQ increments per level: L1→L2=+10, L2→L3=+10... L5→L6=+20, L6→L7=+20, L7→L8=+20,
// L8→L9=+30, L9→L10=+30, L10→L11=+40, L11→L12=+40, L12→L13=+50, L13→L14=+60, L14→L15=+70
const _MCQ_INCR_CUMUL = [0, 10, 20, 30, 40, 60, 80, 100, 130, 160, 200, 240, 290, 350, 420];

// PDF daily limits — per level (0-indexed n = level-1):
// L1  L2  L3  L4  L5  L6  L7  L8  L9  L10 L11 L12 L13 L14 L15
const _PDF_FREE  = [0,  0,  0,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11];
const _PDF_BASIC = [1,  2,  3,  4,  5,  7,  9, 11, 14, 17, 20, 24, 29, 35, 42];
const _PDF_ULTRA = [3,  5,  7,  9, 11, 14, 17, 20, 24, 28, 32, 37, 43, 50, 58];

const buildTable = (): Record<number, LevelDailyLimits> => {
  const tbl: Record<number, LevelDailyLimits> = {};
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const n = i - 1; // 0-indexed increment
    const unlimitedNotes = i >= 9;
    const writeBasic = Math.max(5, 5 + Math.max(0, n - 3));
    const writeUltra = Math.max(10, 10 + Math.max(0, n - 3));
    tbl[i] = {
      mcq:       { free: 50 + _MCQ_INCR_CUMUL[n], basic: 70 + _MCQ_INCR_CUMUL[n], ultra: 100 + _MCQ_INCR_CUMUL[n] },
      dl:        { free: 2   + n * 2,  basic: 5   + n * 3,  ultra: 10  + n * 5  },
      pdf:       { free: _PDF_FREE[n], basic: _PDF_BASIC[n], ultra: _PDF_ULTRA[n] },
      video:     { free: Math.max(0, n), basic: 2 + n * 2, ultra: 5 + n * 2 },
      notes:     unlimitedNotes ? { free: UNLIMITED, basic: UNLIMITED, ultra: UNLIMITED } : { free: 10 + n * 2, basic: 10 + n * 4, ultra: 10 + n * 6 },
      tts:       unlimitedNotes ? { free: UNLIMITED, basic: UNLIMITED, ultra: UNLIMITED } : { free: 10 + n * 2, basic: 10 + n * 4, ultra: 10 + n * 6 },
      write:     { free: 0, basic: writeBasic, ultra: writeUltra },
      concept:   { free: 5 + n * 2, basic: 5 + n * 4, ultra: 5 + n * 6 },
      retention: { free: 0, basic: writeBasic, ultra: writeUltra },
      flashcard: { free: 10 + n * 10, basic: 15 + n * 10, ultra: 20 + n * 10 },
      creditWriteMax:    _CREDIT_WRITE_MAX[n],
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
  const ld = getLevelDailyLimitsWithOverride(level, settings);
  const tierKey: keyof LevelTierLimits = tier === 'FREE' ? 'free' : tier === 'BASIC' ? 'basic' : 'ultra';
  const levelValue = ld[feature][tierKey];

  // MCQ: admin's flat override (mcqLimitFree/Basic/Ultra) treated as L1 base → scale with level
  if (feature === 'mcq' && settings && !settings.levelLimitsOverride?.[String(level)]?.mcq) {
    const l1 = LEVEL_DAILY_LIMITS_TABLE[1].mcq[tierKey];
    const adminBase =
      tier === 'FREE'  ? (settings.mcqLimitFree  ?? 0) :
      tier === 'BASIC' ? (settings.mcqLimitBasic ?? 0) :
                         (settings.mcqLimitUltra ?? 0);
    if (adminBase > 0) {
      return adminBase + (levelValue - l1);
    }
  }
  return levelValue;
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
  const l1  = getLevelDailyLimits(1);
  return {
    mcqBonus:          cur.mcq.free   - l1.mcq.free,
    writeFreeBonus:    cur.write.basic - l1.write.basic,
    dlBonus:           cur.dl.free    - l1.dl.free,
    videoFreeBonus:    cur.video.basic - l1.video.basic,
    pdfFreeBonus:      cur.pdf.basic  - l1.pdf.basic,
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
  CREDIT_SPEND: 1,
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
// Base 300s (5 min) for all levels. Level 9+ gets +30s per level above 8.
// L1–L8: 300s  L9: 330s  L10: 360s  L11: 390s  L12: 420s  ...
export const getMaxReadingSeconds = (level: number): number => {
  const base = 300;
  if (level <= 8) return base;
  return base + (level - 8) * 30;
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
