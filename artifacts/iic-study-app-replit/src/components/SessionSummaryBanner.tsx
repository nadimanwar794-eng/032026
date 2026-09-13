/**
 * SessionSummaryBanner — HOME tab pe dikhne wala bada summary card.
 * Jab user MCQ ya lesson khatam karke HOME pe aata hai, yeh card dikhta hai
 * jisme session ka poora detail hota hai: subject, chapter, score, time, coins, pts.
 *
 * v2: Added sessionScore (pts earned) display + "More ▾" breakdown toggle.
 */

import React, { useEffect, useState } from 'react';
import { SessionCompletePayload } from '../utils/sessionNotify';
import { X, Clock, Star, CheckCircle2, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface SessionSummaryBannerProps {
  summary: SessionCompletePayload;
  onDismiss: () => void;
}

function formatTime(secs: number): string {
  if (!secs || secs <= 0) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const ACTIVITY_EMOJI: Record<string, string> = {
  MCQ: '📝',
  Reading: '📖',
  Writing: '✍️',
  LESSON: '📚',
};

const ACTIVITY_LABEL: Record<string, string> = {
  MCQ: 'MCQ',
  Reading: 'Reading Notes',
  Writing: 'Writing Notes',
  LESSON: 'Lesson',
};

export const SessionSummaryBanner: React.FC<SessionSummaryBannerProps> = ({ summary, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const isMCQ = summary.type === 'MCQ';
  const pct = isMCQ && summary.total
    ? Math.round(((summary.score ?? 0) / summary.total) * 100)
    : null;

  const scoreColor =
    pct === null ? '' :
    pct >= 80 ? 'text-emerald-400' :
    pct >= 50 ? 'text-amber-400' :
    'text-red-400';

  // MCQ sessions mein activityType override karo — reading/writing chapter ka MCQ ho to bhi "MCQ" label dikhao
  const activityKey = isMCQ ? 'MCQ' : (summary.activityType || 'LESSON');
  const activityEmoji = ACTIVITY_EMOJI[activityKey] || '📖';
  const activityLabel = ACTIVITY_LABEL[activityKey] || activityKey;
  const hasPts = (summary.sessionScore ?? 0) > 0;
  const hasCoins = (summary.coinsEarned ?? 0) > 0;

  return (
    <div
      className="mx-3 mt-3 mb-1 rounded-2xl overflow-hidden shadow-2xl"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2044 100%)',
        border: '1.5px solid rgba(250,204,21,0.35)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-18px) scale(0.97)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.3s ease',
      }}
    >
      {/* Gold shimmer top line */}
      <div
        className="h-[3px] w-full relative overflow-hidden"
        style={{ background: 'linear-gradient(90deg, transparent, #fbbf24, transparent)' }}
      >
        <span
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer-sweep 1.6s linear infinite',
          }}
        />
      </div>

      <div className="px-4 pt-3 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.35)' }}
            >
              {isMCQ
                ? <CheckCircle2 size={20} className="text-yellow-400" />
                : <BookOpen size={20} className="text-yellow-400" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-widest leading-none mb-0.5">
                {isMCQ ? 'MCQ Complete! 🎯' : 'Session Complete! 📚'}
              </p>
              <p className="text-[13px] font-bold text-white leading-tight line-clamp-1">
                {summary.chapter}
              </p>
              {summary.subject && (
                <p className="text-[11px] text-slate-400 leading-none mt-0.5">{summary.subject}</p>
              )}
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 mt-0.5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-90"
          >
            <X size={15} />
          </button>
        </div>

        {/* Stats row */}
        <div
          className="grid gap-2 mb-2"
          style={{
            gridTemplateColumns: isMCQ
              ? (hasPts ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)')
              : (hasPts ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'),
          }}
        >
          {/* Pts earned — show when sessionScore > 0 */}
          {hasPts && (
            <StatCard
              icon={<Star size={14} />}
              label="Points"
              value={
                <span className="text-base font-black text-yellow-400">
                  +{summary.sessionScore}
                </span>
              }
              sub="⭐ earned"
            />
          )}

          {/* Score (MCQ only) */}
          {isMCQ && (
            <StatCard
              icon={<CheckCircle2 size={14} />}
              label="Score"
              value={
                <span className={`text-base font-black ${scoreColor}`}>
                  {summary.score ?? 0}/{summary.total ?? 0}
                </span>
              }
              sub={pct !== null ? `${pct}%` : ''}
            />
          )}

          {/* Time */}
          <StatCard
            icon={<Clock size={14} />}
            label="Time"
            value={<span className="text-base font-black text-sky-300">{formatTime(summary.timeSecs)}</span>}
          />

          {/* Coins */}
          <StatCard
            icon={<span className="text-sm">🪙</span>}
            label="Coins"
            value={
              hasCoins
                ? <span className="text-base font-black text-amber-400">+{summary.coinsEarned}</span>
                : <span className="text-base font-black text-slate-500">—</span>
            }
          />
        </div>

        {/* More ▾ toggle — activity breakdown */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white transition active:scale-95"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {expanded ? (
            <>
              <ChevronUp size={13} />
              Less
            </>
          ) : (
            <>
              <ChevronDown size={13} />
              More — activity detail dekho
            </>
          )}
        </button>

        {/* Expanded breakdown */}
        {expanded && (
          <div className="mt-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-base shrink-0">{activityEmoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white leading-none truncate">{activityLabel}</p>
                {summary.chapter && (
                  <p className="text-[9px] text-slate-400 leading-none mt-0.5 truncate">{summary.chapter}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasPts && (
                  <span className="text-[10px] font-bold text-yellow-400">+{summary.sessionScore}⭐</span>
                )}
                {hasCoins && (
                  <span className="text-[10px] font-bold text-amber-400">+{summary.coinsEarned}🪙</span>
                )}
                {summary.timeSecs > 0 && (
                  <span className="text-[10px] text-slate-400">{formatTime(summary.timeSecs)}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function StatCard({
  icon, label, value, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl px-2 py-2.5 flex flex-col gap-0.5"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      <div className="flex items-center gap-1 text-slate-400 mb-1">
        <span className="opacity-80">{icon}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {value}
      {sub && <p className="text-[10px] text-slate-500 leading-none">{sub}</p>}
    </div>
  );
}
