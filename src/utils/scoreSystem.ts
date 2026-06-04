/**
 * Score System — daily limits, subscription multipliers, activity milestones
 * Daily score limit: 1500 pts (Free) / 2500 pts (Basic) / 3500 pts (Ultra)
 * Milestones: 20%=5, 40%=10, 60%=15, 80%=20, 100%=25 base pts
 * Multipliers: Free=1x, Basic=1.2x (+20%), Ultra=1.5x (+50%)
 */

export const DAILY_SCORE_LIMIT = 1500;

/** Fixed daily score limits by tier (Free=1500, Basic=2500, Ultra=3500) */
const DAILY_TIER_LIMITS: Record<string, number> = {
  FREE:  1500,
  BASIC: 2500,
  ULTRA: 3500,
};

/** Dynamic daily score limit based on subscription + optional permanent limit boost */
export const getDailyScoreLimit = (
  subscriptionLevel?: string,
  isPremium?: boolean,
  scoreLimitBoostPercent?: number,
): number => {
  const base = isPremium ? (DAILY_TIER_LIMITS[subscriptionLevel ?? 'FREE'] ?? 1500) : 1500;
  if (scoreLimitBoostPercent && scoreLimitBoostPercent > 0) {
    return Math.round(base * (1 + scoreLimitBoostPercent / 100));
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

const getTodayKey = (userId: string) => {
  const today = new Date().toISOString().split('T')[0];
  return `nst_daily_score_${userId}_${today}`;
};

export const getDailyScoreEarned = (userId: string): number => {
  try { return Number(localStorage.getItem(getTodayKey(userId)) || '0'); } catch { return 0; }
};

export const getRemainingDailyScore = (
  userId: string,
  subscriptionLevel?: string,
  isPremium?: boolean,
  scoreLimitBoostPercent?: number,
): number =>
  Math.max(0, getDailyScoreLimit(subscriptionLevel, isPremium, scoreLimitBoostPercent) - getDailyScoreEarned(userId));

/** Get active score boost % for a user (returns 0 if expired or not set) */
export const getActiveBoost = (user: { scoreBoostPercent?: number; scoreBoostExpiry?: string }): number => {
  if (!user.scoreBoostPercent || !user.scoreBoostExpiry) return 0;
  if (new Date(user.scoreBoostExpiry).getTime() <= Date.now()) return 0;
  return user.scoreBoostPercent;
};

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
}

const SCORE_LOG_KEY = (uid: string) => `nst_score_log_${uid}`;
const MAX_LOG = 600;

export const getScoreLog = (userId: string): ScoreLogEntry[] => {
  try { return JSON.parse(localStorage.getItem(SCORE_LOG_KEY(userId)) || '[]'); } catch { return []; }
};

export const logScoreActivity = (userId: string, activity: string, pts: number): void => {
  if (pts <= 0) return;
  try {
    const log = getScoreLog(userId);
    log.push({ date: new Date().toISOString().split('T')[0], ts: Date.now(), activity, pts });
    if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
    localStorage.setItem(SCORE_LOG_KEY(userId), JSON.stringify(log));
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
): number => {
  const remaining = getRemainingDailyScore(userId, subscriptionLevel, isPremium);
  if (remaining <= 0) return 0;
  const calc = calculateScore(baseScore, subscriptionLevel, isPremium, boostPercent);
  const actual = Math.min(calc, remaining);
  try {
    const key = getTodayKey(userId);
    const current = getDailyScoreEarned(userId);
    localStorage.setItem(key, String(current + actual));
  } catch {}
  if (actual > 0 && activity) logScoreActivity(userId, activity, actual);
  return actual;
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
