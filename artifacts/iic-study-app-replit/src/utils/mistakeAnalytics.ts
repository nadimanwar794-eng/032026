const SESSION_KEY = 'nst_mistake_sessions_v1';

export interface MistakeSession {
  date: number;
  total: number;
  correct: number;
  wrong: number;
  maxStreak: number;
  durationSec: number;
}

export const saveMistakeSession = (session: Omit<MistakeSession, 'date'>): void => {
  try {
    const existing = getMistakeSessions();
    const updated = [{ ...session, date: Date.now() }, ...existing].slice(0, 30);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  } catch {}
};

export const getMistakeSessions = (): MistakeSession[] => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const clearMistakeSessions = (): void => {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
};
