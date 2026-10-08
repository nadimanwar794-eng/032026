import React, { useState, useEffect, useCallback, useRef } from 'react';
import { onCreditNotify, CreditNotifyPayload } from '../utils/creditNotify';

const TOAST_DURATION = 2000;

interface ToastEntry {
  id: number;
  payload: CreditNotifyPayload;
}

let toastIdSeq = 0;

const pillContent = (payload: CreditNotifyPayload): { text: string; isPositive: boolean } => {
  switch (payload.type) {
    case 'EARN':
      return { text: `+${payload.amount}🪙`, isPositive: true };
    case 'DEDUCTION':
      return { text: `-${payload.amount}🪙`, isPositive: false };
    case 'POINTS':
      return { text: payload.message || `+${payload.amount}⭐`, isPositive: true };
    case 'REWARD':
      return { text: payload.message || '🎁 Reward!', isPositive: true };
    case 'FREE_LIMIT':
      return { text: payload.message || '⚠️ Limit', isPositive: false };
    case 'MAIL':
      return { text: '📩 Message', isPositive: true };
    case 'INFO':
    default:
      return { text: payload.message || '', isPositive: true };
  }
};

export const CreditToast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  useEffect(() => {
    const unsub = onCreditNotify((payload) => {
      const id = ++toastIdSeq;
      setToasts(prev => [...prev, { id, payload }]);
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        timersRef.current.delete(id);
      }, TOAST_DURATION);
      timersRef.current.set(id, timer);
    });
    return () => {
      unsub();
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[99999] flex flex-col items-end gap-1.5 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 12 }}
    >
      {toasts.map(({ id, payload }) => {
        const { text, isPositive } = pillContent(payload);
        if (!text) return null;
        return (
          <div
            key={id}
            className="pointer-events-auto cursor-pointer animate-in slide-in-from-right-4 fade-in duration-200"
            onClick={() => dismiss(id)}
            style={{
              color: isPositive ? '#10b981' : '#f97316',
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: '-0.01em',
              textShadow: '0 1px 4px rgba(0,0,0,0.45)',
              userSelect: 'none',
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
};
