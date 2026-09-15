import React, { useEffect, useState } from 'react';
import { Clock3, ChevronDown, ChevronUp } from 'lucide-react';
import {
  formatActivityDuration,
  getStudyActivity,
  type StudyActivityMode,
  type StudyActivityRecord,
  type McqScoreAttempt,
} from '../utils/activityTracker';

export interface StudyCardMode {
  mode: StudyActivityMode;
  label: string;
  emoji: string;
}

const MODE_STYLES: Record<StudyActivityMode, string> = {
  READING: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  WRITING: 'bg-teal-50 text-teal-700 border-teal-100',
  MCQ: 'bg-purple-50 text-purple-700 border-purple-100',
  PROJECTOR: 'bg-amber-50 text-amber-700 border-amber-100',
  FLASHCARD: 'bg-amber-50 text-amber-700 border-amber-100',
  QA: 'bg-sky-50 text-sky-700 border-sky-100',
  PDF: 'bg-blue-50 text-blue-700 border-blue-100',
  VIDEO: 'bg-rose-50 text-rose-700 border-rose-100',
  AUDIO: 'bg-violet-50 text-violet-700 border-violet-100',
};

const get = (stats: Partial<Record<StudyActivityMode, StudyActivityRecord>>, mode: StudyActivityMode): StudyActivityRecord =>
  stats[mode] || {
    seconds: 0, sessions: 0, opens: 0, activityCount: 0, questionsSeen: 0,
    questionsAttempted: 0, correctAnswers: 0, cardsSeen: 0, knownCards: 0,
    unknownCards: 0, attempts: [], scoreHistory: [], lastOpenedAt: undefined,
  };

const pct = (c: number, t: number) => t > 0 ? Math.round((c / t) * 100) : 0;

const ScorePill: React.FC<{ label: string; score: McqScoreAttempt; color: string }> = ({ label, score, color }) => (
  <span className={`text-[9px] font-black px-1.5 py-[2px] rounded-full ${color}`}>
    {label}: {score.correct}/{score.total} ({pct(score.correct, score.total)}%)
  </span>
);

/** Stats grid — always shown (no inner toggle), used inside StudyCardExpandable */
const StatsGrid: React.FC<{
  stats: Partial<Record<StudyActivityMode, StudyActivityRecord>>;
  modes: StudyCardMode[];
  totalMcqs?: number;
}> = ({ stats, modes, totalMcqs }) => (
  <div className="grid grid-cols-2 gap-1.5">
    {modes.map(mode => {
      const item = get(stats, mode.mode);
      const scoreHistory: McqScoreAttempt[] = item.scoreHistory || [];
      const latest = scoreHistory.at(-1);
      const best = scoreHistory.length > 0
        ? scoreHistory.reduce((b, s) => pct(s.correct, s.total) > pct(b.correct, b.total) ? s : b, scoreHistory[0])
        : undefined;
      const bestPct = best ? pct(best.correct, best.total) : 0;
      const latestPct = latest ? pct(latest.correct, latest.total) : 0;
      const timings = item.attempts || [];

      return (
        <div key={mode.mode} className="rounded-xl bg-white border border-slate-100 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[10px] font-black text-slate-700">
            <span>{mode.emoji}</span>{mode.label}
          </div>

          {mode.mode === 'PROJECTOR' ? (
            <>
              <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-slate-500">
                <span>📽️</span>
                {timings.length > 0
                  ? <span>{timings.length} attempt{timings.length === 1 ? '' : 's'}</span>
                  : <span className="text-slate-400 italic text-[9px]">Abhi tak attempt nahi kiya</span>
                }
              </div>
              {timings.length > 0 && (() => {
                const _correct = timings.filter((a: { correct: boolean; seconds: number }) => a.correct).length;
                const _wrong = timings.length - _correct;
                const _avgSec = Math.round(timings.reduce((s: number, a: { correct: boolean; seconds: number }) => s + a.seconds, 0) / timings.length);
                const _avgFmt = _avgSec < 60 ? `${_avgSec}s` : `${Math.floor(_avgSec / 60)}m ${_avgSec % 60}s`;
                const _acc = Math.round((_correct / timings.length) * 100);
                return (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[9px] font-bold text-emerald-600">✅ {_correct} सही</span>
                    <span className="text-[9px] font-bold text-rose-500">❌ {_wrong} गलत</span>
                    <span className="text-[9px] font-bold text-slate-500">⏱ avg {_avgFmt}/Q</span>
                    <span className={`text-[9px] font-bold ${_acc >= 70 ? 'text-emerald-600' : _acc >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>{_acc}%</span>
                  </div>
                );
              })()}
            </>
          ) : mode.mode === 'MCQ' ? (
            <>
              <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-slate-500">
                <span className="text-purple-500">🧠</span>
                {totalMcqs != null && totalMcqs > 0
                  ? <span>{totalMcqs} MCQ available</span>
                  : <span className="text-slate-400 italic text-[9px]">MCQ count unavailable</span>
                }
              </div>
              {scoreHistory.length > 0 ? (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex flex-wrap gap-1">
                    {latest && (
                      <ScorePill
                        label="Latest"
                        score={latest}
                        color={latestPct >= 70 ? 'bg-emerald-50 text-emerald-700' : latestPct >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'}
                      />
                    )}
                    {best && latest && best !== latest && (
                      <ScorePill label="Best" score={best} color="bg-indigo-50 text-indigo-700" />
                    )}
                    {best && (!latest || best === latest) && (
                      <ScorePill
                        label="Best"
                        score={best}
                        color={bestPct >= 70 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}
                      />
                    )}
                  </div>
                  {scoreHistory.length > 1 && (
                    <div className="text-[8px] text-slate-400">{scoreHistory.length} attempts total</div>
                  )}
                </div>
              ) : (
                <div className="text-[9px] text-slate-400 mt-0.5">Abhi tak attempt nahi kiya</div>
              )}
              {timings.length > 0 && (() => {
                const _correct = timings.filter((a: { correct: boolean; seconds: number }) => a.correct).length;
                const _wrong = timings.length - _correct;
                const _avgSec = Math.round(timings.reduce((s: number, a: { correct: boolean; seconds: number }) => s + a.seconds, 0) / timings.length);
                const _avgFmt = _avgSec < 60 ? `${_avgSec}s` : `${Math.floor(_avgSec / 60)}m ${_avgSec % 60}s`;
                const _acc = Math.round((_correct / timings.length) * 100);
                return (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[9px] font-bold text-emerald-600">✅ {_correct} सही</span>
                    <span className="text-[9px] font-bold text-rose-500">❌ {_wrong} गलत</span>
                    <span className="text-[9px] font-bold text-slate-500">⏱ avg {_avgFmt}/Q</span>
                    <span className={`text-[9px] font-bold ${_acc >= 70 ? 'text-emerald-600' : _acc >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>{_acc}%</span>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-slate-500">
                <Clock3 size={10} />
                {item.seconds > 0 ? formatActivityDuration(item.seconds) : '—'}
                {mode.mode === 'FLASHCARD' && item.cardsSeen > 0 ? ` · ${item.cardsSeen} cards` : ''}
                {mode.mode === 'QA' && item.questionsSeen > 0 ? ` · ${item.questionsSeen} Q` : ''}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">
                {item.sessions || 0} session{item.sessions === 1 ? '' : 's'}
                {item.lastOpenedAt
                  ? ` · ${new Date(item.lastOpenedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                  : ''}
              </div>
            </>
          )}
        </div>
      );
    })}
  </div>
);

/**
 * StudyCardExpandable — replaces StudyModeButtons + StudyStatsPanel.
 *
 * Collapsed: single small ▾ chevron button.
 * Expanded:  mode buttons (scrollable row) + stats grid — both together.
 */
export const StudyCardExpandable: React.FC<{
  modes: StudyCardMode[];
  onModeClick: (mode: StudyActivityMode) => void;
  userId: string;
  contentId: string;
  totalMcqs?: number;
  open: boolean;
  onToggle: () => void;
}> = ({ modes, onModeClick, userId, contentId, totalMcqs, open, onToggle }) => {
  const [stats, setStats] = useState(() => getStudyActivity(userId, contentId));

  useEffect(() => {
    if (open) setStats(getStudyActivity(userId, contentId));
  }, [open, userId, contentId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setStats(getStudyActivity(userId, contentId)), 1000);
    return () => window.clearInterval(timer);
  }, [open, userId, contentId]);

  return (
    <div className="border-t border-slate-100">
      {/* Toggle row — always visible */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className="w-full flex items-center justify-center py-1.5 active:scale-95 transition-all"
        aria-expanded={open}
      >
        {open
          ? <ChevronUp size={16} className="text-slate-400" />
          : <ChevronDown size={16} className="text-slate-400" />
        }
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="px-3 pb-3 space-y-2.5 bg-slate-50/60">
          {/* Mode buttons — scrollable single row */}
          {modes.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 pt-0.5">
              {modes.map(mode => (
                <button
                  key={mode.mode}
                  type="button"
                  onClick={e => { e.stopPropagation(); onModeClick(mode.mode); onToggle(); }}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-[10px] font-black active:scale-95 transition-all ${MODE_STYLES[mode.mode]}`}
                >
                  {mode.emoji} {mode.label}
                </button>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">📈 Progress</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Stats grid */}
          <StatsGrid stats={stats} modes={modes} totalMcqs={totalMcqs} />
        </div>
      )}
    </div>
  );
};

// ── Legacy exports kept for any remaining usages ──────────────────────────────

export const StudyModeButtons: React.FC<{
  modes: StudyCardMode[];
  onModeClick: (mode: StudyActivityMode) => void;
}> = ({ modes, onModeClick }) => (
  <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5" aria-label="Available study modes">
    {modes.map(mode => (
      <button
        key={mode.mode}
        type="button"
        onClick={event => { event.stopPropagation(); onModeClick(mode.mode); }}
        className={`shrink-0 px-2 py-1 rounded-lg border text-[9px] font-black active:scale-95 transition-all ${MODE_STYLES[mode.mode]}`}
        title={`Open ${mode.label}`}
      >
        {mode.emoji} {mode.label}
      </button>
    ))}
  </div>
);

export const StudyStatsPanel: React.FC<{
  userId: string;
  contentId: string;
  modes: StudyCardMode[];
  open: boolean;
  onToggle: () => void;
  totalMcqs?: number;
}> = ({ userId, contentId, modes, open, onToggle, totalMcqs }) => {
  const [stats, setStats] = useState(() => getStudyActivity(userId, contentId));
  useEffect(() => {
    if (open) setStats(getStudyActivity(userId, contentId));
  }, [open, userId, contentId]);
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setStats(getStudyActivity(userId, contentId)), 1000);
    return () => window.clearInterval(timer);
  }, [open, userId, contentId]);

  return (
    <div className="border-t border-slate-100 bg-slate-50/80">
      <button
        type="button"
        onClick={event => { event.stopPropagation(); onToggle(); }}
        className="px-3 py-2 flex items-center gap-1 active:scale-95"
        aria-expanded={open}
      >
        {open ? (
          <>
            <ChevronUp size={13} className="text-indigo-600" />
            <span className="text-[10px] font-black text-slate-600">Stats</span>
            <span className="text-[9px] font-bold text-slate-400">Hide</span>
          </>
        ) : (
          <span className="text-[13px] leading-none" title="View progress">📈</span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3">
          <StatsGrid stats={stats} modes={modes} totalMcqs={totalMcqs} />
        </div>
      )}
    </div>
  );
};
