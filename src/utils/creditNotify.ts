export type CreditNotifyType = 'DEDUCTION' | 'FREE_LIMIT';

export interface CreditNotifyPayload {
  type: CreditNotifyType;
  amount?: number;
  remaining?: number;
  feature?: string;
  message?: string;
}

export const fireCreditNotify = (payload: CreditNotifyPayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('iic-credit-notify', { detail: payload }));
};

export const onCreditNotify = (cb: (payload: CreditNotifyPayload) => void) => {
  const handler = (e: Event) => cb((e as CustomEvent<CreditNotifyPayload>).detail);
  window.addEventListener('iic-credit-notify', handler);
  return () => window.removeEventListener('iic-credit-notify', handler);
};
