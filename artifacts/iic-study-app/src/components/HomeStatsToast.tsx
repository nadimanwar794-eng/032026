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
  }, [visible]); // onDismiss ref se liya — visible change pe hi timer reset ho

  if (!visible) return null;

  return (
    <div
      className="fixed top-2 left-3 right-3 z-[9998] animate-in slide-in-from-top-4 fade-in duration-300"
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-100"
      >
        {/* Header — chapter name + activity */}
        <div
          className="px-3 py-2 flex items-center gap-2"
          style={{ background: `linear-gradient(90deg, ${levelInfo.color}20, ${levelInfo.color}08)` }}
        >
          <span className="text-[11px] font-bold tracking-wide" style={{ color: levelInfo.color }}>
            {actLabel}
          </span>
          {chapterName && (
            <>
              <span className="text-[11px] text-slate-300">·</span>
              <span className="text-[11px] font-semibold text-slate-600 truncate flex-1">{chapterName}</span>
            </>
          )}
        </div>

        {/* Stats row — 4 columns */}
        <div className="flex items-stretch divide-x divide-slate-100">

          {/* Score Mila — fresh session score */}
          <div
            className="flex-1 flex flex-col items-center justify-center py-3 px-1 gap-0.5"
            style={{ background: sessionScore > 0 ? `${levelInfo.color}08` : undefined }}
          >
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Score Mila</span>
            <span
              className="text-[14px] font-black leading-none"
              style={{ color: sessionScore > 0 ? levelInfo.color : '#94a3b8' }}
            >
              {sessionScore > 0
                ? `+${sessionScore >= 1000 ? `${(sessionScore / 1000).toFixed(1)}k` : sessionScore}`
                : '—'}
            </span>
            <span className="text-[9px] text-slate-400">⭐ pts</span>
          </div>

          {/* Earn Credit — sirf is session mein mila */}
          <div className="flex-1 flex flex-col items-center justify-center py-3 px-1 gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Earn Credit</span>
            <span className="text-[14px] font-black text-amber-500 leading-none">
              {creditsEarned > 0 ? `+${creditsEarned}` : '—'}
            </span>
            <span className="text-[9px] text-slate-400">🪙 coins</span>
          </div>

          {/* Bonus — actual bonus pts earned */}
          <div className="flex-1 flex flex-col items-center justify-center py-3 px-1 gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bonus</span>
            <span
              className="text-[14px] font-black leading-none"
              style={{ color: bonusPts > 0 ? levelInfo.color : '#94a3b8' }}
            >
              {bonusPts > 0 ? `+${bonusPts}` : '—'}
            </span>
            <span className="text-[9px] text-slate-400">⭐ bonus pts</span>
          </div>

          {/* Session Time */}
          <div className="flex-1 flex flex-col items-center justify-center py-3 px-1 gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Time</span>
            <span className="text-[14px] font-black text-emerald-600 leading-none">
              {sessionSeconds > 0 ? formatTime(sessionSeconds) : '—'}
            </span>
            <span className="text-[9px] text-slate-400">⏱ session</span>
          </div>

        </div>

        {/* Earn Credit source hint */}
        {creditsEarned > 0 && (
          <div
            className="px-3 py-1.5 text-center"
            style={{ background: `${levelInfo.color}06` }}
          >
            <span className="text-[10px] text-slate-500">
              🪙 <span className="font-bold text-amber-600">+{creditsEarned} coins</span>{' '}
              {activityType === 'MCQ' ? 'MCQ se' : activityType === 'Writing' ? 'Writing se' : 'Reading se'} earn hue · Balance: <span className="font-bold">{credits}</span>
            </span>
          </div>
        )}

        {/* Auto-dismiss progress bar with shimmer */}
        <div className="h-[3px] bg-slate-100 relative overflow-hidden">
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
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
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
