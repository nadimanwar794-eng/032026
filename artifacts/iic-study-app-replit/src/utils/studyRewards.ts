/**
 * Study coin deferral.
 *
 * Study rewards are persisted separately from the user profile while a study
 * session is open. The App consumes this pool when the student returns Home,
 * so the visible coin balance never changes mid-session.
 */

const pendingKey = (userId: string) => `iic_pending_study_coins_${userId}`;
const xpCreditCarryKey = (userId: string, date: string, divisor: number, scope: string) =>
  scope === 'mcq'
    ? `iic_mcq_xp_credit_carry_${userId}_${date}_${divisor}`
    : `iic_xp_credit_carry_${scope}_${userId}_${date}_${divisor}`;

export const deferStudyCoins = (userId: string | undefined, amount: number): void => {
  if (!userId || !Number.isFinite(amount) || amount <= 0) return;
  try {
    const key = pendingKey(userId);
    const previous = Number.parseInt(localStorage.getItem(key) || '0', 10) || 0;
    localStorage.setItem(key, String(previous + Math.floor(amount)));
  } catch {
    // Storage may be unavailable in private browsing; reward paths remain safe.
  }
};

export const consumeDeferredStudyCoins = (userId: string | undefined): number => {
  if (!userId) return 0;
  try {
    const key = pendingKey(userId);
    const amount = Number.parseInt(localStorage.getItem(key) || '0', 10) || 0;
    localStorage.removeItem(key);
    return Math.max(0, amount);
  } catch {
    return 0;
  }
};

/**
 * Convert XP to study credits cumulatively.
 *
 * Credits are earned from the total XP, not independently per question. The
 * carry value preserves the fractional part between answers/sessions so a
 * user earns exactly floor(total XP / 6) with Routine enabled, or
 * floor(total XP / 8) otherwise.
 */
export const deferCreditsFromXp = (
  userId: string | undefined,
  xpEarned: number,
  routineEnabled: boolean,
  scope = 'mcq',
): void => {
  if (!userId || !Number.isFinite(xpEarned) || xpEarned <= 0) return;
  try {
    const divisor = routineEnabled ? 6 : 8;
    const date = new Date().toISOString().split('T')[0];
    const key = xpCreditCarryKey(userId, date, divisor, scope);
    const previousCarry = Number.parseInt(localStorage.getItem(key) || '0', 10) || 0;
    const totalXp = previousCarry + Math.floor(xpEarned);
    const creditsEarned = Math.floor(totalXp / divisor);
    localStorage.setItem(key, String(totalXp % divisor));
    if (creditsEarned > 0) deferStudyCoins(userId, creditsEarned);
  } catch {
    // Storage may be unavailable in private browsing; XP remains safe.
  }
};

/** MCQ XP conversion kept as a named wrapper for existing callers. */
export const deferMcqCreditsFromXp = (
  userId: string | undefined,
  xpEarned: number,
  routineEnabled: boolean,
): void => deferCreditsFromXp(userId, xpEarned, routineEnabled, 'mcq');