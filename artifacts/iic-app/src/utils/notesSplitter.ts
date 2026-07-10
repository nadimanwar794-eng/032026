import { stripHtml } from './textToSpeech';

export interface NotesTopic {
  text: string;
  isHeading: boolean;
}

export interface NoteSections {
  bookText: string;
  smartNotes: string;
  explanation: string;
}

/**
 * Detects "Suno chunk notes" style input that repeats, per topic, three
 * labelled sections: 📖 Book Text, 📝 Smart Notes, 💡 आसान समझ (Explanation) —
 * optionally grouped under a 📌 topic heading. When all three markers are
 * present, this pulls every occurrence of each section out (across the whole
 * input, however many topics it contains) and stitches them into three
 * separate blobs — one per section type — so the reader can show them as
 * three independent pages instead of one mixed list.
 *
 * Returns null when the input doesn't look like this 3-section format (so
 * callers can fall back to treating the whole content as a single page).
 */
// Require the actual labels (not just a stray emoji somewhere) before we
// treat a note as "Suno 3-section" format, so ordinary single-section notes
// that merely happen to contain 📖/📝/💡 characters are left untouched.
const BOOK_LABEL_RE = /📖\s*Book\s*Text\s*:/i;
const SMART_LABEL_RE = /📝\s*Smart\s*Notes?\s*:/i;
const EXPLAIN_LABEL_RE = /💡\s*(?:आसान\s*समझ)?\s*(?:[\/(]?\s*Explanation\s*[\/)]?)?\s*:/i;

// Global variants of the same labels, used to find every occurrence and where
// its label text ends (so the body segment can start right after the label
// without a separate strip pass). Anchoring on the full label — not just the
// bare emoji — means a 📖/📝/💡 that shows up inside normal body text (e.g. as
// decoration on an unrelated line) is never mistaken for a section boundary.
const BOOK_LABEL_G = /📖\s*Book\s*Text\s*:\s*/gi;
const SMART_LABEL_G = /📝\s*Smart\s*Notes?\s*:\s*/gi;
const EXPLAIN_LABEL_G = /💡\s*(?:आसान\s*समझ)?\s*(?:[\/(]?\s*Explanation\s*[\/)]?)?\s*:\s*/gi;
// Heading lines: "📌 <heading text>" up to the end of that line.
const HEADING_LABEL_G = /📌\s*([^\n]*)/g;

export function splitNoteSections(raw: string): NoteSections | null {
  if (!raw) return null;
  if (!BOOK_LABEL_RE.test(raw) || !SMART_LABEL_RE.test(raw) || !EXPLAIN_LABEL_RE.test(raw)) return null;

  // Collect every labelled marker in document order (not a per-block search,
  // which only ever found the FIRST 📖/📝/💡 inside a block and silently
  // dropped every repeat after it). Each entry records where its label ends
  // (`bodyStart`) so the section body can be sliced without a second pass.
  type Marker = { type: 'heading' | 'book' | 'smart' | 'explain'; start: number; bodyStart: number; headingText?: string };
  const markers: Marker[] = [];
  let m: RegExpExecArray | null;

  HEADING_LABEL_G.lastIndex = 0;
  while ((m = HEADING_LABEL_G.exec(raw)) !== null) {
    markers.push({ type: 'heading', start: m.index, bodyStart: m.index + m[0].length, headingText: (m[1] || '').trim() });
  }
  BOOK_LABEL_G.lastIndex = 0;
  while ((m = BOOK_LABEL_G.exec(raw)) !== null) {
    markers.push({ type: 'book', start: m.index, bodyStart: m.index + m[0].length });
  }
  SMART_LABEL_G.lastIndex = 0;
  while ((m = SMART_LABEL_G.exec(raw)) !== null) {
    markers.push({ type: 'smart', start: m.index, bodyStart: m.index + m[0].length });
  }
  EXPLAIN_LABEL_G.lastIndex = 0;
  while ((m = EXPLAIN_LABEL_G.exec(raw)) !== null) {
    markers.push({ type: 'explain', start: m.index, bodyStart: m.index + m[0].length });
  }
  if (markers.length === 0) return null;
  markers.sort((a, b) => a.start - b.start);

  const bookParts: string[] = [];
  const smartParts: string[] = [];
  const explainParts: string[] = [];
  let currentHeading = '';

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    if (marker.type === 'heading') {
      currentHeading = marker.headingText || '';
      continue;
    }
    const end = i + 1 < markers.length ? markers[i + 1].start : raw.length;
    const segment = raw.slice(marker.bodyStart, end).trim();
    if (!segment) continue;

    const withHeading = currentHeading ? `### ${currentHeading}\n${segment}` : segment;
    if (marker.type === 'book') bookParts.push(withHeading);
    else if (marker.type === 'smart') smartParts.push(withHeading);
    else explainParts.push(withHeading);
  }

  if (!bookParts.length && !smartParts.length && !explainParts.length) return null;

  return {
    bookText: bookParts.join('\n\n'),
    smartNotes: smartParts.join('\n\n'),
    explanation: explainParts.join('\n\n'),
  };
}

/**
 * Returns true if the string is essentially just ellipsis / dots / placeholders
 * and carries no real content — these lines come from AI truncation artifacts
 * or admin placeholder text and should be hidden from students.
 */
function isPlaceholderLine(t: string): boolean {
  const stripped = t.replace(/[.\u2026\s…\-_*]/g, '').trim();
  return stripped.length === 0;
}

/**
 * Removes trailing ellipsis / dots from a string (e.g. "topic text......" → "topic text").
 */
function stripTrailingDots(t: string): string {
  return t.replace(/[\s.…]+$/, '').trim();
}

/**
 * Splits notes content into a list of topic lines.
 * Handles markdown bullets (`*`, `-`, `•`), numbered items, headings (`###`),
 * `SET - N` style section labels, and plain HTML / text. Each non-empty line
 * becomes one topic; an indented continuation is appended to the previous topic.
 */
export const splitIntoTopics = (raw: string): NotesTopic[] => {
  if (!raw) return [];

  // Strip TTS sync markers like [span_0](start_span) / [span_0](end_span)
  let text = raw.replace(/\[span_\d+\]\((start|end)_span\)/g, '');
  let _isFromHtml = false;
  if (/[<][a-zA-Z!\/]/.test(text)) {
    _isFromHtml = true;
    text = text
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/\s*(p|div|li|h[1-6]|tr|section|article)\s*>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '\n* ')
      .replace(/<\s*h[1-6][^>]*>/gi, '\n### ');
    text = stripHtml(text);
    // For HTML-derived text, collapse regular line breaks into spaces so that
    // only sentence terminators (। and .) create new topic lines, not every <p>/<br>.
    // Lines that start heading/bullet markers are preserved as real line breaks.
    text = text
      .split('\n')
      .reduce((acc: string[], line: string, idx: number) => {
        const trimmed = line.trim();
        if (!trimmed) {
          // Empty line = paragraph separator — preserve as real break
          acc.push('');
          return acc;
        }
        const startsSpecial = /^(#{1,6}\s|[*\-•]|\d+[.)]\s)/.test(trimmed);
        if (startsSpecial || acc.length === 0) {
          acc.push(line);
        } else {
          // Append to previous line with a space (collapse HTML-induced line break)
          acc[acc.length - 1] = (acc[acc.length - 1] || '').trimEnd() + ' ' + trimmed;
        }
        return acc;
      }, [])
      .join('\n');
  }

  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  // Merge common dot-abbreviations so they don't get split mid-word
  text = text
    .replace(/ई\.पू\./g, 'ईपू')
    .replace(/ई\.स\./g, 'ईस')
    .replace(/पू\.क्र\./g, 'पूक्र');

  const rawLines = text.split(/\r?\n/);
  const topics: NotesTopic[] = [];
  let buffer = '';
  let bufferIsHeading = false;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed) topics.push({ text: trimmed, isHeading: bufferIsHeading });
    buffer = '';
    bufferIsHeading = false;
  };

  for (let line of rawLines) {
    line = line.replace(/\s+$/g, '');
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    const isMdHeading = /^#{1,6}\s+/.test(trimmed);
    const isShortBoldHeading = /^\*\*[^*]+\*\*\s*$/.test(trimmed) && trimmed.length < 80;
    // A "PART 1" / "UNIT 2" / "CHAPTER 3" prefix only counts as a STANDALONE
    // heading when the line is short and is just the label (with maybe a tiny
    // title). Earlier this matched even when the entire long content blob
    // happened to start with "PART 1:" — which made the whole library-reference
    // text turn into a single heading and skip all sentence-splitting (=> the
    // "Read More" view showed everything as one giant blob with "1 topics").
    // Now: only treat as heading when the line is short AND has no Hindi danda
    // or sentence-ending punctuation in the middle (i.e. it's truly a label).
    const isShortSectionLabel =
      /^(SET|MODEL\s*SET|UNIT|CHAPTER|PART)\s*[-–]?\s*\d+/i.test(trimmed) &&
      trimmed.length <= 80 &&
      !/[।!?]/.test(trimmed) &&
      // Allow at most one trailing period (e.g. "PART 1.")
      (trimmed.match(/\./g) || []).length <= 1;

    if (isMdHeading || isShortBoldHeading || isShortSectionLabel) {
      flush();
      const cleaned = trimmed.replace(/^#{1,6}\s+/, '').replace(/^\*\*|\*\*$/g, '').trim();
      topics.push({ text: cleaned, isHeading: true });
      continue;
    }

    const isBulletStart = /^([*\-•]|\d+[.)])\s+/.test(trimmed);
    if (isBulletStart) {
      flush();
      buffer = trimmed.replace(/^([*\-•]|\d+[.)])\s+/, '');
    } else {
      if (buffer) {
        const indented = /^\s+/.test(line) || /^[-–]/.test(trimmed);
        if (indented) {
          buffer += ' ' + trimmed.replace(/^[-–]\s*/, '').trim();
          continue;
        }
        flush();
        buffer = trimmed;
      } else {
        buffer = trimmed;
      }
    }
  }
  flush();

  // Post-process: explode any topic line into per-sentence chunks so the
  // reader shows tappable lines instead of one giant paragraph blob. We split
  // on multiple boundaries (in priority order):
  //   1. Hindi danda (।)  — ALWAYS starts a new chunk (every full-stop = a
  //      new note line, as per the Read More requirement: "full stop ke
  //      baad new notes ban jayega").
  //   2. English . ! ?    — followed by whitespace + capital / Devanagari /
  //      digit / paren / emoji / bullet / hyphen (covers nearly everything
  //      that follows a sentence break, including 🎯/📝 emoji headers).
  //      Abbreviations like "Dr." or "e.g." don't match because they're
  //      followed by a lowercase letter.
  //   3. Inline section markers like "(IMPORTANT FACTS)", "(PRIMARY SECTOR):",
  //      "PART 1:", "🎯", "📝", "✏️" etc. — many imported library blobs glue
  //      everything inside one <p> with these as the only structure.
  // Headings are exploded too if they're long (>= 80 chars or contain a
  // sentence terminator) — the first chunk stays as the heading and the rest
  // become regular tappable body lines. Empty / placeholder fragments dropped.
  // Hindi danda is its own boundary (always splits, regardless of what follows).
  const HINDI_DANDA_BOUNDARY = /(?<=।)\s*/g;
  // English sentence end — needs a wider lookahead so we also split before
  // emojis, opening parens, bullets, dashes etc., not just A-Z / Devanagari.
  // Unicode property \p{Emoji} would be ideal but is not safe in older runtimes,
  // so we enumerate the common emoji ranges and symbol categories explicitly.
  const ENGLISH_SENTENCE_BOUNDARY =
    /(?<=[.!?])\s+(?=[A-Z\u0900-\u097F0-9(\-•*"'\u2013\u2014\u2018\u201C\uD83C-\uDBFF\u2600-\u27BF])/g;
  // Section markers that should each START a new topic line.
  const SECTION_MARKERS = /(?=(?:PART|UNIT|CHAPTER|SECTION|SET|MODEL\s*SET)\s*[-–]?\s*\d+\s*[:.)])|(?=\([A-Z][A-Z\s\/]{2,}\)\s*[:.)])|(?=📝|🎯|✏️|📌|⭐|💡|🔥|✨|📚|🎓|⚡)/g;

  // Numbered inline items: "...Kharvel 1 Hathi Gumpha... 2 Junagarh..."
  // Splits before a digit (1–99) that comes after text and is followed by
  // an uppercase/Devanagari letter or opening paren — i.e. a new list item.
  const INLINE_NUMBER_BOUNDARY =
    /(?<=[A-Za-z\u0900-\u097F)\]%'"])\s+(?=\d{1,2}[.\s]\s*[A-Z\u0900-\u097F(])/g;

  const splitOneTopic = (raw: string): string[] => {
    let out: string[] = [raw];
    // 1. Hindi danda — always a sentence boundary.
    out = out.flatMap(s => s.split(HINDI_DANDA_BOUNDARY));
    // 2. English sentence-end split (! ?) — "." still handled separately below.
    out = out.flatMap(s => s.split(/(?<=[!?])\s+(?=[A-Z\u0900-\u097F0-9(\-•*"'\u2013\u2014\u2018\u201C\uD83C-\uDBFF\u2600-\u27BF])/g));
    // 2b. Period split for Devanagari/Q&A content: split on ". " when:
    //   - preceded by ≥3 non-space/non-period chars (avoids "ई.पू.", "2.8", "1857." etc.)
    //   - followed by Devanagari, a single/double quote, or emoji (new sentence marker)
    //   This covers coaching Q&A: "लोहा. 'बिहार...", "है. स्थायी..." etc.
    out = out.flatMap(s => s.split(/(?<=[^\s.]{3})\.\s+(?=['"\u2018\u201C\u0900-\u097F\uD83C-\uDBFF\u2600-\u27BF])/g));
    // 3. Section-marker split (for any fragment still > ~80 chars).
    out = out.flatMap(s => (s.length > 80 ? s.split(SECTION_MARKERS) : [s]));
    return out.map(s => s.trim()).filter(Boolean);
  };

  const exploded: NotesTopic[] = [];
  for (const t of topics) {
    const cleaned = t.text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;

    // Skip pure-placeholder lines (only dots, dashes, ellipsis etc.)
    if (isPlaceholderLine(cleaned)) continue;

    // Headings: keep short ones intact, but explode long heading-blobs so we
    // don't end up with a single un-tappable wall of text (the "PART 1: …"
    // library-reference bug).
    if (t.isHeading) {
      const looksLikeBlob = cleaned.length > 80 || /[।!?]/.test(cleaned);
      if (!looksLikeBlob) {
        exploded.push({ ...t, text: cleaned });
        continue;
      }
      const parts = splitOneTopic(cleaned);
      if (parts.length <= 1) {
        exploded.push({ ...t, text: stripTrailingDots(cleaned) || cleaned });
        continue;
      }
      // First chunk stays as the heading marker, rest become normal tappable lines.
      let first = true;
      for (const p of parts) {
        if (isPlaceholderLine(p)) continue;
        const finalText = stripTrailingDots(p) || p;
        if (!finalText) continue;
        exploded.push({ text: finalText, isHeading: first });
        first = false;
      }
      continue;
    }

    const parts = splitOneTopic(cleaned);
    if (parts.length <= 1) {
      const finalText = stripTrailingDots(cleaned);
      if (finalText) exploded.push({ ...t, text: finalText });
      continue;
    }
    for (const p of parts) {
      if (!isPlaceholderLine(p)) {
        const finalText = stripTrailingDots(p) || p;
        if (finalText) exploded.push({ text: finalText, isHeading: false });
      }
    }
  }
  return exploded;
};
