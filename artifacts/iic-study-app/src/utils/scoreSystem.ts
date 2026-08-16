/**
 * Score System — daily limits, subscription multipliers, activity milestones
 * Daily score limit: 5000 pts (Free) / 7000 pts (Basic) / 10000 pts (Ultra)
 * Milestones: 20%=5, 40%=10, 60%=15, 80%=20, 100%=25 base pts
 * Multipliers: Free=1x, Basic=1.2x (+20%), Ultra=1.5x (+50%)
 */

export const DAILY_SCORE_LIMIT = 5000;

/** Fixed daily score limits by tier (Free=5000, Basic=7000, Ultra=10000) */
const DAILY_TIER_LIMITS: Record<string, number> = {
  FREE:  5000,
  BASIC: 7000,
  ULTRA: 10000,
};

/** Dynamic daily score limit based on subscription + optional temporary limit boost (from redeem code or event) */
export const getDailyScoreLimit = (
  subscriptionLevel?: string,
  isPremium?: boolean,
  scoreLimitBoostPercent?: number,
  scoreLimitBoostExpiry?: string,
): number => {
  const base = isPremium ? (DAILY_TIER_LIMITS[subscriptionLevel ?? 'FREE'] ?? 5000) : 5000;
  // Only apply boost if it hasn't expired
  const boostActive = scoreLimitBoostPercent && scoreLimitBoostPercent > 0
    && (!scoreLimitBoostExpiry || new Date(scoreLimitBoostExpiry).getTime() > Date.now());
  if (boostActive) {
    return Math.round(base * (1 + scoreLimitBoostPercent! / 100));
  }
  return base;
};

export const SCORE_MULTIPLIERS: Record<string, number> = {
  FREE:  1.0,
  BASIC: 1.2,
  ULTRA: 1.5,
};

export const PROGRESS_MILESTONES: { percent: number; score: number }[] = [
  { percent: 20,  score: 5  },
  { percent: 40,  score: 10 },
  { percent: 60,  score: 15 },
  { percent: 80,  score: 20 },
  { percent: 100, score: 25 },
];

/** Returns local-timezone date string YYYY-MM-DD (not UTC) — avoids midnight IST reset issues */
const getLocalDateStr = (offsetDays = 0): string => {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getTodayKey = (userId: string) => {
  return `nst_daily_score_${userId}_${getLocalDateStr()}`;
};

export const getDailyScoreEarned = (userId: string): number => {
  try { return Number(localStorage.getItem(getTodayKey(userId)) || '0'); } catch { return 0; }
};

export const getRemainingDailyScore = (
  userId: string,
  subscriptionLevel?: string,
  isPremium?: boolean,
  scoreLimitBoostPercent?: number,
  scoreLimitBoostExpiry?: string,
): number =>
  Math.max(0, getDailyScoreLimit(subscriptionLevel, isPremium, scoreLimitBoostPercent, scoreLimitBoostExpiry) - getDailyScoreEarned(userId));

/** Get active score boost % for a user (returns 0 if expired or not set) */
export const getActiveBoost = (user: { scoreBoostPercent?: number; scoreBoostExpiry?: string } | null | undefined): number => {
  if (!user || !user.scoreBoostPercent || !user.scoreBoostExpiry) return 0;
  if (new Date(user.scoreBoostExpiry).getTime() <= Date.now()) return 0;
  return user.scoreBoostPercent;
};

/** Get active Score Boost Event percent from admin settings (0 if expired/disabled) */
export const getEventBoostPercent = (settings: any): number => {
  const sbe = settings?.scoreBoostEvent;
  if (!sbe?.enabled || !sbe?.boostPercent) return 0;
  const now = Date.now();
  if (sbe.startsAt && new Date(sbe.startsAt).getTime() > now) return 0;
  if (sbe.endsAt && new Date(sbe.endsAt).getTime() <= now) return 0;
  return sbe.boostPercent as number;
};

/** Get combined boost: user's personal boost (redeem code) + active Score Boost Event */
export const getCombinedBoost = (
  user: { scoreBoostPercent?: number; scoreBoostExpiry?: string } | null | undefined,
  settings?: any,
): number => getActiveBoost(user) + getEventBoostPercent(settings);

/** Calculate final score with multiplier + booster */
export const calculateScore = (
  baseScore: number,
  subscriptionLevel: string | undefined,
  isPremium: boolean | undefined,
  boostPercent = 0,
): number => {
  const tier = isPremium ? (subscriptionLevel || 'FREE') : 'FREE';
  const mult = SCORE_MULTIPLIERS[tier] ?? 1.0;
  let s = Math.round(baseScore * mult);
  if (boostPercent > 0) s = Math.round(s * (1 + boostPercent / 100));
  return s;
};

// ── Score Activity Log ────────────────────────────────────────────
export interface ScoreLogEntry {
  date: string;     // YYYY-MM-DD
  ts:   number;     // unix ms
  activity: string; // e.g. 'MCQ_CORRECT' | 'VIDEO' | 'DAILY_LOGIN' …
  pts:  number;     // actual pts earned
  label?: string;   // e.g. 'Physics Ch 3 · Page 2' | 'Chemistry MCQ' — context for history display
}

const SCORE_LOG_KEY = (uid: string) => `nst_score_log_${uid}`;
const MAX_LOG = 900;
const RETENTION_DAYS = 30;

export const getScoreLog = (userId: string): ScoreLogEntry[] => {
  try { return JSON.parse(localStorage.getItem(SCORE_LOG_KEY(userId)) || '[]'); } catch { return []; }
};

export const logScoreActivity = (userId: string, activity: string, pts: number, label?: string): void => {
  if (pts <= 0) return;
  try {
    const log = getScoreLog(userId);
    const entry: ScoreLogEntry = { date: getLocalDateStr(), ts: Date.now(), activity, pts };
    if (label) entry.label = label;
    log.push(entry);
    const cutoff = getLocalDateStr(-RETENTION_DAYS);
    const pruned = log.filter(e => e.date >= cutoff);
    if (pruned.length > MAX_LOG) pruned.splice(0, pruned.length - MAX_LOG);
    localStorage.setItem(SCORE_LOG_KEY(userId), JSON.stringify(pruned));
    // Fire-and-forget Firebase sync so history persists across devices/browser clears
    import('../firebase').then(({ saveScoreLogToFirebase }) => {
      saveScoreLogToFirebase(userId, pruned).catch(() => {});
    }).catch(() => {});
  } catch {}
};

/**
 * Attempt to earn score. Applies daily limit, multiplier, and booster.
 * Returns actual score earned (may be less than requested if near daily limit).
 */
export const tryEarnScore = (
  userId: string,
  baseScore: number,
  subscriptionLevel: string | undefined,
  isPremium: boolean | undefined,
  boostPercent = 0,
  activity?: string,
  scoreLimitBoostPercent?: number,
  scoreLimitBoostExpiry?: string,
  label?: string,
): number => {
  const remaining = getRemainingDailyScore(userId, subscriptionLevel, isPremium, scoreLimitBoostPercent, scoreLimitBoostExpiry);
  const calc = calculateScore(baseScore, subscriptionLevel, isPremium, boostPercent);

  if (remaining > 0) {
    // Within daily limit — earn normally (capped at remaining)
    const actual = Math.min(calc, remaining);
    try {
      const key = getTodayKey(userId);
      const current = getDailyScoreEarned(userId);
      localStorage.setItem(key, String(current + actual));
    } catch {}
    if (actual > 0 && activity) logScoreActivity(userId, activity, actual, label);
    return actual;
  } else {
    // Over daily limit — earn at 0.5x rate (does not count against daily tracker)
    const overLimitScore = Math.max(1, Math.round(calc * 0.5));
    if (overLimitScore > 0 && activity) logScoreActivity(userId, `${activity}_OVERLIMIT`, overLimitScore, label);
    return overLimitScore;
  }
};

/**
 * Check which progress milestone was just hit.
 * Returns the base score + calculated score to award, or null if no milestone hit.
 */
export const checkMilestone = (
  prevPercent: number,
  newPercent: number,
  subscriptionLevel: string | undefined,
  isPremium: boolean | undefined,
  boostPercent = 0,
): { milestonePercent: number; baseScore: number; finalScore: number } | null => {
  for (const ms of PROGRESS_MILESTONES) {
    if (prevPercent < ms.percent && newPercent >= ms.percent) {
      return {
        milestonePercent: ms.percent,
        baseScore: ms.score,
        finalScore: calculateScore(ms.score, subscriptionLevel, isPremium, boostPercent),
      };
    }
  }
  return null;
};

/** Track which milestones have already been awarded for a given session (localStorage key) */
export const getMilestoneTrackerKey = (userId: string, sessionKey: string) =>
  `nst_ms_${userId}_${sessionKey}`;

/**
 * Check and award a milestone score for an activity session.
 * Returns earned score or 0 if already awarded / daily limit reached.
 * `sessionKey` uniquely identifies the content (e.g., `video_<id>`, `pdf_<id>`)
 */
export const awardMilestone = (
  userId: string,
  sessionKey: string,
  prevPercent: number,
  newPercent: number,
  subscriptionLevel: string | undefined,
  isPremium: boolean | undefined,
  boostPercent = 0,
): { earned: number; milestonePercent: number } | null => {
  const hit = checkMilestone(prevPercent, newPercent, subscriptionLevel, isPremium, boostPercent);
  if (!hit) return null;

  // Check if this milestone was already awarded this session
  const trackerKey = getMilestoneTrackerKey(userId, sessionKey);
  let _awardedArr: number[] = [];
  try { _awardedArr = JSON.parse(localStorage.getItem(trackerKey) || '[]'); } catch {}
  const awarded = new Set<number>(_awardedArr);
  if (awarded.has(hit.milestonePercent)) return null;

  // Award it
  const earned = tryEarnScore(userId, hit.baseScore, subscriptionLevel, isPremium, boostPercent);
  if (earned > 0) {
    awarded.add(hit.milestonePercent);
    try { localStorage.setItem(trackerKey, JSON.stringify([...awarded])); } catch {}
  }
  return { earned, milestonePercent: hit.milestonePercent };
};

/** Reset milestone tracker for a session */
export const resetMilestoneTracker = (userId: string, sessionKey: string) => {
  try { localStorage.removeItem(getMilestoneTrackerKey(userId, sessionKey)); } catch {}
};

/** Subtract pts from today's daily score (negative marking for wrong MCQ). Never goes below 0. */
export const subtractDailyScore = (userId: string, pts: number): void => {
  try {
    const key = getTodayKey(userId);
    const current = getDailyScoreEarned(userId);
    localStorage.setItem(key, String(Math.max(0, current - pts)));
  } catch {}
};

/** Get bonus score for consecutive correct MCQ answers: 3→+5, 5→+10, 7→+15, 10→+20, else 0.
 *  Only the milestone that is EXACTLY hit is rewarded (not all previous milestones). */
export const getMcqStreakBonus = (streak: number): number => {
  if (streak === 10) return 20;
  if (streak === 7) return 15;
  if (streak === 5) return 10;
  if (streak === 3) return 5;
  return 0;
};
