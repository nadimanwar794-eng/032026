import type { MCQItem } from '../types';

export type McqQuestionNumber = string;

export interface TrackedMcq {
  question: string;
  questionNumber?: McqQuestionNumber;
  statements: string[];
  allOptions: string[];
  correctAnswer: number;
  correctOption: string;
  explanation: string;
}

const QUESTION_NUMBER_RE = /^\s*(?:Q(?:uestion)?|प्रश्न)\s*([0-9]+)\s*[:.)-]?\s*/i;
const STATEMENT_LINE_RE =
  /^\s*(?:(?:Statement|कथन|Assertion|Reason)\s*(?:[0-9]+|[IVX]+)?\s*[:.)-]\s*|[0-9]+[.)]\s+|[IVX]+[.)]\s+).+/i;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getStatementLabel(statement: string, index: number): string {
  const match = statement.trim().match(
    /^(?:(?:Statement|कथन|Assertion|Reason)\s*)?([0-9]+|[IVX]+)[.):\-]?\s+/i,
  );
  return match ? `${match[1]}.` : `${index + 1}.`;
}

export function getStatementText(statement: string): string {
  return statement.trim().replace(
    /^(?:(?:Statement|कथन|Assertion|Reason)\s*)?(?:[0-9]+|[IVX]+)[.):\-]?\s+/i,
    '',
  );
}

export function getMcqQuestionNumber(q: Partial<MCQItem> | null | undefined, fallback?: number): McqQuestionNumber | undefined {
  const explicit = (q as any)?.questionNumber ?? (q as any)?.number;
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) {
    return String(explicit).trim().replace(/^Q(?:uestion)?\s*/i, '');
  }

  const question = asText(q?.question);
  const match = question.match(QUESTION_NUMBER_RE);
  if (match) return match[1];
  return fallback !== undefined ? String(fallback + 1) : undefined;
}

export function getMcqStatements(q: Partial<MCQItem> | null | undefined): string[] {
  if (Array.isArray(q?.statements) && q.statements.some(Boolean)) {
    return q.statements.map(asText).filter(Boolean);
  }

  const raw = asText(q?.question).replace(/<br\s*\/?>/gi, '\n');
  const statements: string[] = [];
  let collecting = false;
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (STATEMENT_LINE_RE.test(line)) {
      collecting = true;
      statements.push(line);
    } else if (collecting) {
      break;
    }
  }
  return statements;
}

function removeAutoExtractedStatements(question: string): string {
  const lines = question.replace(/<br\s*\/?>/gi, '\n').split('\n');
  const result: string[] = [];
  let inStatementBlock = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (STATEMENT_LINE_RE.test(line)) {
      inStatementBlock = true;
      continue;
    }
    result.push(line);
    if (inStatementBlock) inStatementBlock = false;
  }
  return result.join('<br/>');
}

export function getMcqOptions(q: Partial<MCQItem> | null | undefined): string[] {
  const options = Array.isArray(q?.options) ? q.options.slice(0, 4).map(asText) : [];
  return [...options, '', '', '', ''].slice(0, 4);
}

export function normalizeMcqForTracking(q: Partial<MCQItem>, fallbackIndex?: number): TrackedMcq {
  const allOptions = getMcqOptions(q);
  const hasExplicitStatements = Array.isArray(q.statements) && q.statements.some(Boolean);
  const parsedAnswer = Number(q.correctAnswer);
  const correctAnswer = Number.isInteger(parsedAnswer) && parsedAnswer >= 0 && parsedAnswer < 4
    ? parsedAnswer
    : 0;

  return {
    question: hasExplicitStatements
      ? asText(q.question)
      : removeAutoExtractedStatements(asText(q.question)),
    questionNumber: getMcqQuestionNumber(q, fallbackIndex),
    statements: getMcqStatements(q),
    allOptions,
    correctAnswer,
    correctOption: allOptions[correctAnswer] || '',
    explanation: asText(q.explanation),
  };
}

export function normalizeMcqForStorage(q: Partial<MCQItem>, fallbackIndex = 0) {
  const tracked = normalizeMcqForTracking(q, fallbackIndex);
  return {
    question: tracked.question,
    questionNumber: tracked.questionNumber,
    statements: tracked.statements.length ? tracked.statements : undefined,
    options: tracked.allOptions,
    correctAnswer: tracked.correctAnswer,
    explanation: tracked.explanation || undefined,
  };
}

export function getTrackedQuestionKey(q: Pick<TrackedMcq, 'question' | 'questionNumber'>): string {
  return q.questionNumber ? `Q${q.questionNumber}` : q.question.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
