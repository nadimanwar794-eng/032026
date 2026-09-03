import React from 'react';
import { List } from 'lucide-react';

interface Props {
  total: number;
  currentIndex: number;
  answers: Record<number, unknown>;
  skipped?: Set<number>;
  onJump: (index: number) => void;
  className?: string;
}

/**
 * Shared question palette for every multi-question MCQ flow.
 * Attempted, skipped and untouched questions remain visually distinct
 * without revealing correctness before the final submit.
 */
export const McqQuestionNavigator: React.FC<Props> = ({
  total,
  currentIndex,
  answers,
  skipped = new Set<number>(),
  onJump,
  className = '',
}) => {
  const isAnswered = (index: number) => answers[index] !== undefined && answers[index] !== null;

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <List size={15} className="text-indigo-600" />
        <span className="text-xs font-black uppercase tracking-wide text-slate-700">All Questions</span>
        <span className="ml-auto text-[10px] font-bold text-slate-400">
          {Object.keys(answers).filter(key => isAnswered(Number(key))).length}/{total} attempted
        </span>
      </div>

      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 md:grid-cols-12">
        {Array.from({ length: total }, (_, index) => {
          const answered = isAnswered(index);
          const isSkipped = !answered && skipped.has(index);
          const isCurrent = currentIndex === index;
          const statusClass = answered
            ? 'bg-emerald-500 text-white border-emerald-600'
            : isSkipped
              ? 'bg-amber-100 text-amber-800 border-amber-400'
              : 'bg-slate-100 text-slate-600 border-slate-200';

          return (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              aria-label={`Question ${index + 1}${answered ? ', attempted' : isSkipped ? ', skipped' : ', unattempted'}`}
              className={`h-8 rounded-lg border text-[11px] font-black transition-all active:scale-95 ${statusClass} ${isCurrent ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Attempted</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-amber-400" />Skipped</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-slate-300" />Unattempted</span>
      </div>
    </section>
  );
};

export default McqQuestionNavigator;