import katex from 'katex';

// ─────────────────────────────────────────────────────────────────────────────
// Plain-text node processor
// Applies transformations ONLY to text content between HTML tags (not inside
// attributes, tag names, or already-rendered KaTeX spans).
// ─────────────────────────────────────────────────────────────────────────────
const processTextNodes = (html: string, fn: (text: string) => string): string =>
  html.replace(/(^|>)([^<]*)(<|$)/g, (_, before, text, after) =>
    before + fn(text) + after
  );

// ─────────────────────────────────────────────────────────────────────────────
// Superscript conversion  (outside LaTeX blocks)
// Patterns:
//   x^2        →  x<sup>2</sup>
//   x^{23}     →  x<sup>23</sup>
//   10^-3      →  10<sup>-3</sup>
//   a^n        →  a<sup>n</sup>   (single letter exponent)
// ─────────────────────────────────────────────────────────────────────────────
const applySuperscripts = (text: string): string =>
  text
    // x^{...} — braced exponent (plain text variant)
    .replace(/([A-Za-z0-9])\^\{([^}]+)\}/g, '$1<sup>$2</sup>')
    // x^-3 or x^+3 — signed numeric exponent
    .replace(/([A-Za-z0-9])\^([+-]?\d+)/g, '$1<sup>$2</sup>')
    // x^n — single letter/word exponent
    .replace(/([A-Za-z0-9])\^([A-Za-z])\b/g, '$1<sup>$2</sup>');

// ─────────────────────────────────────────────────────────────────────────────
// Chemical / scientific subscript conversion
// Pattern: element symbol(s) followed immediately by digits
//   H2O   →  H<sub>2</sub>O
//   CO2   →  CO<sub>2</sub>
//   C6H12O6  →  C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>
//   H2SO4    →  H<sub>2</sub>SO<sub>4</sub>
//
// Also handles underscore-subscript notation common in mixed notes:
//   x_1   →  x<sub>1</sub>
//   A_0   →  A<sub>0</sub>
// ─────────────────────────────────────────────────────────────────────────────
const applySubscripts = (text: string): string =>
  text
    // Underscore subscript notation: x_1, A_0, V_max
    .replace(/([A-Za-z0-9])_(\{[^}]+\}|[A-Za-z0-9]+)/g, (_, base, sub) =>
      `${base}<sub>${sub.replace(/^\{|\}$/g, '')}</sub>`
    )
    // Chemical-formula subscripts: uppercase element symbol followed by digits
    // Only when surrounded by word boundary or element letters (avoids normal words)
    .replace(/\b([A-Z][a-z]?)(\d+)/g, (match, elem, num) => {
      // Only convert if it looks like a chemical context:
      // the character before must be start-of-word, letter, or digit (not inside a regular word like "B2B")
      return `${elem}<sub>${num}</sub>`;
    });

// ─────────────────────────────────────────────────────────────────────────────
// LaTeX command symbols — convert common bare \cmd patterns to Unicode.
// These run on plain-text nodes (not inside KaTeX HTML) so un-delimited LaTeX
// like "8^\circ 4'" in notes becomes "8° 4'" without needing $…$ wrappers.
// ─────────────────────────────────────────────────────────────────────────────
const LATEX_SYMBOL_MAP: [RegExp, string][] = [
  [/\^\{?\\circ\}?/g,        '°'],   // ^\circ  or  ^{\circ}  → °
  [/\\circ\b/g,               '°'],   // standalone \circ → °
  [/\\times\b/g,              '×'],
  [/\\div\b/g,                '÷'],
  [/\\pm\b/g,                 '±'],
  [/\\mp\b/g,                 '∓'],
  [/\\approx\b/g,             '≈'],
  [/\\infty\b/g,              '∞'],
  [/\\leq?\b/g,               '≤'],
  [/\\geq?\b/g,               '≥'],
  [/\\neq\b/g,                '≠'],
  [/\\cdot\b/g,               '·'],
  [/\\ldots\b/g,              '…'],
  [/\\alpha\b/g,              'α'],
  [/\\beta\b/g,               'β'],
  [/\\gamma\b/g,              'γ'],
  [/\\delta\b/g,              'δ'],
  [/\\epsilon\b/g,            'ε'],
  [/\\theta\b/g,              'θ'],
  [/\\lambda\b/g,             'λ'],
  [/\\mu\b/g,                 'μ'],
  [/\\nu\b/g,                 'ν'],
  [/\\pi\b/g,                 'π'],
  [/\\rho\b/g,                'ρ'],
  [/\\sigma\b/g,              'σ'],
  [/\\tau\b/g,                'τ'],
  [/\\phi\b/g,                'φ'],
  [/\\omega\b/g,              'ω'],
  [/\\Delta\b/g,              'Δ'],
  [/\\Sigma\b/g,              'Σ'],
  [/\\Omega\b/g,              'Ω'],
  [/\\sqrt\{([^}]+)\}/g,      '√($1)'],  // \sqrt{x} → √(x)
  // Arrow symbols (common in chemistry equations and notes)
  [/\\rightarrow\b/g,         '→'],
  [/\\leftarrow\b/g,          '←'],
  [/\\to\b/g,                 '→'],   // \to is alias for \rightarrow
  [/\\Rightarrow\b/g,         '⇒'],
  [/\\Leftarrow\b/g,          '⇐'],
  [/\\leftrightarrow\b/g,     '↔'],
  [/\\Leftrightarrow\b/g,     '⟺'],
  [/\\uparrow\b/g,            '↑'],
  [/\\downarrow\b/g,          '↓'],
];

const applyLatexSymbols = (text: string): string => {
  let out = text;
  for (const [pattern, replacement] of LATEX_SYMBOL_MAP) {
    out = out.replace(pattern, replacement as string);
  }
  return out;
};

// ─────────────────────────────────────────────────────────────────────────────
// Degree symbol normalisation  (30* → 30°, 90 degrees → 90°)
// ─────────────────────────────────────────────────────────────────────────────
const applyDegrees = (text: string): string =>
  text
    .replace(/(\d)\s*degrees?\b/gi, '$1°')
    .replace(/(\d)\*(?=\s|$)/g, '$1°');

// ─────────────────────────────────────────────────────────────────────────────
// Arrow notation  (->  →  →,  <-  →  ←,  <=>  →  ⇌)
// Useful for chemistry reactions and logic in notes
// ─────────────────────────────────────────────────────────────────────────────
const applyArrows = (text: string): string =>
  text
    // HTML-escaped variants (produced by renderMathInText or pre-escaped HTML)
    .replace(/&lt;=&gt;/g,  '⇌')   // <=>
    .replace(/--&gt;/g,     '→')   // -->
    .replace(/&lt;--/g,     '←')   // <--
    .replace(/\b-&gt;\b/g,  '→')   // ->
    .replace(/\b&lt;-\b/g,  '←')   // <-
    // Literal variants (text nodes in raw HTML where < > appear unescaped)
    .replace(/<==>/g,        '⇌')   // <==>
    .replace(/<==>/g,        '⇌')
    .replace(/<=>/g,         '⇌')   // <=>  (must come BEFORE <- to avoid partial match)
    .replace(/-->/g,         '→')   // -->
    .replace(/<--/g,         '←')   // <--
    .replace(/\B->\B/g,      '→')   // ->  (not at word boundary to avoid breaking other tokens)
    .replace(/(?<!\S)->/g,   '→')   // -> after whitespace
    .replace(/->(?!\S)/g,    '→');  // -> before whitespace

// ─────────────────────────────────────────────────────────────────────────────
// Main export — renders ALL supported math/science notations in an HTML string.
//
// Processing order (each step feeds the next):
//   1.  $$...$$              Display LaTeX block
//   2.  \[...\]              Display LaTeX block (alternate)
//   3.  \(...\)              Inline LaTeX
//   4.  $...$                Inline LaTeX
//   5.  x^2  x^{n}          Plain-text superscripts  (text nodes only)
//   6.  H2O  x_1            Chemical/sci subscripts   (text nodes only)
//   7.  30*  / degrees       Degree symbol             (text nodes only)
//   8.  ->  <=>             Arrow symbols             (text nodes only)
// ─────────────────────────────────────────────────────────────────────────────
export const renderMathInHtml = (html: string): string => {
  if (!html) return '';

  // ── 1. $$...$$ → display block ──────────────────────────────────────────
  let out = html.replace(/\$\$([^$]+?)\$\$/gs, (match, tex) => {
    try { return katex.renderToString(tex.trim(), { displayMode: true,  throwOnError: false, strict: false }); }
    catch { return match; }
  });

  // ── 2. \[...\] → display block ──────────────────────────────────────────
  out = out.replace(/\\\[([^[\]]*?)\\\]/gs, (match, tex) => {
    try { return katex.renderToString(tex.trim(), { displayMode: true,  throwOnError: false, strict: false }); }
    catch { return match; }
  });

  // ── 3. \(...\) → inline ─────────────────────────────────────────────────
  out = out.replace(/\\\(([^()]*?)\\\)/g, (match, tex) => {
    try { return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false, strict: false }); }
    catch { return match; }
  });

  // ── 4. $...$ → inline ───────────────────────────────────────────────────
  out = out.replace(/\$([^$\n]+?)\$/g, (match, tex) => {
    try { return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false, strict: false }); }
    catch { return match; }
  });

    // ── 5. Bare LaTeX macros with braces (outside $..$ delimiters) ────────
  // These appear in notes/content without dollar-sign wrapping, e.g.
  // "4Na + O2 \rightarrow \mathbf{2Na2O}"
  out = out.replace(/\\mathbf\{([^}]*)\}/g, '<strong>$1</strong>');
  out = out.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  out = out.replace(/\\emph\{([^}]*)\}/g,   '<em>$1</em>');
  out = out.replace(/\\textit\{([^}]*)\}/g,  '<em>$1</em>');
  out = out.replace(/\\mathrm\{([^}]*)\}/g,  '$1');
  out = out.replace(/\\text\{([^}]*)\}/g,    '$1');
  out = out.replace(/\\overline\{([^}]*)\}/g,'$1\u0305');  // combining overline
  out = out.replace(/\\underline\{([^}]*)\}/g,'<u>$1</u>');

  // ── 6-10. Plain-text patterns (text nodes only, won't touch KaTeX HTML) ──
  out = processTextNodes(out, text => {
    text = applyLatexSymbols(text);  // ^\circ → °, \times → ×, \rightarrow → →, etc.
    text = applySuperscripts(text);
    text = applySubscripts(text);
    text = applyDegrees(text);
    text = applyArrows(text);
    return text;
  });

  return out;
};

/**
 * Format an explanation string for display.
 * Explanations are stored as "• A) … • B) … • C) … ---"
 * This splits on bullet markers and renders each point as its own <p> block
 * so they stack vertically instead of running together as a paragraph.
 */
export const formatExplanationHtml = (raw: string): string => {
  if (!raw) return '';
  // Strip trailing separator "---" (with optional surrounding spaces/newlines)
  const cleaned = raw.replace(/\s*---\s*$/, '').trim();
  // Split on " • " in the middle, and strip a leading "• " if present
  const parts = cleaned.split(/\s*•\s+/).filter(Boolean);
  if (parts.length <= 1) {
    // No bullet structure — just render as-is
    return renderMathInHtml(cleaned);
  }
  return parts
    .map(p => `<p style="margin:0 0 0.5em 0;">${renderMathInHtml(p.trim())}</p>`)
    .join('');
};

/**
 * Render math in plain text (not HTML). HTML-escapes the input first, then
 * applies the full math pipeline. Returns an HTML string safe for
 * dangerouslySetInnerHTML.
 */
export const renderMathInText = (text: string): string => {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return renderMathInHtml(escaped);
};
