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

/** A line is a numbered statement: "1. text", "2) text", "Statement 1: text", "कथन I", "कथन 1", "I. text" */
const STMT_LINE_RE = /^(?:\d+[.)]\s+|(?:Statement|कथन|Assertion|Reason)\s*(?:[0-9IVXivx]+)?\s*[:.\-)]\s*|[IVX]+[.)]\s+).+/i;

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
 *  1. If `q.statements` is already populated → use it (just apply markdown + math)
 *  2. Otherwise scan `q.question` line-by-line and auto-extract numbered items
 */
// Only references to content that has already been shown signal a closing line.
// "निम्नलिखित..." introduces the statements and must stay BEFORE them.
const SUFFIX_TRIGGER_RE = /(?:which\s+of\s+the\s+(?:above|following)|which\s+of\s+the\s+above|above\s+(?:statements?|are)|(?:उपर्युक्त|उपरोक्त)(?:\s+कथनों?)?)/i;

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
  // ── Case 1: statements already in data ──────────────────────────────────
  // q.question may hold:
  //   (a) "intro text"
  //   (b) "intro text\n\nउपर्युक्त में से…?"
  //   (c) "उपर्युक्त में से…?"  (no intro — happens when question starts with statements)
  //   (d) "निम्नलिखित…: उपरोक्त…?" — single line with both intro AND suffix
  // We split it so the closing question lands in suffixHtml (shown AFTER statement boxes),
  // not in questionHtml (shown BEFORE them).
  if (q.statements && q.statements.length > 0) {
    const rawQ  = q.question.replace(/<br\s*\/?>/gi, '\n');
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
      statements:   q.statements.map(renderLine),
      suffixHtml:   suffLines.length  ? renderLine(suffLines.join('<br/>'))  : '',
    };
  }

  // ── Case 2: auto-extract from question text ──────────────────────────────
  // Normalise: convert <br/> HTML breaks to \n, then split
  const rawText = q.question.replace(/<br\s*\/?>/gi, '\n');
  const lines   = rawText.split('\n').map(l => l.trim()).filter(Boolean);

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
        // Next numbered item
        stmtLines.push(line);
      } else {
        // Non-numbered line after statements = closing question or extra context
        phase = 'suffix';
        suffixLines.push(line);
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
