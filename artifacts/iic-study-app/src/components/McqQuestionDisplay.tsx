/**
 * McqQuestionDisplay
 * Renders an MCQ question with:
 *  - Inline markdown (** bold **, * italic *)
 *  - Math/formula rendering (KaTeX)
 *  - Question stem + numbered statements + suffix — all same styling, no boxes
 *  - Optional options list (radio circles)
 */

import React from 'react';
import { MCQItem } from '../types';
import { inlineMd, parseMcqQuestion, shouldShowMcqOptions } from '../utils/mcqRender';
import { renderMathInHtml } from '../utils/mathUtils';

interface Props {
  q: MCQItem;
  /** Extra class applied to every text line (stem, statements, suffix) */
  questionClassName?: string;
  /** Unused — kept for API compatibility */
  stmtClassName?: string;
  /** Visual variant: 'default' (light) | 'dark' (projector) */
  variant?: 'default' | 'dark';
  /** In Q&A/Flashcard contexts, show options only for qualifying questions. */
  showOptions?: boolean;
}

const McqQuestionDisplay: React.FC<Props> = ({
  q,
  questionClassName = '',
  variant: _variant,
  showOptions = false,
}) => {
  const { questionHtml, statements, suffixHtml } = parseMcqQuestion(q);

  return (
    <>
      {/* Question stem */}
      {questionHtml && (
        <div
          className={questionClassName}
          dangerouslySetInnerHTML={{ __html: questionHtml }}
        />
      )}

      {/* Numbered statements — same className as stem, no box/border */}
      {statements.map((s, i) => (
        <div
          key={i}
          className={questionClassName}
          dangerouslySetInnerHTML={{ __html: s }}
        />
      ))}

      {/* Closing suffix ("Which of the above…") */}
      {suffixHtml && (
        <div
          className={questionClassName}
          dangerouslySetInnerHTML={{ __html: suffixHtml }}
        />
      )}

      {showOptions && shouldShowMcqOptions(q) && q.options?.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {q.options.map((option, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-snug text-slate-800"
            >
              <span className="flex h-5 w-5 shrink-0 rounded-full border-2 border-slate-400" />
              <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(inlineMd(option)) }} />
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default McqQuestionDisplay;
