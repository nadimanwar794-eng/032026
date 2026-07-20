/**
 * sessionNotify — lightweight custom-event bus for session-complete data.
 * Fired from MyRoutine (lesson) and caught in App.tsx to set
 * pendingSessionSummary without threading props through StudentDashboard.
 *
 * v2: Queue system added — sessions are stored in localStorage and consumed
 * when user opens the HOME tab, so multiple activities (Reading + Writing + MCQ)
 * show as ONE grouped notification instead of firing one-by-one.
 */

export interface SessionCompletePayload {
  type: 'MCQ' | 'LESSON';
  subject: string;
  chapter: string;   // chapter title (MCQ) or lesson title (Lesson)
  score?: number;    // MCQ: correct answers
  total?: number;    // MCQ: total questions
  timeSecs: number;
  coinsEarned?: number; // filled later by home-tab coin sync
  // v2 fields
  activityType?: string;  // 'MCQ' | 'Reading' | 'Writing' | 'PDF' | 'Video' | 'Audio' | 'QA' | 'Flashcard'
  sessionScore?: number;  // pts earned this session (for grouped display)
  // v3 fields — direct credit rewards (not coin conversion from pts)
  creditsEarned?: number; // credits earned directly from engine (writing/pdf/video/qa)
  // v4 fields — bonus pts from level multiplier (computed at display time)
  bonusPts?: number;
}

// ── Event bus (legacy — still used by fireSessionComplete callers) ─────────
export const fireSessionComplete = (payload: SessionCompletePayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('iic-session-complete', { detail: payload }));
};

export const onSessionComplete = (cb: (payload: SessionCompletePayload) => void) => {
  const handler = (e: Event) => cb((e as CustomEvent<SessionCompletePayload>).detail);
  window.addEventListener('iic-session-complete', handler);
  return () => window.removeEventListener('iic-session-complete', handler);
};

// ── Queue system — for grouped HOME-tab notifications ─────────────────────
const SESSION_QUEUE_KEY = 'iic_pending_session_queue';

/** Queue a session — shown as grouped banner when user opens HOME tab. */
export const queueSession = (payload: SessionCompletePayload): void => {
  try {
    const existing: SessionCompletePayload[] = JSON.parse(
      localStorage.getItem(SESSION_QUEUE_KEY) || '[]'
    );
    existing.push(payload);
    localStorage.setItem(SESSION_QUEUE_KEY, JSON.stringify(existing));
  } catch {
    // ignore storage errors
  }
};

/** Consume and clear the session queue. Returns all pending sessions. */
export const consumeSessionQueue = (): SessionCompletePayload[] => {
  try {
    const queue: SessionCompletePayload[] = JSON.parse(
      localStorage.getItem(SESSION_QUEUE_KEY) || '[]'
    );
    localStorage.removeItem(SESSION_QUEUE_KEY);
    return queue;
  } catch {
    return [];
  }
};

/** Peek at queue length without consuming. */
export const getSessionQueueLength = (): number => {
  try {
    const queue = JSON.parse(localStorage.getItem(SESSION_QUEUE_KEY) || '[]');
    return Array.isArray(queue) ? queue.length : 0;
  } catch {
    return 0;
  }
};
