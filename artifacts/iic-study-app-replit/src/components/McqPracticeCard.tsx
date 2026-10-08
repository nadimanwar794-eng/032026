import React from 'react';
import { Bookmark, Slash } from 'lucide-react';
import type { MCQItem } from '../types';
import { renderMathInHtml } from '../utils/mathUtils';
import { resolveTelegramUrl } from '../services/telegramStorageService';
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
  actionsBelow?: React.ReactNode;
  variant?: 'default' | 'projector';
  twoColumnOptions?: boolean;
  fontSize?: number;
  themeMode?: 'light' | 'dark' | 'sepia';
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  eliminatedOptions?: Set<number>;
  onToggleEliminate?: (optionIndex: number) => void;
  showEliminateTool?: boolean;
}

/**
 * Shared MCQ layout used by lesson, revision, homework, projector and competition flows.
 * Provides high-contrast theme support, elimination (strike-through) tools,
 * bookmarking, and pristine typography for math and bilingual scripts.
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
  actionsBelow,
  variant = 'default',
  twoColumnOptions = false,
  fontSize,
  themeMode = 'light',
  isBookmarked = false,
  onToggleBookmark,
  eliminatedOptions = new Set<number>(),
  onToggleEliminate,
  showEliminateTool = false,
}) => {
  const number = questionNumber ?? q.questionNumber;
  const canSelect = Boolean(onSelect) && !disabled && (!answered || !showResult);
  const isProjector = variant === 'projector';
  const isDark = themeMode === 'dark';
  const isSepia = themeMode === 'sepia';

  // Question container theme styling
  let questionCardClass = 'bg-white border-2 border-[#d9eef4] text-slate-800 shadow-sm';
  if (isProjector) {
    if (isDark) {
      questionCardClass = 'bg-slate-900 border-2 border-slate-700 text-slate-100 shadow-xl';
    } else if (isSepia) {
      questionCardClass = 'bg-amber-50/90 border-2 border-amber-300 text-amber-950 shadow-sm';
    } else {
      questionCardClass = 'bg-white border-2 border-slate-200 text-slate-900 shadow-md';
    }
  }

  return (
    <div className="space-y-3.5 landscape:space-y-2">
      <div className={`${questionCardClass} rounded-[22px] transition-colors ${isProjector ? 'p-4 sm:p-6 landscape:p-3 sm:landscape:p-4' : 'p-4 landscape:p-2.5'}`}>
        {isProjector ? (
          /* ── PROJECTOR MODE: Row 1 = Question Number + Pic Add + Speaker + Save ── */
          <div className="flex flex-col gap-2">
            {/* ROW 1: Q-Number on left, 📷 Pic + 🔊 Speaker + 🔖 Save on right */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/50 dark:border-slate-800/60 flex-wrap">
              <div className="flex items-center gap-2">
                {number !== undefined && number !== null && (
                  <span className="text-xl sm:text-2xl landscape:text-lg font-black text-amber-500 dark:text-amber-400">
                    Q{number}.
                  </span>
                )}
                {isBookmarked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    ★ Saved
                  </span>
                )}
              </div>

              {/* Row 1 Action Controls: Pic Add, Speaker, Save */}
              <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                {actionsBelow}
                {actions}
                {onToggleBookmark && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBookmark();
                    }}
                    title={isBookmarked ? 'Saved (Remove bookmark)' : 'Question Save / Bookmark karein'}
                    aria-label="Save question"
                    className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                      isBookmarked
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40'
                        : isDark
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                          : isSepia
                            ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <Bookmark size={14} className={isBookmarked ? 'fill-amber-500 text-amber-500' : ''} />
                    <span>{isBookmarked ? 'Saved' : 'Save'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* ROW 2: Question Display — gets full unobstructed space */}
            <div style={fontSize ? { fontSize } : undefined} className="pt-1">
              <McqQuestionDisplay
                q={q}
                questionClassName={
                  isDark
                    ? "font-bold text-slate-100 leading-relaxed tracking-wide landscape:text-sm sm:landscape:text-base"
                    : isSepia
                      ? "font-bold text-amber-950 leading-relaxed landscape:text-sm sm:landscape:text-base"
                      : "font-bold text-slate-900 leading-relaxed landscape:text-sm sm:landscape:text-base"
                }
              />
            </div>
          </div>
        ) : (
          /* ── DEFAULT / COMPACT MODE ── */
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 landscape:mb-1">
                {number !== undefined && number !== null && (
                  <span className="text-base font-black text-slate-800">
                    Q{number}.
                  </span>
                )}
                {isBookmarked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    ★ Bookmarked
                  </span>
                )}
              </div>
              <div style={fontSize ? { fontSize } : undefined}>
                <McqQuestionDisplay
                  q={q}
                  questionClassName="text-[15px] font-bold text-slate-800 leading-relaxed landscape:text-sm"
                />
              </div>
              {actionsBelow && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-wrap items-center gap-2">
                  {actionsBelow}
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-1.5">
              {onToggleBookmark && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark();
                  }}
                  title={isBookmarked ? 'Remove bookmark' : 'Bookmark question for review'}
                  aria-label="Bookmark question"
                  className={`p-1.5 rounded-xl border transition-all ${
                    isBookmarked
                      ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-xs'
                      : isDark
                        ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                  }`}
                >
                  <Bookmark size={15} className={isBookmarked ? 'fill-amber-500 text-amber-600' : ''} />
                </button>
              )}
              {actions}
            </div>
          </div>
        )}
      </div>

      {/* MCQ Options: Row 1 = Option A & B, Row 2 = Option C & D in rotated/landscape & projector mode */}
      <div className={`grid ${
        twoColumnOptions || isProjector
          ? 'grid-cols-1 sm:grid-cols-2 landscape:grid-cols-2 gap-2.5 sm:gap-3 landscape:gap-2'
          : 'grid-cols-1 landscape:grid-cols-2 gap-2.5 landscape:gap-2'
      }`}>
        {(q.options || []).map((opt, optionIndex) => {
          const isSelected = selectedOption === optionIndex;
          const isCorrect = optionIndex === q.correctAnswer;
          const isEliminated = eliminatedOptions.has(optionIndex);
          const isOddFifth = (q.options?.length ?? 0) === 5 && optionIndex === 4;

          let optionClass = '';

          if (isDark) {
            // Dark Board Theme
            if (showResult && answered) {
              if (isCorrect) {
                optionClass = 'bg-emerald-950/80 border-emerald-500 text-emerald-100 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500';
              } else if (isSelected) {
                optionClass = 'bg-rose-950/80 border-rose-500 text-rose-100 ring-1 ring-rose-500';
              } else {
                optionClass = 'bg-slate-900/50 border-slate-800 text-slate-500 opacity-40';
              }
            } else if (isSelected) {
              optionClass = 'bg-indigo-950 border-indigo-500 text-indigo-100 shadow-md ring-2 ring-indigo-500';
            } else if (isEliminated) {
              optionClass = 'bg-slate-900/40 border-slate-800 text-slate-600 line-through opacity-35';
            } else {
              optionClass = 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600';
            }
          } else if (isSepia) {
            // Sepia Warm Paper Theme
            if (showResult && answered) {
              if (isCorrect) {
                optionClass = 'bg-emerald-100/90 border-emerald-500 text-emerald-950 ring-1 ring-emerald-400';
              } else if (isSelected) {
                optionClass = 'bg-rose-100 border-rose-400 text-rose-950 ring-1 ring-rose-400';
              } else {
                optionClass = 'bg-amber-100/40 border-amber-200 text-amber-700/50 opacity-50';
              }
            } else if (isSelected) {
              optionClass = 'bg-amber-200/80 border-amber-600 text-amber-950 ring-2 ring-amber-500';
            } else if (isEliminated) {
              optionClass = 'bg-amber-100/30 border-amber-200 text-amber-700/40 line-through opacity-40';
            } else {
              optionClass = 'bg-amber-50/80 border-amber-200/90 text-amber-950 hover:bg-amber-100/70 hover:border-amber-400';
            }
          } else {
            // Light Theme
            if (showResult && answered) {
              if (isCorrect) {
                optionClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-sm ring-1 ring-emerald-400';
              } else if (isSelected) {
                optionClass = 'bg-rose-50 border-rose-400 text-rose-900 ring-1 ring-rose-400';
              } else {
                optionClass = 'bg-slate-50 border-slate-100 text-slate-400 opacity-60';
              }
            } else if (isSelected) {
              optionClass = 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm ring-2 ring-indigo-400';
            } else if (isEliminated) {
              optionClass = 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-40';
            } else {
              optionClass = 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-indigo-300';
            }
          }

          return (
            <div key={optionIndex} className={`relative group ${isOddFifth ? 'sm:col-span-2 landscape:col-span-2' : ''}`}>
              <button
                type="button"
                onClick={() => onSelect?.(optionIndex)}
                disabled={!canSelect || isEliminated}
                className={`w-full h-full text-left ${
                  isProjector
                    ? 'px-4 sm:px-5 py-3 sm:py-4 rounded-[18px] landscape:py-2 landscape:px-3 landscape:rounded-[12px]'
                    : 'px-4 py-3 rounded-2xl landscape:py-2 landscape:px-3 landscape:rounded-xl'
                } border-2 transition-all flex items-center gap-3 font-medium ${optionClass} ${
                  canSelect && !isEliminated ? 'active:scale-[0.99] cursor-pointer' : 'cursor-default'
                }`}
              >
                <span
                  className={`${
                    isProjector
                      ? 'w-7 h-7 sm:w-8 sm:h-8 text-xs sm:text-sm landscape:w-6 landscape:h-6 landscape:text-xs'
                      : 'w-6 h-6 text-xs'
                  } rounded-full border-2 flex items-center justify-center font-black shrink-0 transition-transform ${
                    showResult && answered && isCorrect
                      ? 'bg-emerald-500 border-emerald-500 text-white scale-105'
                      : showResult && answered && isSelected
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : isDark
                            ? 'border-slate-600 text-slate-400 group-hover:border-slate-500'
                            : 'border-slate-300 text-slate-500 group-hover:border-slate-400'
                  }`}
                >
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span
                  className={`flex-1 leading-snug ${isProjector ? 'text-base sm:text-lg landscape:text-sm' : 'text-sm'} ${isEliminated ? 'line-through' : ''}`}
                  style={fontSize ? { fontSize } : undefined}
                  dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }}
                />
                {showResult && answered && isCorrect && (
                  <span className="text-emerald-500 font-black text-lg shrink-0">✓</span>
                )}
                {showResult && answered && isSelected && !isCorrect && (
                  <span className="text-rose-500 font-black text-lg shrink-0">✕</span>
                )}
              </button>

              {/* Option eliminate (cross-out) toggle button */}
              {showEliminateTool && !showResult && !answered && onToggleEliminate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleEliminate(optionIndex);
                  }}
                  title={isEliminated ? 'Restore option' : 'Eliminate / Cross out option (50:50)'}
                  aria-label="Cross out option"
                  className={`absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg border flex items-center justify-center text-xs transition-all ${
                    isEliminated
                      ? 'bg-rose-500 text-white border-rose-600 opacity-100 shadow-xs'
                      : isDark
                        ? 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-rose-400 opacity-60 hover:opacity-100'
                        : 'bg-white text-slate-400 border-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Slash size={13} className="rotate-45" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Attached Question Diagram: After Options (Sabse Aakhiri) */}
      {q.imageUrl && q.imagePosition === 'after_options' && (
        <div
          className={`my-3 flex ${
            q.imageAlign === 'left' ? 'justify-start' : q.imageAlign === 'right' ? 'justify-end' : 'justify-center'
          }`}
        >
          <div
            className="rounded-xl overflow-hidden border border-slate-300/80 bg-white/90 shadow-sm"
            style={{
              width: typeof q.imageWidth === 'number' ? `${q.imageWidth}%` : (q.imageWidth || '100%'),
              maxWidth: '100%',
            }}
          >
            <img
              src={resolveTelegramUrl(q.imageUrl)}
              alt="Question Diagram"
              className="w-full h-auto object-contain max-h-[360px] sm:max-h-[460px] rounded-xl"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default McqPracticeCard;