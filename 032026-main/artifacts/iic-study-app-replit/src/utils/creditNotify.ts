export type CreditNotifyType = 'DEDUCTION' | 'FREE_LIMIT' | 'EARN' | 'REWARD' | 'MAIL' | 'POINTS' | 'INFO';

export interface CreditNotifyPayload {
  type: CreditNotifyType;
  amount?: number;
  remaining?: number;
  feature?: string;
  message?: string;
  /** For EARN: where coins came from (reading/writing/mcq) */
  source?: 'reading' | 'writing' | 'mcq';
}

/** When true, all credit/points notifications are silently dropped (e.g. during MCQ). */
let _mcqNotifSuppressed = false;
export const setMcqNotifSuppressed = (suppressed: boolean): void => {
  _mcqNotifSuppressed = suppressed;
};
export const isMcqNotifSuppressed = (): boolean => _mcqNotifSuppressed;

/** When true, EARN-type notifications are dropped on Home tab (shown in HomeStatsToast instead). */
let _homeTabActive = false;
export const setHomeTabActive = (active: boolean): void => {
  _homeTabActive = active;
};

export const fireCreditNotify = (payload: CreditNotifyPayload) => {
  if (typeof window === 'undefined') return;
  if (_mcqNotifSuppressed) return; // MCQ session active — no distractions
  if (_homeTabActive && payload.type === 'EARN') return; // Home tab — EARN shown in HomeStatsToast
  window.dispatchEvent(new CustomEvent('iic-credit-notify', { detail: payload }));
};

export const onCreditNotify = (cb: (payload: CreditNotifyPayload) => void) => {
  const handler = (e: Event) => cb((e as CustomEvent<CreditNotifyPayload>).detail);
  window.addEventListener('iic-credit-notify', handler);
  return () => window.removeEventListener('iic-credit-notify', handler);
};
