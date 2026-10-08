/**
 * Utility to manage daily free limits for the Fix / Correction feature.
 * Free students get 2 free Fix/Correction submissions per calendar day.
 * Paid (Basic/Ultra/Admin) students have unlimited access.
 */

export const FREE_DAILY_FIX_LIMIT = 2;

export const getTodayDateKey = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getFreeDailyFixUsedCount = (userId?: string | null): number => {
  try {
    const today = getTodayDateKey();
    const uid = userId || 'guest';
    const key = `nst_free_daily_fix_used_${today}_${uid}`;
    const val = localStorage.getItem(key);
    return val ? Math.max(0, parseInt(val, 10) || 0) : 0;
  } catch {
    return 0;
  }
};

export const getFreeDailyFixRemaining = (userId?: string | null): number => {
  const used = getFreeDailyFixUsedCount(userId);
  return Math.max(0, FREE_DAILY_FIX_LIMIT - used);
};

export const incrementFreeDailyFixCount = (userId?: string | null): number => {
  try {
    const today = getTodayDateKey();
    const uid = userId || 'guest';
    const key = `nst_free_daily_fix_used_${today}_${uid}`;
    const used = getFreeDailyFixUsedCount(uid);
    const next = used + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return 1;
  }
};
