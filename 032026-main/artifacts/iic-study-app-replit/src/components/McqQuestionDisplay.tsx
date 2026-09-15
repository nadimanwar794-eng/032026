/**
 * McqQuestionDisplay
 * Renders an MCQ question with:
 *  - Inline markdown (** bold **, * italic *)
 *  - Math/formula rendering (KaTeX)
 *  - Question stem + numbered statements + suffix
 *  - Optional options list (radio circles)
 */

import React from 'react';
import { MCQItem } from '../types';
import { inlineMd, parseMcqQuestion, shouldShowMcqOptions } from '../utils/mcqRender';
import { getMcqOptions } from '../utils/mcqStructure';
import { renderMathInHtml } from '../utils/mathUtils';

interface Props {
  q: MCQItem;
  /** Show the stable exam number when the item carries one. */
  showQuestionNumber?: boolean;
  /** Extra class applied to the question stem and suffix */
  questionClassName?: string;
  /** Optional custom class for each numbered statement */
  stmtClassName?: string;
  /** Visual variant: 'default' (light) | 'dark' (projector) */
  variant?: 'default' | 'dark';
  /** In Q&A/Flashcard contexts, show options only for qualifying questions. */
  showOptions?: boolean;
}

const McqQuestionDisplay: React.FC<Props> = ({
  q,
  showQuestionNumber = false,
  questionClassName = '',
  variant: _variant,
  stmtClassName,
  showOptions = false,
}) => {
  const { questionHtml, statements, suffixHtml } = parseMcqQuestion(q);
  const statementClassName = stmtClassName ||
    `${questionClassName} bg-sky-50 border-l-4 border-sky-300 rounded-xl px-3 py-2 mb-1`;

  return (
    <>
      {showQuestionNumber && q.questionNumber !== undefined && (
        <div className={`${questionClassName} mb-1 font-black`}>
          Q{q.questionNumber}.
        </div>
      )}
      {/* Question stem */}
      {questionHtml && (
        <div
          className={questionClassName}
          dangerouslySetInnerHTML={{ __html: questionHtml }}
        />
      )}

      {/* Numbered statements — subtle highlight separates them from the stem */}
      {statements.map((s, i) => (
        <div
          key={i}
          className={statementClassName}
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
          {getMcqOptions(q).map((option, index) => (
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
