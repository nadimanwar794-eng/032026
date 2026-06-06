const KEY = (uid: string) => `nst_credit_history_${uid}`;
const MAX_ENTRIES = 120;

export interface CreditTxEntry {
  id: string;
  amount: number;
  type: string;
  description: string;
  balanceAfter?: number;
  at: string;
}

export const recordCreditTx = (
  userId: string,
  amount: number,
  type: string,
  description: string,
  balanceAfter?: number,
): void => {
  if (!userId) return;
  try {
    const raw = localStorage.getItem(KEY(userId));
    const existing: CreditTxEntry[] = raw ? JSON.parse(raw) : [];
    const entry: CreditTxEntry = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      amount,
      type,
      description,
      balanceAfter,
      at: new Date().toISOString(),
    };
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY(userId), JSON.stringify(updated));
  } catch {}
};

export const getCreditHistory = (userId: string): CreditTxEntry[] => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const clearCreditHistory = (userId: string): void => {
  try { localStorage.removeItem(KEY(userId)); } catch {}
};
