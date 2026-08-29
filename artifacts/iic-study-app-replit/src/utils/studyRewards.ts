/**
 * Study coin deferral.
 *
 * Study rewards are persisted separately from the user profile while a study
 * session is open. The App consumes this pool when the student returns Home,
 * so the visible coin balance never changes mid-session.
 */

const pendingKey = (userId: string) => `iic_pending_study_coins_${userId}`;

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