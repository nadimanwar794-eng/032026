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
    <div className="fixed top-0 left-0 right-0 z-[9999] flex flex-col pointer-events-none">
      {toasts.map(({ id, payload }) => (
        <div
          key={id}
          className="w-full animate-in slide-in-from-top-2 fade-in duration-300 pointer-events-auto cursor-pointer"
          onClick={() => remove(id)}
        >
          {payload.type === 'DEDUCTION' ? (
            <div
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2"
              style={{
                background: 'linear-gradient(90deg, #92400e, #b45309, #92400e)',
                color: '#fef3c7',
              }}
            >
              <span className="text-sm shrink-0">🪙</span>
              <p className="text-xs font-black leading-tight">
                -{payload.amount} Credits Kate
                {payload.remaining !== undefined && (
                  <span className="font-normal opacity-80"> · Baaki: {payload.remaining} CR</span>
                )}
              </p>
            </div>
          ) : (
            <div
              className="w-full flex items-center justify-center gap-2 px-4 py-2"
              style={{
                background: 'linear-gradient(90deg, #3730a3, #4338ca, #3730a3)',
                color: '#e0e7ff',
              }}
            >
              <span className="text-sm shrink-0">⚠️</span>
              <p className="text-xs font-bold leading-tight">
                {payload.message || 'Free limit khatam'}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
