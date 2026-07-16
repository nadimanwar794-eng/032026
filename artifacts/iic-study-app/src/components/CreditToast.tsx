import React, { useState, useEffect, useCallback, useRef } from 'react';
import { onCreditNotify, CreditNotifyPayload } from '../utils/creditNotify';

/**
 * CreditToast — premium white toast cards, stacked with a gap, for
 * coin/points/reward events.
 *
 * Rules (per user request):
 *  • Slim floating card only — never a full-screen blurred modal.
 *  • Multiple notifications firing close together STACK as separate rows
 *    with a visible gap between them (row 1 on top, row 2 below it, etc.)
 *    instead of replacing each other.
 *  • Same look for every notification type: white card, theme-colored
 *    border (matches the app's current theme color) — no per-type colors.
 *  • Every row auto-dismisses on its own after 2 seconds, shown via a
 *    shimmering progress bar along the bottom edge of the card.
 */
const TOAST_DURATION = 2000;
const THEME_COLOR_VAR = 'var(--app-bar-color, var(--primary, #3b82f6))';

interface ToastEntry {
  id: number;
  payload: CreditNotifyPayload;
}

let toastIdSeq = 0;

const rowContent = (payload: CreditNotifyPayload): { icon: string; text: React.ReactNode } => {
  switch (payload.type) {
    case 'EARN':
      return {
        icon: '🪙',
        text: (
          <>
            +{payload.amount} Coins Mile!
            {payload.source && (
              <span className="font-normal opacity-70">
                {' '}· {payload.source === 'reading' ? 'Reading se' : payload.source === 'writing' ? 'Writing se' : 'MCQ se'}
              </span>
            )}
            {payload.remaining !== undefined && (
              <span className="font-normal opacity-70"> · Balance: {payload.remaining} coins</span>
            )}
          </>
        ),
      };
    case 'DEDUCTION':
      return {
        icon: '🪙',
        text: (
          <>
            -{payload.amount} Credits Kate
            {payload.remaining !== undefined && (
              <span className="font-normal opacity-70"> · Balance: {payload.remaining} CR</span>
            )}
          </>
        ),
      };
    case 'POINTS':
      return { icon: '⭐', text: <>{payload.message || `+${payload.amount} Points Mile!`}</> };
    case 'FREE_LIMIT':
      return { icon: '⚠️', text: <>{payload.message || 'Free limit khatam'}</> };
    case 'REWARD':
      return { icon: '🎁', text: <>{payload.message || 'Naya Reward mila!'}</> };
    case 'MAIL':
      return { icon: '📩', text: <>{payload.message || 'Naya Message aaya!'}</> };
    case 'INFO':
    default:
      return { icon: 'ℹ️', text: <>{payload.message || ''}</> };
  }
};

export const CreditToast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
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
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex flex-col items-stretch gap-2 pt-2 pointer-events-none">
      {toasts.map(({ id, payload }) => {
        const { icon, text } = rowContent(payload);
        return (
          <div
            key={id}
            className="mx-3 rounded-2xl bg-white shadow-lg overflow-hidden pointer-events-auto cursor-pointer animate-in slide-in-from-top-2 fade-in duration-300"
            style={{ border: `1.5px solid ${THEME_COLOR_VAR}` }}
            onClick={() => dismiss(id)}
          >
            <div className="flex items-center gap-2.5 px-3.5 py-2.5">
              <span className="text-base shrink-0">{icon}</span>
              <p className="text-xs font-bold leading-tight text-slate-800 flex-1">{text}</p>
            </div>
            <div className="h-[3px] w-full bg-slate-100 relative overflow-hidden">
              <div
                className="h-full relative overflow-hidden"
                style={{ background: THEME_COLOR_VAR, animation: `credit-toast-bar ${TOAST_DURATION}ms linear forwards` }}
              >
                <span
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer-sweep 0.9s linear infinite',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
