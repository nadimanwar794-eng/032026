/**
 * sessionNotify — lightweight custom-event bus for session-complete data.
 * Fired from MyRoutine (lesson) and caught in App.tsx to set
 * pendingSessionSummary without threading props through StudentDashboard.
 */

export interface SessionCompletePayload {
  type: 'MCQ' | 'LESSON';
  subject: string;
  chapter: string;   // chapter title (MCQ) or lesson title (Lesson)
  score?: number;    // MCQ: correct answers
  total?: number;    // MCQ: total questions
  timeSecs: number;
  coinsEarned?: number; // filled later by home-tab coin sync
}

export const fireSessionComplete = (payload: SessionCompletePayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('iic-session-complete', { detail: payload }));
};

export const onSessionComplete = (cb: (payload: SessionCompletePayload) => void) => {
  const handler = (e: Event) => cb((e as CustomEvent<SessionCompletePayload>).detail);
  window.addEventListener('iic-session-complete', handler);
  return () => window.removeEventListener('iic-session-complete', handler);
};
