import React from 'react';
import type { MCQItem } from '../types';
import { renderMathInHtml } from '../utils/mathUtils';
import McqQuestionDisplay from './McqQuestionDisplay';

interface Props {
  q: MCQItem;
  questionNumber?: string | number;
  selectedOption?: number | null;
  answered?: boolean;
  showResult?: boolean;
  disabled?: boolean;
  onSelect?: (optionIndex: number) => void;
  actions?: React.ReactNode;
  variant?: 'default' | 'projector';
  fontSize?: number;
}

/**
 * Shared MCQ layout used by lesson, revision, homework and competition flows.
 * The question card deliberately keeps the stem/statements separate from the
 * answer list, matching the Revision Hub mobile layout.
 */
const McqPracticeCard: React.FC<Props> = ({
  q,
  questionNumber,
  selectedOption = null,
  answered = false,
  showResult = false,
  disabled = false,
  onSelect,
  actions,
  variant = 'default',
  fontSize,
}) => {
  const number = questionNumber ?? q.questionNumber;
  // A selected answer is still editable while the quiz is in progress.
  // Results lock the options only when showResult is enabled.
  const canSelect = Boolean(onSelect) && !disabled && (!answered || !showResult);
  const isProjector = variant === 'projector';

  return (
    <div className="space-y-3">
      <div className={`bg-white border-2 border-[#d9eef4] rounded-[22px] shadow-sm ${isProjector ? 'p-6' : 'p-4'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {number !== undefined && number !== null && (
              <div className={`${isProjector ? 'text-2xl' : 'text-base'} font-black text-slate-800 mb-2`}>
                Q{number}.
              </div>
            )}
            <div style={fontSize ? { fontSize } : undefined}>
              <McqQuestionDisplay
                q={q}
                questionClassName={isProjector
                  ? "font-bold text-slate-900 leading-relaxed"
                  : "text-[15px] font-bold text-slate-800 leading-relaxed"}
              />
            </div>
          </div>
          {actions && <div className="shrink-0 flex items-center gap-1">{actions}</div>}
        </div>
      </div>

      <div className={isProjector ? 'space-y-3' : 'space-y-2'}>
        {(q.options || []).map((opt, optionIndex) => {
          const isSelected = selectedOption === optionIndex;
          const isCorrect = optionIndex === q.correctAnswer;
          let optionClass =
            'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-[#77c9df]';

          if (showResult && answered) {
            if (isCorrect) {
              optionClass = 'bg-emerald-50 border-emerald-300 text-emerald-800';
            } else if (isSelected) {
              optionClass = 'bg-rose-50 border-rose-300 text-rose-800';
            } else {
              optionClass = 'bg-slate-50 border-slate-100 text-slate-400 opacity-60';
            }
          } else if (isSelected) {
            optionClass = 'bg-blue-50 border-blue-400 text-blue-800';
          } else if (answered) {
            optionClass = 'bg-slate-50 border-slate-100 text-slate-400 opacity-60';
          }

          return (
            <button
              type="button"
              key={optionIndex}
              onClick={() => onSelect?.(optionIndex)}
              disabled={!canSelect}
              className={`w-full text-left ${isProjector ? 'px-5 py-4 rounded-[18px]' : 'px-4 py-3 rounded-2xl'} border-2 transition-all flex items-center gap-3 font-medium ${optionClass} ${canSelect ? 'active:scale-[0.99] cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`${isProjector ? 'w-7 h-7 text-sm' : 'w-5 h-5 text-[10px]'} rounded-full border-2 flex items-center justify-center font-black shrink-0 ${
                  showResult && answered && isCorrect
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : showResult && answered && isSelected
                      ? 'bg-rose-500 border-rose-500 text-white'
                      : isSelected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-slate-300 text-slate-500'
                }`}
              >
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <span
                className={`flex-1 leading-snug ${isProjector ? 'text-lg' : 'text-sm'}`}
                style={fontSize ? { fontSize } : undefined}
                dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }}
              />
              {showResult && answered && isCorrect && <span className="text-emerald-600 font-black">✓</span>}
              {showResult && answered && isSelected && !isCorrect && <span className="text-rose-600 font-black">✕</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default McqPracticeCard;