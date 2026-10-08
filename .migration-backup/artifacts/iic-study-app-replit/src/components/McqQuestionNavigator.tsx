import React from 'react';
import { List } from 'lucide-react';

interface Props {
  total: number;
  currentIndex: number;
  answers: Record<number, unknown>;
  skipped?: Set<number>;
  bookmarked?: Set<number>;
  onJump: (index: number) => void;
  className?: string;
  themeMode?: 'light' | 'dark' | 'sepia';
}

/**
 * Shared question palette for every multi-question MCQ flow.
 * Attempted, skipped, bookmarked and untouched questions remain visually distinct
 * without revealing correctness before the final submit.
 */
export const McqQuestionNavigator: React.FC<Props> = ({
  total,
  currentIndex,
  answers,
  skipped = new Set<number>(),
  bookmarked = new Set<number>(),
  onJump,
  className = '',
  themeMode = 'light',
}) => {
  const isAnswered = (index: number) => answers[index] !== undefined && answers[index] !== null;
  const isDark = themeMode === 'dark';
  const isSepia = themeMode === 'sepia';

  const containerBg = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100'
    : isSepia
      ? 'bg-amber-50/90 border-amber-200 text-amber-950'
      : 'bg-white border-slate-200 text-slate-700';

  const attemptedCount = Object.keys(answers).filter(key => isAnswered(Number(key))).length;

  return (
    <section className={`rounded-2xl border p-3.5 shadow-sm transition-colors ${containerBg} ${className}`}>
      <div className="mb-2.5 flex items-center gap-2">
        <List size={15} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
        <span className="text-xs font-black uppercase tracking-wide">All Questions</span>
        <div className="ml-auto flex items-center gap-2">
          {bookmarked.size > 0 && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-800'}`}>
              ★ {bookmarked.size} marked
            </span>
          )}
          <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {attemptedCount}/{total} attempted
          </span>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 md:grid-cols-12 max-h-56 overflow-y-auto pr-1">
        {Array.from({ length: total }, (_, index) => {
          const answered = isAnswered(index);
          const isSkipped = !answered && skipped.has(index);
          const isMarked = bookmarked.has(index);
          const isCurrent = currentIndex === index;

          let statusClass = '';
          if (answered) {
            statusClass = 'bg-emerald-500 text-white border-emerald-600 font-black';
          } else if (isSkipped) {
            statusClass = isDark
              ? 'bg-amber-950/60 text-amber-300 border-amber-700'
              : 'bg-amber-100 text-amber-900 border-amber-300';
          } else {
            statusClass = isDark
              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200';
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              aria-label={`Question ${index + 1}${answered ? ', attempted' : isSkipped ? ', skipped' : ', unattempted'}${isMarked ? ', bookmarked' : ''}`}
              className={`relative h-8 rounded-lg border text-[11px] font-black transition-all active:scale-95 flex items-center justify-center ${statusClass} ${
                isCurrent ? (isDark ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' : 'ring-2 ring-indigo-500 ring-offset-1') : ''
              }`}
            >
              {index + 1}
              {isMarked && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white shadow-xs" />
              )}
            </button>
          );
        })}
      </div>

      <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-bold ${isDark ? 'text-slate-400 border-t border-slate-800 pt-2' : 'text-slate-500 border-t border-slate-100 pt-2'}`}>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />Attempted</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />Skipped</span>
        <span className="flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />Unattempted</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-400 border border-white shrink-0" />★ Marked</span>
      </div>
    </section>
  );
};

export default McqQuestionNavigator;