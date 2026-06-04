import React, { useState, useEffect, useCallback } from 'react';
import { onCreditNotify, CreditNotifyPayload } from '../utils/creditNotify';

interface Toast {
  id: number;
  payload: CreditNotifyPayload;
}

let _toastId = 0;

export const CreditToast: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const unsub = onCreditNotify((payload) => {
      const id = ++_toastId;
      setToasts(prev => [...prev.slice(-3), { id, payload }]);
      const delay = payload.type === 'FREE_LIMIT' ? 3500 : 4000;
      setTimeout(() => remove(id), delay);
    });
    return unsub;
  }, [remove]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-3 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(({ id, payload }) => (
        <div
          key={id}
          className="animate-in slide-in-from-right-4 fade-in duration-300 pointer-events-auto"
          onClick={() => remove(id)}
        >
          {payload.type === 'DEDUCTION' ? (
            <div
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl shadow-2xl cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(15,15,15,0.97), rgba(25,20,5,0.97))',
                border: '1px solid rgba(234,179,8,0.45)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(234,179,8,0.15)',
                backdropFilter: 'blur(12px)',
                maxWidth: '220px',
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base"
                style={{ background: 'rgba(234,179,8,0.18)', border: '1px solid rgba(234,179,8,0.35)' }}
              >
                🪙
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-amber-300 leading-tight">
                  -{payload.amount} Credits Kate
                </p>
                {payload.remaining !== undefined && (
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Baaki: <span className="text-amber-500 font-bold">{payload.remaining} CR</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl shadow-xl cursor-pointer"
              style={{
                background: 'rgba(12,12,12,0.96)',
                border: '1px solid rgba(99,102,241,0.35)',
                boxShadow: '0 2px 16px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(10px)',
                maxWidth: '200px',
              }}
            >
              <span className="text-sm">⚠️</span>
              <p className="text-[11px] font-bold text-indigo-300 leading-tight">
                {payload.message || 'Free limit khatam'}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
