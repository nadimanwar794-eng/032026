/**
 * McqQuestionDisplay
 * Renders an MCQ question with:
 *  - Inline markdown (** bold **, * italic *)
 *  - Math/formula rendering (KaTeX)
 *  - Auto-extracted numbered statements in a distinct visual block
 *  - Optional closing suffix ("Which of the above…")
 *
 * Use this component everywhere an MCQ question is shown:
 * LessonView (QA, batch, results), FlashcardMcqView (card + projector).
 */

import React from 'react';
import { MCQItem } from '../types';
import { inlineMd, parseMcqQuestion, shouldShowMcqOptions } from '../utils/mcqRender';
import { renderMathInHtml } from '../utils/mathUtils';

interface Props {
  q: MCQItem;
  /** Extra class applied to the question stem and suffix divs */
  questionClassName?: string;
  /** Extra class applied to each statement row (overrides default styling) */
  stmtClassName?: string;
  /** Visual variant: 'default' (light) | 'dark' (projector) */
  variant?: 'default' | 'dark';
  /** In Q&A/Flashcard contexts, show options only for qualifying questions. */
  showOptions?: boolean;
}

const McqQuestionDisplay: React.FC<Props> = ({
  q,
  questionClassName = '',
  stmtClassName,
  variant = 'default',
  showOptions = false,
}) => {
  const { questionHtml, statements, suffixHtml } = parseMcqQuestion(q);

  const defaultStmtCls =
    variant === 'dark'
      ? 'bg-slate-800 border-l-4 border-indigo-400 p-3 rounded-lg text-slate-200 text-[15px] font-medium leading-snug'
      : 'bg-indigo-50/70 border-l-4 border-indigo-300 p-2.5 rounded-lg text-slate-700 text-sm font-medium leading-snug';

  const stmtCls = stmtClassName ?? defaultStmtCls;

  return (
    <>
      {/* Question stem */}
      <div
        className={questionClassName}
        dangerouslySetInnerHTML={{ __html: questionHtml }}
      />

      {/* Numbered statements block */}
      {statements.length > 0 && (
        <div className="mt-2 mb-2 flex flex-col gap-1.5">
          {statements.map((stmt, i) => (
            <div
              key={i}
              className={stmtCls}
              dangerouslySetInnerHTML={{ __html: stmt }}
            />
          ))}
        </div>
      )}

      {/* Closing question line ("Which of the above…") */}
      {suffixHtml && (
        <div
          className={questionClassName}
          dangerouslySetInnerHTML={{ __html: suffixHtml }}
        />
      )}

      {showOptions && shouldShowMcqOptions(q) && q.options?.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {q.options.map((option, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold leading-snug text-slate-700"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">
                {String.fromCharCode(65 + index)}
              </span>
              <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(inlineMd(option)) }} />
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default McqQuestionDisplay;
