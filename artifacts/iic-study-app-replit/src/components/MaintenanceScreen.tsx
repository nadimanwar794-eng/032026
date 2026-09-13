/**
 * MaintenanceScreen.tsx
 * Smart Crash Protection System — shown instead of React error screens.
 * Users see a professional maintenance page; never a white crash screen.
 */
import React, { useEffect, useState } from 'react';

interface Props {
  title?: string;
  message?: string;
  retryMinutes?: number;
  /** If true, shows a compact banner instead of full-page */
  compact?: boolean;
  onRetry?: () => void;
}

export function MaintenanceScreen({
  title = 'System Update in Progress',
  message = 'We are updating our system to improve your experience. Please try again after some time.',
  retryMinutes = 30,
  compact = false,
  onRetry,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(retryMinutes * 60);

  useEffect(() => {
    setSecondsLeft(retryMinutes * 60);
  }, [retryMinutes]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  if (compact) {
    return (
      <div className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 animate-in fade-in">
        <span className="text-xl shrink-0">🔧</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-amber-800 leading-tight truncate">{title}</p>
          <p className="text-[10px] text-amber-600 mt-0.5 leading-snug line-clamp-2">{message}</p>
        </div>
        <button
          onClick={handleRetry}
          className="shrink-0 text-[10px] font-black text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl hover:bg-amber-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-screen flex flex-col items-center justify-center p-5 text-center font-sans"
      style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0fdf4 100%)' }}
    >
      {/* Animated gear icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-blue-100">
          <span className="text-4xl animate-spin" style={{ animationDuration: '4s' }}>⚙️</span>
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow-md">
          <span className="text-[10px]">🔧</span>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm p-6">
        {/* IIC badge */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IIC Team</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>

        <h1 className="text-lg font-black text-slate-800 mb-2 leading-snug">{title}</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-5">{message}</p>

        {/* Countdown timer */}
        {secondsLeft > 0 && (
          <div className="mb-5 bg-blue-50 border border-blue-100 rounded-2xl p-3">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
              Estimated wait time
            </p>
            <div className="flex items-center justify-center gap-1">
              <div className="bg-white rounded-xl px-3 py-1.5 shadow-sm border border-blue-100 min-w-[48px]">
                <span className="text-2xl font-black text-blue-700 font-mono leading-none">{mm}</span>
                <p className="text-[8px] text-blue-400 font-bold uppercase">min</p>
              </div>
              <span className="text-xl font-black text-blue-300">:</span>
              <div className="bg-white rounded-xl px-3 py-1.5 shadow-sm border border-blue-100 min-w-[48px]">
                <span className="text-2xl font-black text-blue-700 font-mono leading-none">{ss}</span>
                <p className="text-[8px] text-blue-400 font-bold uppercase">sec</p>
              </div>
            </div>
          </div>
        )}

        {/* Retry button */}
        <button
          onClick={handleRetry}
          className="w-full bg-blue-600 text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 mb-3"
        >
          <span>🔄</span> Try Again
        </button>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Agar yeh message zyada der tak rahe to{' '}
          <span className="font-bold text-slate-500">1 ghante baad dobara try karein</span>.
          Aapka data safe hai. 🔒
        </p>
      </div>

      {/* Footer assurance */}
      <p className="mt-6 text-[11px] text-slate-400 font-semibold">
        — IIC Study App Team
      </p>
    </div>
  );
}

/** Compact banner shown at the top of home when maintenance is active */
export function MaintenanceBanner({
  title,
  message,
  onClick,
}: {
  title: string;
  message: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 hover:bg-amber-100 transition-colors text-left animate-in fade-in mb-3"
    >
      <span className="text-lg shrink-0">🔧</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-amber-800 leading-tight">{title}</p>
        <p className="text-[10px] text-amber-600 mt-0.5 line-clamp-1">{message}</p>
      </div>
      <span className="text-[10px] font-black text-amber-500 bg-white border border-amber-200 px-2 py-1 rounded-lg shrink-0">
        View →
      </span>
    </button>
  );
}

/** Popup shown to admin when admin dashboard crashed — displayed on student dashboard */
export function AdminCrashPopup({
  errorMessage,
  crashedAt,
  onMarkFixed,
  onDismiss,
}: {
  errorMessage: string;
  crashedAt: number;
  onMarkFixed: () => void;
  onDismiss: () => void;
}) {
  const ago = crashedAt
    ? (() => {
        const d = Date.now() - crashedAt;
        if (d < 60000) return `${Math.floor(d / 1000)}s ago`;
        if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
        return `${Math.floor(d / 3600000)}h ago`;
      })()
    : 'just now';

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span className="font-black text-sm">Admin Dashboard Crashed</span>
            </div>
            <button
              onClick={onDismiss}
              className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors text-white font-black text-sm"
            >
              ×
            </button>
          </div>
          <p className="text-orange-100 text-[10px] mt-1">
            Admin dashboard crash hua — aap student view mein aa gaye hain ({ago})
          </p>
        </div>

        {/* Error details */}
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <p className="text-[9px] font-black text-red-400 uppercase mb-1">Error</p>
          <p className="text-xs font-bold text-red-800 line-clamp-3 font-mono">
            {errorMessage || 'Unknown error'}
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2.5">
          <p className="text-[10px] text-slate-500 text-center">
            Bug fix karne ke baad "Mark as Fixed" dabayein — sab normal ho jayega.
          </p>
          <button
            onClick={onMarkFixed}
            className="w-full bg-green-600 text-white font-black text-sm py-3 rounded-2xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            ✅ Mark as Fixed
          </button>
          <button
            onClick={onDismiss}
            className="w-full bg-slate-100 text-slate-600 font-bold text-sm py-2.5 rounded-2xl hover:bg-slate-200 transition-colors"
          >
            Baad Mein Dekhta Hoon
          </button>
        </div>
      </div>
    </div>
  );
}
