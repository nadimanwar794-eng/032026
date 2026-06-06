
const LOGIN_HISTORY_KEY = (userId: string) => `nst_login_history_${userId}`;
const CURRENT_SESSION_KEY = (userId: string) => `nst_current_session_${userId}`;
const MAX_HISTORY = 30;

export interface LoginSession {
  id: string;
  loginAt: string;
  logoutAt?: string;
  durationSec?: number;
}

export const recordLogin = (userId: string): string => {
  const sessionId = `sess_${Date.now()}`;
  const sessions = getLoginHistory(userId);
  const newSession: LoginSession = {
    id: sessionId,
    loginAt: new Date().toISOString(),
  };
  const updated = [newSession, ...sessions].slice(0, MAX_HISTORY);
  try { localStorage.setItem(LOGIN_HISTORY_KEY(userId), JSON.stringify(updated)); } catch {}
  try { localStorage.setItem(CURRENT_SESSION_KEY(userId), sessionId); } catch {}
  return sessionId;
};

export const updateSessionDuration = (userId: string): void => {
  try {
    const sessionId = localStorage.getItem(CURRENT_SESSION_KEY(userId));
    if (!sessionId) return;
    const sessions = getLoginHistory(userId);
    const now = new Date().toISOString();
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        const durationSec = Math.round((new Date(now).getTime() - new Date(s.loginAt).getTime()) / 1000);
        return { ...s, logoutAt: now, durationSec };
      }
      return s;
    });
    localStorage.setItem(LOGIN_HISTORY_KEY(userId), JSON.stringify(updated));
  } catch {}
};

export const getLoginHistory = (userId: string): LoginSession[] => {
  try {
    const raw = localStorage.getItem(LOGIN_HISTORY_KEY(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
};

export const formatDuration = (sec: number): string => {
  if (!sec || sec < 0) return '—';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
};

export const formatLoginTime = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
      hour12: true,
    });
  } catch { return isoString; }
};
