// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

// ─── Event bus ───────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warn';
interface ToastItem { id: number; type: ToastType; message: string; }

const listeners: Set<(t: ToastItem) => void> = new Set();
let _id = 0;

export const adminToast = {
  success: (message: string) => _emit('success', message),
  error:   (message: string) => _emit('error',   message),
  warn:    (message: string) => _emit('warn',     message),
};

function _emit(type: ToastType, message: string) {
  const item: ToastItem = { id: ++_id, type, message };
  listeners.forEach(fn => fn(item));
}

// ─── Container component (mount once inside AdminDashboard) ──────────────────
export const AdminToast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (t: ToastItem) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, 4000);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-0 right-0 z-[300] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-bold max-w-sm w-full pointer-events-auto animate-in slide-in-from-bottom-4 fade-in
            ${t.type === 'success' ? 'bg-emerald-600 text-white' :
              t.type === 'error'   ? 'bg-red-600 text-white' :
                                     'bg-amber-500 text-white'}`}
        >
          {t.type === 'success' && <CheckCircle size={16} className="shrink-0" />}
          {t.type === 'error'   && <XCircle     size={16} className="shrink-0" />}
          {t.type === 'warn'    && <AlertTriangle size={16} className="shrink-0" />}
          <span className="flex-1 text-xs leading-snug">{t.message}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
