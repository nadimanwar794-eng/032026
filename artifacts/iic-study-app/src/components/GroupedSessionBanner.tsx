/**
 * GroupedSessionBanner v2 — Naya popup, sab modes properly dikhaye
 * - Bottom-sheet style modal
 * - Top: total pts + coins + time
 * - "More" → scrollable list of ALL modes (name, pts, credits, bonus, time)
 * - Auto-dismiss 3.5s baad (smooth fade-out)
 * - Credits get recorded in history on dismiss
 */

import React, { useEffect, useRef, useState } from 'react';
import { SessionCompletePayload } from '../utils/sessionNotify';
import { X, ChevronDown, ChevronUp, Clock, Star, Zap, Trophy } from 'lucide-react';

interface GroupedSessionBannerProps {
  sessions: SessionCompletePayload[];
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

const MODE_EMOJI: Record<string, string> = {
  MCQ:       '📝',
  Reading:   '📖',
  Writing:   '✍️',
  LESSON:    '📚',
  PDF:       '📄',
  Video:     '🎬',
  Audio:     '🎧',
  QA:        '💬',
  Flashcard: '🃏',
};

const MODE_LABEL: Record<string, string> = {
  MCQ:       'MCQ Practice',
  Reading:   'Reading Notes',
  Writing:   'Writing Notes',
  LESSON:    'Lesson',
  PDF:       'PDF Reading',
  Video:     'Video Lecture',
  Audio:     'Audio / Podcast',
  QA:        'Q&A Review',
  Flashcard: 'Flashcards',
};

function getKey(s: SessionCompletePayload): string {
  if (s.activityType) return s.activityType;
  return s.type === 'MCQ' ? 'MCQ' : 'LESSON';
}

export const GroupedSessionBanner: React.FC<GroupedSessionBannerProps> = ({
  sessions,
  onDismiss,
}) => {
  const [visible, setVisible]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dismissedRef = useRef(false);

  // ── Smooth dismiss ──────────────────────────────────────────────────────────
  const handleDismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setVisible(false);
    setTimeout(onDismiss, 380);
  };

  // ── Mount: slide-in only — manual dismiss required ──────────────────────────
  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 40);
    return () => { clearTimeout(show); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalPts     = sessions.reduce((a, s) => a + (s.sessionScore  ?? 0), 0);
  const totalBonus   = sessions.reduce((a, s) => a + (s.bonusPts      ?? 0), 0);
  const totalCoins   = sessions.reduce((a, s) => a + (s.coinsEarned   ?? 0), 0);
  const totalCredits = sessions.reduce((a, s) => a + (s.creditsEarned ?? 0), 0);
  const totalSecs    = sessions.reduce((a, s) => a + (s.timeSecs      ?? 0), 0);
  const totalCoin    = totalCoins + totalCredits;
  const count        = sessions.length;

  return (
    <>
      {/* Backdrop (semi-transparent) */}
      <div
        className="fixed inset-0 z-[9988]"
        style={{
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.38s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={handleDismiss}
      />

      {/* Card — bottom-sheet style */}
      <div
        className="fixed inset-x-0 bottom-0 z-[9990] pb-safe"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.38s cubic-bezier(.34,1.4,.64,1)',
          pointerEvents: 'auto',
        }}
      >
        <div
          className="mx-2 mb-3 rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(160deg, #0d1526 0%, #162040 55%, #0d1526 100%)',
            border: '1.5px solid rgba(250,204,21,0.3)',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* ── Gold shimmer top line ─────────────────────────────────────── */}
          <div className="h-[3px] w-full shrink-0 relative overflow-hidden"
            style={{ background: 'linear-gradient(90deg, transparent, #fbbf24, transparent)' }}>
            <span className="absolute inset-0" style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-sweep 1.6s linear infinite',
            }} />
          </div>

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="px-4 pt-3.5 pb-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-xl"
                  style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
                  {count === 1
                    ? (MODE_EMOJI[getKey(sessions[0])] || '📚')
                    : <Trophy size={20} className="text-yellow-400" />}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest leading-none mb-0.5">
                    Session Complete 🎯
                  </p>
                  <p className="text-[14px] font-black text-white leading-tight">
                    {count === 1
                      ? (sessions[0].chapter || sessions[0].subject || MODE_LABEL[getKey(sessions[0])] || 'Session')
                      : `${count} modes padhe aaj`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white shrink-0"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Total stats row ────────────────────────────────────────────── */}
          <div className="px-4 pb-2 shrink-0">
            <div className="grid grid-cols-4 gap-2">
              <StatBox
                icon={<Star size={11} />}
                label="Pts"
                value={totalPts > 0 ? `+${totalPts >= 1000 ? `${(totalPts/1000).toFixed(1)}k` : totalPts}` : '—'}
                color="text-yellow-400"
              />
              <StatBox
                icon={<Zap size={11} />}
                label="Bonus"
                value={totalBonus > 0 ? `+${totalBonus}` : '—'}
                color="text-purple-400"
              />
              <StatBox
                icon={<span className="text-[11px] leading-none">🪙</span>}
                label="Credit"
                value={totalCoin > 0 ? `+${totalCoin}` : '—'}
                color="text-amber-400"
              />
              <StatBox
                icon={<Clock size={11} />}
                label="Time"
                value={formatTime(totalSecs)}
                color="text-sky-300"
              />
            </div>
          </div>

          {/* ── Close button ──────────────────────────────────────────────── */}
          <div className="px-4 pb-2 shrink-0">
            <button
              onClick={handleDismiss}
              className="w-full py-2.5 rounded-2xl text-[13px] font-black text-white active:scale-95 transition"
              style={{ background: 'linear-gradient(90deg,#dc2626,#b91c1c)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              ✕ Close
            </button>
          </div>

          {/* ── More / Less toggle ─────────────────────────────────────────── */}
          <div className="px-4 pb-2 shrink-0">
            <button
              onClick={() => setExpanded(p => !p)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition active:scale-95"
              style={{
                color: expanded ? '#fff' : 'rgba(255,255,255,0.5)',
                background: expanded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? 'Less dikhao' : `More — ${count} mode ka breakdown dekho`}
            </button>
          </div>

          {/* ── Expanded per-mode list (scrollable) ───────────────────────── */}
          {expanded && (
            <div
              className="px-4 pb-4 flex flex-col gap-2 overflow-y-auto"
              style={{ maxHeight: '55vh' }}
            >
              {sessions.map((sess, idx) => {
                const key   = getKey(sess);
                const emoji = MODE_EMOJI[key]  || '📖';
                const label = MODE_LABEL[key]  || key;
                const pts   = sess.sessionScore ?? 0;
                const bonus = sess.bonusPts     ?? 0;
                const cr    = (sess.coinsEarned ?? 0) + (sess.creditsEarned ?? 0);
                const secs  = sess.timeSecs     ?? 0;

                return (
                  <div
                    key={idx}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.09)',
                    }}
                  >
                    {/* Top row: emoji + mode name + time */}
                    <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
                      <span className="text-xl shrink-0">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-white leading-none">{label}</p>
                        {sess.chapter && (
                          <p className="text-[10px] text-slate-400 leading-none mt-0.5 truncate">{sess.chapter}</p>
                        )}
                      </div>
                      {secs > 0 && (
                        <span
                          className="shrink-0 text-[9px] font-bold text-slate-300 px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          ⏱ {formatTime(secs)}
                        </span>
                      )}
                    </div>

                    {/* Bottom row: pts / bonus / credits pills */}
                    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
                      {pts > 0 && (
                        <Pill color="yellow" icon="⭐" text={`+${pts} pts`} />
                      )}
                      {bonus > 0 && (
                        <Pill color="purple" icon="⚡" text={`+${bonus} bonus`} />
                      )}
                      {cr > 0 && (
                        <Pill color="amber" icon="🪙" text={`+${cr} cr`} />
                      )}
                      {pts === 0 && bonus === 0 && cr === 0 && (
                        <span className="text-[10px] text-slate-500 px-1">koi reward nahi</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatBox({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl px-2 py-2.5 flex flex-col items-center gap-0.5"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      <div className="flex items-center gap-0.5 text-slate-400 mb-0.5">
        <span className="opacity-75">{icon}</span>
        <span className="text-[8px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <span className={`text-[13px] font-black leading-none ${color}`}>{value}</span>
    </div>
  );
}

type PillColor = 'yellow' | 'purple' | 'amber';
const PILL_STYLES: Record<PillColor, { text: string; bg: string; border: string }> = {
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/25' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/25' },
  amber:  { text: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/25'  },
};

function Pill({ color, icon, text }: { color: PillColor; icon: string; text: string }) {
  const s = PILL_STYLES[color];
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full border ${s.text} ${s.bg} ${s.border}`}>
      {icon} {text}
    </span>
  );
}
