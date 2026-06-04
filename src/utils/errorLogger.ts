import { rtdb } from '../firebase';
import { ref, push, serverTimestamp, get, remove, query, orderByChild, limitToFirst } from 'firebase/database';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AppError {
  id?: string;
  message: string;
  stack?: string;
  componentStack?: string;
  component?: string;
  type: 'react' | 'runtime' | 'promise' | 'network' | 'manual';
  severity: ErrorSeverity;
  url: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  device: string;
  timestamp: number;
  ts?: object;
  dismissed?: boolean;
}

let _currentUserId: string | null = null;
let _currentUserName: string | null = null;
let _currentUserRole: string | null = null;

export function setErrorLoggerUser(id: string | null, name: string | null, role: string | null) {
  _currentUserId = id;
  _currentUserName = name;
  _currentUserRole = role;
}

function getDevice(): string {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  return isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
}

function classifyError(message: string): ErrorSeverity {
  const lower = message.toLowerCase();
  if (lower.includes('chunkloaderror') || lower.includes('loading chunk') || lower.includes('network error')) return 'low';
  if (lower.includes('firestore') || lower.includes('firebase') || lower.includes('permission')) return 'high';
  if (lower.includes('cannot read') || lower.includes('is not a function') || lower.includes('undefined is not')) return 'medium';
  if (lower.includes('out of memory') || lower.includes('stack overflow') || lower.includes('quota')) return 'critical';
  return 'medium';
}

const _recentErrors = new Set<string>();

/**
 * Max logs retained in Firebase. Cleanup runs after each write when
 * total exceeds this. Only medium/high/critical errors are written;
 * low-severity noise is dropped entirely.
 */
const MAX_LOG_RETENTION = 200;
const MIN_SEVERITY_TO_LOG: ErrorSeverity = 'medium';
const SEVERITY_RANK: Record<ErrorSeverity, number> = {
  low: 0, medium: 1, high: 2, critical: 3,
};

/** Session-level cap: stop writing after N errors per page load to avoid floods. */
let _sessionErrorCount = 0;
const MAX_SESSION_ERRORS = 15;

/**
 * Prune oldest error_logs entries so the node never exceeds MAX_LOG_RETENTION.
 * Runs fire-and-forget — never throws into the caller.
 */
async function pruneOldLogs(): Promise<void> {
  try {
    const logsRef = ref(rtdb, 'error_logs');
    const snap = await get(query(logsRef, orderByChild('timestamp'), limitToFirst(50)));
    if (!snap.exists()) return;

    const allSnap = await get(logsRef);
    if (!allSnap.exists()) return;
    const total = Object.keys(allSnap.val()).length;
    if (total <= MAX_LOG_RETENTION) return;

    const excess = total - MAX_LOG_RETENTION;
    let pruned = 0;
    snap.forEach(child => {
      if (pruned < excess) {
        remove(child.ref).catch(() => {});
        pruned++;
      }
    });
  } catch {
  }
}

export async function logErrorToFirebase(
  error: Error | string,
  opts: {
    type?: AppError['type'];
    componentStack?: string;
    severity?: ErrorSeverity;
  } = {}
): Promise<void> {
  try {
    const message = typeof error === 'string' ? error : (error?.message || String(error));
    const stack = typeof error === 'string' ? undefined : error?.stack;

    const severity = opts.severity ?? classifyError(message);

    if (SEVERITY_RANK[severity] < SEVERITY_RANK[MIN_SEVERITY_TO_LOG]) return;

    const dedupeKey = message.slice(0, 120);
    if (_recentErrors.has(dedupeKey)) return;
    _recentErrors.add(dedupeKey);
    setTimeout(() => _recentErrors.delete(dedupeKey), 30_000);

    if (_sessionErrorCount >= MAX_SESSION_ERRORS) return;
    _sessionErrorCount++;

    const componentMatch = opts.componentStack?.match(/\bat\s+(\w+)/);
    const component = componentMatch?.[1] || undefined;

    const payload: AppError = {
      message: message.slice(0, 500),
      stack: stack?.slice(0, 1000),
      componentStack: opts.componentStack?.slice(0, 800),
      component,
      type: opts.type ?? 'runtime',
      severity,
      url: window.location.pathname,
      userId: _currentUserId ?? undefined,
      userName: _currentUserName ?? undefined,
      userRole: _currentUserRole ?? undefined,
      device: getDevice(),
      timestamp: Date.now(),
      ts: serverTimestamp() as object,
      dismissed: false,
    };

    Object.keys(payload).forEach(k => {
      const rec = payload as unknown as Record<string, unknown>;
      if (rec[k] === undefined) delete rec[k];
    });

    await push(ref(rtdb, 'error_logs'), payload);

    if (_sessionErrorCount % 10 === 0) {
      pruneOldLogs().catch(() => {});
    }
  } catch {
  }
}

/**
 * Admin utility: manually trigger log cleanup.
 * Call from admin dashboard to keep Firebase lean.
 */
export async function cleanupErrorLogs(): Promise<{ removed: number }> {
  try {
    const logsRef = ref(rtdb, 'error_logs');
    const allSnap = await get(logsRef);
    if (!allSnap.exists()) return { removed: 0 };

    const entries = Object.entries(allSnap.val() as Record<string, AppError>);
    const total = entries.length;
    if (total <= MAX_LOG_RETENTION) return { removed: 0 };

    const sorted = entries
      .sort(([, a], [, b]) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      .slice(0, total - MAX_LOG_RETENTION);

    await Promise.all(
      sorted.map(([key]) => remove(ref(rtdb, `error_logs/${key}`)).catch(() => {}))
    );
    return { removed: sorted.length };
  } catch {
    return { removed: 0 };
  }
}
