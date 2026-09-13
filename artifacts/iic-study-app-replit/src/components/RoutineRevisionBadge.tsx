// @ts-nocheck
/**
 * RoutineRevisionBadge
 * --------------------
 * Shown inside a Routine lesson card (TaskLessonCard) once the lesson is
 * complete.  It reads the Revision-Hub status for that lesson and shows:
 *
 *   • Bucket doesn't exist yet  → nothing (scheduled for tomorrow on complete)
 *   • stage NOTES, due today    → "📖 Notes padhni hain – Revision Hub kholo"
 *   • stage MCQ, due today      → "🧠 MCQ karo – Revision Hub kholo"
 *   • done for now              → "✅ Revision ho gayi – agli revision [date]"
 *
 * Re-reads the tracker every time the window regains focus so the badge
 * updates automatically after the user returns from the Revision Hub.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Brain, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { getRevisionStatusForLesson, LessonRevisionStatus } from '../utils/revisionTrackerV2';

interface Props {
  lessonId: string;
  lessonTitle: string;
  /** Called when the user taps "Revision Hub Kholo" — receives lessonId + lessonTitle so caller can apply 50-coin discount and auto-navigate */
  onGoToRevision?: (lessonId: string, lessonTitle?: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const day = new Date(ts);
  day.setHours(0, 0, 0, 0);

  if (day.getTime() === today.getTime()) return 'aaj';
  if (day.getTime() === tomorrow.getTime()) return 'kal';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const RoutineRevisionBadge: React.FC<Props> = ({ lessonId, lessonTitle, onGoToRevision }) => {
  const [status, setStatus] = useState<LessonRevisionStatus | null>(() =>
    getRevisionStatusForLesson(lessonId)
  );

  const refresh = useCallback(() => {
    setStatus(getRevisionStatusForLesson(lessonId));
  }, [lessonId]);

  // Re-read on window focus (user returned from Revision Hub)
  useEffect(() => {
    window.addEventListener('focus', refresh);
    // Also refresh on the custom event fired when revision tracker updates
    window.addEventListener('iic-revision-updated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('iic-revision-updated', refresh);
    };
  }, [refresh]);

  // Nothing to show if no bucket yet (lesson completed today — due tomorrow)
  if (!status) {
    return (
      <button
        onClick={() => onGoToRevision?.(lessonId, lessonTitle)}
        className="mt-3 w-full rounded-xl bg-indigo-50 border border-indigo-200 p-3 flex items-center gap-2.5 active:scale-[0.98] transition text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <Brain size={15} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-indigo-700">Revision Hub Unlocked!</p>
          <p className="text-[10px] text-indigo-500 mt-0.5 truncate">
            "{lessonTitle}" ki revision practice shuru karein
          </p>
        </div>
        <ChevronRight size={14} className="text-indigo-400 shrink-0" />
      </button>
    );
  }


  /* ── Done for now ── */
  if (status.isDoneForNow) {
    const nextLabel = status.nextDueAt ? formatDate(status.nextDueAt) : '—';
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2.5">
        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-emerald-700">🎉 Revision ho gayi!</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Agli revision: <span className="font-bold">{nextLabel}</span></p>
        </div>
        <button
          onClick={refresh}
          className="text-emerald-400 active:scale-90 transition"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    );
  }

  /* ── Due today — NOTES stage ── */
  if (status.isDueToday && status.stage === 'NOTES') {
    return (
      <button
        onClick={() => onGoToRevision?.(lessonId, lessonTitle)}
        className="mt-3 w-full rounded-xl bg-blue-50 border border-blue-200 p-3 flex items-center gap-2.5 active:scale-[0.98] transition text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <BookOpen size={15} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-blue-700">🔁 Revision Due — Notes</p>
          <p className="text-[10px] text-blue-500 mt-0.5 truncate">
            "{lessonTitle}" ki notes Revision Hub mein padhni hain
          </p>
        </div>
        <ChevronRight size={14} className="text-blue-400 shrink-0" />
      </button>
    );
  }

  /* ── Due today — MCQ stage ── */
  if (status.isDueToday && status.stage === 'MCQ') {
    const pct = Math.round(status.accuracy * 100);
    return (
      <button
        onClick={() => onGoToRevision?.(lessonId, lessonTitle)}
        className="mt-3 w-full rounded-xl bg-violet-50 border border-violet-200 p-3 flex items-center gap-2.5 active:scale-[0.98] transition text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <Brain size={15} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-violet-700">🧠 Revision Due — MCQ</p>
          <p className="text-[10px] text-violet-500 mt-0.5 truncate">
            "{lessonTitle}" ka MCQ Revision Hub mein karo
            {status.cycleCount > 0 && <span className="ml-1 font-bold">({pct}% last accuracy)</span>}
          </p>
        </div>
        <ChevronRight size={14} className="text-violet-400 shrink-0" />
      </button>
    );
  }

  // Bucket exists but not yet due (e.g. scheduled for tomorrow after today's completion)
  // Show a subtle "coming up" hint
  const nextLabel = status.nextDueAt ? formatDate(status.nextDueAt) : 'kal';
  return (
    <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex items-center gap-2">
      <RefreshCw size={13} className="text-slate-400 shrink-0" />
      <p className="text-[10px] text-slate-500">
        Revision scheduled: <span className="font-bold">{nextLabel}</span> ko Revision Hub mein milega
      </p>
    </div>
  );
};
