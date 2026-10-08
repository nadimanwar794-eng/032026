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
import { resolveTelegramUrl } from '../services/telegramStorageService';

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

  const isAbove = q.imagePosition === 'above_question';
  const isAfterOptions = q.imagePosition === 'after_options';
  const isBelow = !isAbove && !isAfterOptions; // default: below question

  const imageElement = q.imageUrl ? (
    <div
      className={`my-2.5 flex ${
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
  ) : null;

  return (
    <>
      {showQuestionNumber && q.questionNumber !== undefined && (
        <div className={`${questionClassName} mb-1 font-black`}>
          Q{q.questionNumber}.
        </div>
      )}

      {/* Attached Question Diagram: Above Question Stem */}
      {isAbove && imageElement}

      {/* Question stem */}
      {questionHtml && (
        <div
          className={questionClassName}
          dangerouslySetInnerHTML={{ __html: questionHtml }}
        />
      )}

      {/* Attached Question Diagram: Below Question Stem (Default) */}
      {isBelow && imageElement}

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
