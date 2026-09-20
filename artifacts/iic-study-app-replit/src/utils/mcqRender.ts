/**
 * mcqRender.ts
 * Shared utilities for rendering MCQ questions with:
 *  - Inline markdown  (**bold**, *italic*, `code`)
 *  - Math/formula rendering (via renderMathInHtml)
 *  - Auto-extraction of numbered statements from question text
 *    when q.statements[] is not populated in the database
 */

import { MCQItem } from '../types';
import { renderMathInHtml } from './mathUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Inline Markdown → HTML
// Protects math expressions from being mangled.
// Handles: ***bold+italic***, **bold**, *italic*, `code`
// ─────────────────────────────────────────────────────────────────────────────
export const inlineMd = (s: string): string => {
  if (!s) return '';
  const saved: string[] = [];
  // Protect math blocks first
  let r = s.replace(
    /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$/g,
    m => { saved.push(m); return `\x00M${saved.length - 1}\x00`; }
  );
  r = r
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![*])\*(?![*\s])([^*\n]+?)(?<!\s)\*(?![*])/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // Restore math
  return r.replace(/\x00M(\d+)\x00/g, (_, i) => saved[+i]);
};

// ─────────────────────────────────────────────────────────────────────────────
// Statement detection helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A line is a numbered statement: "1. text", "(1) text", "1) text", "Statement 1: text", "कथन I", "कथन 1", "कथन (1)", "I. text", "(i) text", "Assertion/Reason/अभिकथन/कारण" */
const STMT_LINE_RE = /^(?:(?:\(?\d+[\).\:\-\s]\s*|\(?[IVXivx]+[\).\:\-\s]\s*|\(?[a-dA-D]\)[\s\:\.]*|(?:Statement|कथन|Assertion|Reason|अभिकथन|कारण)\s*(?:\(?\s*[0-9IVXivxABab]+\s*\)?)?\s*[:.\-)]?\s*)).+/i;

// ─────────────────────────────────────────────────────────────────────────────
// Parsed MCQ result
// ─────────────────────────────────────────────────────────────────────────────
export interface ParsedMcq {
  /** Rendered HTML for the question stem (before statements) */
  questionHtml: string;
  /** Rendered HTML strings for each statement */
  statements: string[];
  /** Rendered HTML for closing line after statements ("Which of above…") */
  suffixHtml: string;
}

/**
 * Helper to get explicit statements array from an MCQItem whether stored
 * as statements (array or multiline string) or statement (singular string/array).
 */
export const getRawStatementsArray = (q: any): string[] | null => {
  if (!q) return null;
  const rawStmts = q.statements ?? q.statement ?? q.statementsList;
  if (Array.isArray(rawStmts) && rawStmts.length > 0) {
    return rawStmts.map((s: any) => String(s || '').trim()).filter(Boolean);
  }
  if (typeof rawStmts === 'string' && rawStmts.trim()) {
    const lines = rawStmts.replace(/<br\s*\/?>/gi, '\n').split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (lines.length > 0) return lines;
  }
  return null;
};

/**
 * Q&A/Flashcard display rule:
 * options are useful only for "निम्नलिखित/following" questions and
 * statement-based questions. Normal MCQs keep their options hidden in
 * these study/reveal modes.
 */
export const shouldShowMcqOptions = (q: MCQItem): boolean => {
  const parsed = parseMcqQuestion(q);
  const rawQuestion = (q.question || '').replace(/<[^>]+>/g, ' ');
  return parsed.statements.length > 0 || /निम्नलिखित|following/i.test(rawQuestion);
};

const renderLine = (text: string) => renderMathInHtml(inlineMd(text));

/**
 * Parse an MCQItem into display-ready HTML parts.
 *
 * Priority:
 *  1. If `q.statements` (or `q.statement`) is populated → use it (apply markdown + math)
 *  2. Otherwise scan `q.question` line-by-line and auto-extract numbered statement items
 */
// Only references to content that has already been shown signal a closing line.
// "निम्नलिखित..." introduces the statements and must stay BEFORE them.
const SUFFIX_TRIGGER_RE = /(?:which\s+of\s+the\s+(?:above|following)|which\s+of\s+the\s+above|above\s+(?:statements?|are)|(?:उपर्युक्त|उपरोक्त)(?:\s+कथनों?)?|कूट\b|कूट\s+का|सही\s+विकल्प|select\s+the\s+correct|choose\s+the\s+correct)/i;

// "निम्नलिखित..." / "following statements" = intro line → must stay BEFORE statements.
const INTRO_TRIGGER_RE = /निम्नलिखित|following\s+(?:statement|कथन)/i;

/**
 * If a single line contains BOTH an intro trigger ("निम्नलिखित") AND a suffix
 * trigger ("उपरोक्त / which of the above"), split it so the intro part goes
 * before the statement block and the suffix part goes after.
 * Returns null when no split is needed.
 */
const splitIntroAndSuffix = (line: string): { intro: string; suffix: string } | null => {
  if (!INTRO_TRIGGER_RE.test(line)) return null;
  const m = SUFFIX_TRIGGER_RE.exec(line);
  if (!m || m.index === 0) return null;
  return { intro: line.slice(0, m.index).trim(), suffix: line.slice(m.index).trim() };
};

export const parseMcqQuestion = (q: MCQItem): ParsedMcq => {
  const explicitStmts = getRawStatementsArray(q);
  // ── Case 1: statements already in data ──────────────────────────────────
  if (explicitStmts && explicitStmts.length > 0) {
    const rawQ  = (q.question || '').replace(/<br\s*\/?>/gi, '\n');
    const qLines = rawQ.split('\n').map(l => l.trim()).filter(Boolean);

    const introLines: string[] = [];
    const suffLines:  string[] = [];
    let inSuffix = false;

    for (const line of qLines) {
      if (!inSuffix) {
        // Check if this single line contains both "निम्नलिखित" (intro) and "उपरोक्त" (suffix)
        const split = splitIntroAndSuffix(line);
        if (split) {
          // Split: intro part → before statements, suffix part → after statements
          if (split.intro) introLines.push(split.intro);
          if (split.suffix) suffLines.push(split.suffix);
          inSuffix = true;
        } else if (SUFFIX_TRIGGER_RE.test(line)) {
          inSuffix = true;
          suffLines.push(line);
        } else {
          introLines.push(line);
        }
      } else {
        suffLines.push(line);
      }
    }

    return {
      questionHtml: introLines.length ? renderLine(introLines.join('<br/>')) : '',
      statements:   explicitStmts.map(renderLine),
      suffixHtml:   suffLines.length  ? renderLine(suffLines.join('<br/>'))  : '',
    };
  }

  // ── Case 2: auto-extract from question text ──────────────────────────────
  // Normalise: convert <br/> HTML breaks to \n
  let rawText = (q.question || '').replace(/<br\s*\/?>/gi, '\n');

  // If there are no line breaks but statements are embedded horizontally (e.g. "कथन 1: ... कथन 2: ...")
  // insert clean linebreaks before statement and suffix triggers
  if (!rawText.includes('\n')) {
    rawText = rawText
      .replace(/(?<=[^\n])\s*(?=(?:(?:कथन|Statement)\s*(?:\(?\s*[0-9IVXivxABab]+\s*\)?)?\s*[:.\-)]|\(?\d+[\).\:\-]\s*|\(?[IVXivx]+[\).\:\-]\s*))/gi, '\n')
      .replace(/(?<=[^\n])\s*(?=(?:उपर्युक्त|उपरोक्त|निम्नलिखित\s+में\s+से|कूट\b|which\s+of\s+the\s+above))/gi, '\n');
  }

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  const preLines:    string[] = [];
  const stmtLines:   string[] = [];
  const suffixLines: string[] = [];

  // Walk lines in 3 phases: pre-statement → statement block → suffix
  let phase: 'pre' | 'stmts' | 'suffix' = 'pre';

  for (const line of lines) {
    if (phase === 'pre') {
      if (STMT_LINE_RE.test(line)) {
        phase = 'stmts';
        stmtLines.push(line);
      } else {
        preLines.push(line);
      }
    } else if (phase === 'stmts') {
      if (STMT_LINE_RE.test(line)) {
        // Next numbered statement item
        stmtLines.push(line);
      } else if (SUFFIX_TRIGGER_RE.test(line) || /^(?:कूट\b|कूट\s+का|सही\s+विकल्प|select|choose|find|\?)/i.test(line)) {
        // Reached suffix trigger line
        phase = 'suffix';
        suffixLines.push(line);
      } else {
        // Line continuation of the previous statement (multi-line statement)
        if (stmtLines.length > 0) {
          stmtLines[stmtLines.length - 1] += ' ' + line;
        } else {
          preLines.push(line);
        }
      }
    } else {
      suffixLines.push(line);
    }
  }

  // If nothing was extracted as statements, treat whole text as question
  if (stmtLines.length === 0) {
    return {
      questionHtml: renderLine(rawText.replace(/\n/g, '<br/>')),
      statements:   [],
      suffixHtml:   '',
    };
  }

  const joinRender = (ls: string[]) => renderLine(ls.join('<br/>'));

  return {
    questionHtml: joinRender(preLines),
    statements:   stmtLines.map(renderLine),
    suffixHtml:   joinRender(suffixLines),
  };
};
