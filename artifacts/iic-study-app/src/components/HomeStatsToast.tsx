// @ts-nocheck
import React, { useEffect } from 'react';
import { getLevelInfo } from '../utils/levelSystem';

interface HomeStatsToastProps {
  sessionScore: number;     // Is session mein kitna score mila (fresh)
  creditsEarned: number;    // Is session mein kitne credits mile
  bonusPts: number;         // Actual bonus pts (score * bonusPct / 100)
  sessionSeconds: number;   // Is session ki duration (seconds)
  chapterName?: string;     // Chapter / Subject naam
  activityType?: string;    // 'MCQ' | 'Reading' | 'Writing'
  totalScore: number;       // Level ke liye (display nahi hota)
  credits: number;          // Current credit balance
  visible: boolean;
  onDismiss: () => void;
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const DISPLAY_MS = 2000;

const ACTIVITY_LABEL: Record<string, string> = {
  MCQ: '📝 MCQ',
  Reading: '📖 Reading Notes',
  Writing: '✍️ Writing Notes',
};

// Theme-aware CSS variables
const S = {
  card: {
    background: 'var(--nst-color-surface)',
    border: '1px solid var(--nst-color-border)',
    boxShadow: 'var(--nst-shadow-lg)',
  } as React.CSSProperties,
  divider: {
    borderColor: 'var(--nst-color-border)',
  } as React.CSSProperties,
  label: {
    color: 'var(--nst-color-muted)',
  } as React.CSSProperties,
  text: {
    color: 'var(--nst-color-text)',
  } as React.CSSProperties,
  hint: {
    borderTop: '1px solid var(--nst-color-border)',
    color: 'var(--nst-color-muted)',
  } as React.CSSProperties,
  bar: {
    borderTop: '1px solid var(--nst-color-border)',
    background: 'var(--nst-color-surface)',
  } as React.CSSProperties,
};

export const HomeStatsToast: React.FC<HomeStatsToastProps> = ({
  sessionScore,
  creditsEarned,
  bonusPts,
  sessionSeconds,
  chapterName,
  activityType = 'MCQ',
  totalScore,
  credits,
  visible,
  onDismiss,
}) => {
  const levelInfo = getLevelInfo(totalScore);
  const actLabel = ACTIVITY_LABEL[activityType] || `📝 ${activityType}`;

  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => onDismissRef.current(), DISPLAY_MS);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-2 left-3 right-3 z-[9998] animate-in slide-in-from-top-4 fade-in duration-300"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="rounded-2xl overflow-hidden" style={S.card}>

        {/* Header — chapter name + activity */}
        <div
          className="px-3 py-2 flex items-center gap-2"
          style={{ background: `linear-gradient(90deg, ${levelInfo.color}28, ${levelInfo.color}0a)` }}
        >
          <span className="text-[11px] font-bold tracking-wide" style={{ color: levelInfo.color }}>
            {actLabel}
          </span>
          {chapterName && (
            <>
              <span className="text-[11px]" style={S.label}>·</span>
              <span className="text-[11px] font-semibold truncate flex-1" style={S.text}>{chapterName}</span>
            </>
          )}
        </div>

        {/* Stats row — 4 columns separated by theme-aware dividers */}
        <div className="flex items-stretch">

          {/* Score Mila */}
          <div
            className="flex-1 flex flex-col items-center justify-center py-3 px-1 gap-0.5"
            style={{ background: sessionScore > 0 ? `${levelInfo.color}0a` : undefined }}
          >
            <span className="text-[9px] font-bold uppercase tracking-wider" style={S.label}>Score Mila</span>
            <span className="text-[14px] font-black leading-none"
              style={{ color: sessionScore > 0 ? levelInfo.color : 'var(--nst-color-muted)' }}>
              {sessionScore > 0
                ? `+${sessionScore >= 1000 ? `${(sessionScore / 1000).toFixed(1)}k` : sessionScore}`
                : '—'}
            </span>
            <span className="text-[9px]" style={S.label}>⭐ pts</span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, ...S.divider, background: 'var(--nst-color-border)' }} />

          {/* Earn Credit */}
          <div className="flex-1 flex flex-col items-center justify-center py-3 px-1 gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={S.label}>Earn Credit</span>
            <span className="text-[14px] font-black text-amber-500 leading-none">
              {creditsEarned > 0 ? `+${creditsEarned}` : '—'}
            </span>
            <span className="text-[9px]" style={S.label}>🪙 coins</span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, ...S.divider, background: 'var(--nst-color-border)' }} />

          {/* Bonus */}
          <div className="flex-1 flex flex-col items-center justify-center py-3 px-1 gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={S.label}>Bonus</span>
            <span className="text-[14px] font-black leading-none"
              style={{ color: bonusPts > 0 ? levelInfo.color : 'var(--nst-color-muted)' }}>
              {bonusPts > 0 ? `+${bonusPts}` : '—'}
            </span>
            <span className="text-[9px]" style={S.label}>⭐ bonus pts</span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, ...S.divider, background: 'var(--nst-color-border)' }} />

          {/* Session Time */}
          <div className="flex-1 flex flex-col items-center justify-center py-3 px-1 gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={S.label}>Time</span>
            <span className="text-[14px] font-black text-emerald-500 leading-none">
              {sessionSeconds > 0 ? formatTime(sessionSeconds) : '—'}
            </span>
            <span className="text-[9px]" style={S.label}>⏱ session</span>
          </div>

        </div>

        {/* Earn Credit source hint */}
        {creditsEarned > 0 && (
          <div className="px-3 py-1.5 text-center" style={S.hint}>
            <span className="text-[10px]">
              🪙{' '}
              <span className="font-bold text-amber-500">+{creditsEarned} coins</span>{' '}
              {activityType === 'MCQ' ? 'MCQ se' : activityType === 'Writing' ? 'Writing se' : 'Reading se'} earn hue · Balance:{' '}
              <span className="font-bold" style={S.text}>{credits}</span>
            </span>
          </div>
        )}

        {/* Auto-dismiss progress bar */}
        <div className="h-[3px] relative overflow-hidden" style={{ background: 'var(--nst-color-border)' }}>
          <div
            className="h-full relative overflow-hidden"
            style={{
              background: levelInfo.color,
              animation: `credit-toast-bar ${DISPLAY_MS}ms linear forwards`,
            }}
          >
            <span
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer-sweep 0.9s linear infinite',
              }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
