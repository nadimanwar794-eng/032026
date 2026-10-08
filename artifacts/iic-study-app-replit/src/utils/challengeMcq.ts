import type { MCQItem } from '../types';
import { normalizeMcqForTracking } from './mcqStructure';

const stripOptionLabel = (value: string): string =>
  value.trim().replace(/^(?:[A-Da-d]|[1-4])\s*[\).:-]\s*/, '').replace(/\s+/g, ' ').trim();

const isMatchQuestion = (question: string): boolean =>
  /match\s+(?:the\s+)?(?:following\s+)?(?:pairs|columns)|मिलान|सुमेलित|सुमेलित\s*कीजिए|कूट/i.test(question);

/**
 * Challenge 2.0 accepts the same structured MCQ data as Class 6–12:
 * question number, stem, optional numbered statements, four options,
 * correct answer, and explanation.
 *
 * Matching questions are still excluded because their options are not a
 * standard four-option MCQ. Statement-based MCQs are valid and must retain
 * their structured statement data through publishing and playback.
 */
export function sanitizeChallengeQuestion(q: Partial<MCQItem>): MCQItem | null {
  const question = typeof q.question === 'string' ? q.question.trim() : '';
  const rawOptions = Array.isArray(q.options) ? q.options : [];
  const options = rawOptions
    .slice(0, 4)
    .map((option) => typeof option === 'string' ? stripOptionLabel(option) : '');
  const correctAnswer = Number(q.correctAnswer);

  if (!question || rawOptions.length !== 4) return null;
  if (isMatchQuestion(question)) return null;
  if (options.some((option) => !option)) {
    return null;
  }
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) return null;

  // Use the same normalization used by Class 6–12 tracking/revision flows.
  // This extracts legacy inline statement blocks when `q.statements` is
  // missing, while preserving an explicitly parsed statement array.
  const tracked = normalizeMcqForTracking({
    ...q,
    question,
    options,
    correctAnswer,
  });

  return {
    ...q,
    question: tracked.question,
    questionNumber: tracked.questionNumber,
    options,
    correctAnswer,
    explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
    statements: tracked.statements.length > 0 ? tracked.statements : undefined,
  } as MCQItem;
}

export function sanitizeChallengeQuestions(questions: unknown): MCQItem[] {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((question) => sanitizeChallengeQuestion((question || {}) as Partial<MCQItem>))
    .filter((question): question is MCQItem => question !== null);
}

export function getChallengeQuestionSummary(questions: unknown): {
  accepted: number;
  rejected: number;
} {
  const total = Array.isArray(questions) ? questions.length : 0;
  const accepted = sanitizeChallengeQuestions(questions).length;
  return { accepted, rejected: Math.max(0, total - accepted) };
}