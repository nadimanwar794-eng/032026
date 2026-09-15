// @ts-nocheck
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { X, Download, BookOpen, ChevronDown, ChevronUp, Volume2, GitCompare, Maximize2, Minimize2, CheckCircle2, Shuffle, MapPin, ChevronsRight, Lock, Crown } from 'lucide-react';
import { ChunkedNotesReader } from './ChunkedNotesReader';
import type { NoteSearchResult, PageBlob } from '../utils/noteSearcher';
import { loadAllPagesFromKey } from '../utils/noteSearcher';
import { getCompreBookNotes } from '../firebase';
import type { CompreNote } from '../firebase';

// ── Daily Limit Helpers ──
const FREE_DAILY_LIMIT = 3;
const DAILY_KEY = 'compare_daily';

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDailyUsage(): { date: string; count: number } {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === getTodayStr()) return parsed;
    }
  } catch {}
  return { date: getTodayStr(), count: 0 };
}

function incrementDailyUsage(): number {
  const usage = getDailyUsage();
  const next = { date: getTodayStr(), count: usage.count + 1 };
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(next)); } catch {}
  return next.count;
}

interface Props {
  hits: NoteSearchResult[];
  query: string;
  onClose: () => void;
  user?: { subscriptionLevel?: string; isPremium?: boolean };
  settings?: Record<string, any>;
}

type Mode = 'topic-compare' | 'book-by-book' | 'read-all' | 'book-notes';

// ── Helpers ──

// Common Hindi + English stop-words that appear in almost every sentence
// and inflate Dice scores without adding meaningful similarity.
const STOP_WORDS = new Set([
  'और','पर','में','की','के','का','से','है','हैं','था','थे','थी','एक','यह','वह',
  'इस','उस','जो','तो','भी','ही','कि','या','न','नहीं','हो','कर','को','ने',
  'हुए','हुई','हुआ','लिए','साथ','बाद','पहले','अब','जब','तब','अगर',
  'the','and','or','of','in','is','are','was','were','a','an','to','for',
  'on','at','by','as','it','its','this','that','with','from','be','has','have',
]);

function normalizeSentence(s: string): string {
  return s.toLowerCase().replace(/[^\u0900-\u097fa-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function getSignificantWords(s: string): string[] {
  return normalizeSentence(s)
    .split(' ')
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function wordOverlap(a: string, b: string): number {
  const wa = new Set(getSignificantWords(a));
  const wb = new Set(getSignificantWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let commonCount = 0;
  wa.forEach(w => { if (wb.has(w)) commonCount++; });
  // Dice coefficient: 2*|intersection| / (|A| + |B|)
  return (2 * commonCount) / (wa.size + wb.size);
}

// Lines that are headings/markers — not actual content points to compare
function isHeadingOrMarker(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (/^#{1,6}\s/.test(t)) return true;                        // ## Heading
  if (/^([=\-─━*]{3,})\s*$/.test(t)) return true;             // --- separator
  if (/^\p{Emoji}/u.test(t) && t.length < 120) return true;   // 🏁 emoji heading
  if (END_WORDS.some(w => t.toLowerCase().includes(w))) return true; // end markers
  if (/^(\d{1,2})[\.\)]\s+.{1,80}$/.test(t) && getSignificantWords(t).length < 4) return true; // "1. Short"
  return false;
}

function splitIntoPoints(text: string): string[] {
  return text
    .split(/[\n।]+/)
    .map(s => s.replace(/^[-•●▪\*\d]+[\.\)]\s*/, '').trim())
    .filter(s => {
      if (s.length < 12) return false;             // too short — likely a heading or stub
      if (isHeadingOrMarker(s)) return false;      // structural lines, not content
      if (getSignificantWords(s).length < 4) return false; // too few meaningful words → noisy matches
      return true;
    });
}

// ── Topic Boundary Extraction ──

interface TopicSection {
  topicTitle: string;   // The heading line that matched the query
  topicEnd: string;     // First line of the NEXT topic (so reader knows where it ends)
  sectionText: string;  // All lines from heading to next heading
}

// ── Line classifier ──

type LineKind =
  | { type: 'markdown'; level: number; text: string }  // ## Title  → level 2
  | { type: 'numbered'; text: string }                  // 1. Babar
  | { type: 'emoji-heading'; text: string }             // 🏁 Title
  | { type: 'end-marker'; text: string }                // THE END / SAMPANN / 🛑
  | { type: 'separator' }                               // --- / ===
  | { type: 'content'; text: string };

const END_WORDS = [
  'the end', 'topic closed', 'topic finished', 'sampann', 'samaapt',
  'समाप्त', 'सम्पन्न', 'yahan khatam', 'chapter end', 'end of topic',
  'topic wrap', 'topic complete', '[ topic closed ]', '🏁', '🔚', '🛑',
  'status: 100%',
];

const END_EMOJI_RX = /[🏁🔚🛑]/u;

function classifyLine(raw: string): LineKind {
  const line = raw.trim();

  // Markdown heading: ## Title
  const mdMatch = line.match(/^(#{1,6})\s+(.+)/);
  if (mdMatch) return { type: 'markdown', level: mdMatch[1].length, text: mdMatch[2].trim() };

  // Hard separator
  if (/^([=\-─━*]{3,})\s*$/.test(line)) return { type: 'separator' };

  const lower = line.toLowerCase();

  // End marker (must check before emoji-heading so 🏁 lines are caught here)
  if (END_WORDS.some(w => lower.includes(w)) || END_EMOJI_RX.test(line)) {
    return { type: 'end-marker', text: line };
  }

  // Emoji-heading: line starts with emoji, is short
  if (/^\p{Emoji}/u.test(line) && line.length < 100) {
    return { type: 'emoji-heading', text: line };
  }

  // Numbered heading: "1. Title" or "1) Title" — NOT a list item inside content
  const numMatch = line.match(/^(\d{1,2})[\.\)]\s+(.+)/);
  if (numMatch && numMatch[2].length < 80) return { type: 'numbered', text: numMatch[2].trim() };

  return { type: 'content', text: line };
}

/** Assign a comparable "rank" to a heading so we can find the NEXT heading of equal/higher rank. */
function headingRank(kind: LineKind): number {
  if (kind.type === 'markdown') return kind.level;   // 1 = #, 2 = ##, 3 = ###
  if (kind.type === 'emoji-heading') return 2;        // treat like ##
  if (kind.type === 'numbered') return 2;             // treat like ##
  return 99;
}

/**
 * Smart topic-boundary extraction.
 *
 * Understands:
 *   - Markdown headings  (##, ###, ####)
 *   - Emoji headings     (🏁 Title, ✅ Phase 1 …)
 *   - Numbered sections  (1. Babar, 2. Humayun)
 *   - Separator lines    (---, ===, ═══)
 *   - End markers        (THE END, SAMPANN, समाप्त, 🛑, 🔚, [TOPIC CLOSED] …)
 */
function extractTopicSection(fullText: string, queryWords: string[]): TopicSection | null {
  const effectiveWords = queryWords.filter(w => w.length >= 2);
  if (effectiveWords.length === 0) return null;

  const rawLines = fullText.split('\n').filter(l => l.trim().length > 0);
  if (rawLines.length < 2) return null;

  // Classify every line
  const classified = rawLines.map((raw, idx) => ({ idx, raw: raw.trim(), kind: classifyLine(raw) }));

  const hasAlpha = (s: string) => /[\u0900-\u097fa-zA-Z]/.test(s);

  const scoreLine = (raw: string): number => {
    const lower = raw.toLowerCase();
    return effectiveWords.filter(w => lower.includes(w.toLowerCase())).length;
  };

  // ── Find the best start heading that contains query words ──
  const headingTypes: LineKind['type'][] = ['markdown', 'emoji-heading', 'numbered'];

  // Also allow plain short lines (fallback)
  const isShortPlainHeading = (raw: string, kind: LineKind) =>
    kind.type === 'content' && hasAlpha(raw) && raw.length < 70 &&
    !raw.endsWith(',') && !raw.endsWith(';');

  const candidates = classified
    .map(c => {
      const score = scoreLine(c.raw);
      const isHeading = headingTypes.includes(c.kind.type) || isShortPlainHeading(c.raw, c.kind);
      return { ...c, score, isHeading };
    })
    .filter(c => c.score > 0 && c.isHeading)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Among equal score: prefer explicit headings over plain short lines
      const aIsExplicit = headingTypes.includes(a.kind.type) ? 0 : 1;
      const bIsExplicit = headingTypes.includes(b.kind.type) ? 0 : 1;
      if (aIsExplicit !== bIsExplicit) return aIsExplicit - bIsExplicit;
      return a.raw.length - b.raw.length; // shorter = more heading-like
    });

  if (candidates.length === 0) return null;

  const startEntry = candidates[0];
  const startIdx = startEntry.idx;
  const topicTitle = startEntry.raw;
  const startRank = headingRank(startEntry.kind);

  // ── Find topic end: next heading of same/higher rank, separator, or end-marker ──
  let endIdx = classified.length;
  for (let i = startIdx + 1; i < classified.length; i++) {
    const { kind, raw } = classified[i];

    // End marker → hard stop
    if (kind.type === 'end-marker') {
      // Include the end marker itself in the section so it's visible
      endIdx = i + 1;
      break;
    }

    // Separator → hard stop
    if (kind.type === 'separator') { endIdx = i; break; }

    // Another heading of same or higher rank (lower level number) that doesn't match query
    if (headingTypes.includes(kind.type)) {
      const rank = headingRank(kind);
      if (rank <= startRank && scoreLine(raw) === 0 && i > startIdx + 2) {
        endIdx = i; break;
      }
    }

    // Plain short line that looks like a new section heading, no query words
    if (isShortPlainHeading(raw, kind) && scoreLine(raw) === 0 && hasAlpha(raw) && i > startIdx + 3) {
      endIdx = i; break;
    }
  }

  const sectionLines = classified.slice(startIdx, endIdx).map(c => c.raw);
  const sectionText = sectionLines.join('\n');

  // The line just after our section = topicEnd (what comes next)
  const nextEntry = classified[endIdx];
  const topicEnd = nextEntry ? nextEntry.raw : '';

  if (sectionLines.length < 2) return null;
  return { topicTitle, topicEnd, sectionText };
}

// ── Compare Engine ──

interface BookContent {
  bookName: string;
  pageNo?: string;
  text: string;
  topicTitle?: string;
  topicEnd?: string;
}

interface TopicCompareResult {
  common: string[];
  extra: {
    bookName: string;
    pageNo?: string;
    points: string[];
    topicTitle?: string;
    topicEnd?: string;
  }[];
}

function computeTopicComparison(bookContents: BookContent[]): TopicCompareResult {
  if (bookContents.length === 0) return { common: [], extra: [] };

  const bookPoints = bookContents.map(bc => ({
    bookName: bc.bookName,
    pageNo: bc.pageNo,
    topicTitle: bc.topicTitle,
    topicEnd: bc.topicEnd,
    points: splitIntoPoints(bc.text),
  }));

  const common: string[] = [];
  const usedCommon = new Set<string>();
  const extraPerBook = bookPoints.map(b => ({
    bookName: b.bookName,
    pageNo: b.pageNo,
    topicTitle: b.topicTitle,
    topicEnd: b.topicEnd,
    points: [] as string[],
  }));

  // Using Dice coefficient (2*|A∩B|/(|A|+|B|)) on significant (non-stop) words.
  // MATCH_THRESHOLD: two points are "the same fact" if Dice >= this value.
  //   0.55 means ~55%+ meaningful word overlap — prevents accidental common-tagging.
  // DEDUP_THRESHOLD: once a fact is in common, this prevents near-duplicate phrasing
  //   from being added again (slightly lower so paraphrases of same fact merge cleanly).
  const MATCH_THRESHOLD = 0.55;
  const DEDUP_THRESHOLD = 0.50;

  bookPoints.forEach((book, bi) => {
    book.points.forEach(point => {
      // Short points (< 4 significant words) need near-exact match to avoid false positives
      const pointWords = getSignificantWords(point);
      const effectiveThreshold = pointWords.length < 4 ? Math.max(MATCH_THRESHOLD, 0.65) : MATCH_THRESHOLD;

      let matchedInOther = false;
      for (let other = 0; other < bookPoints.length; other++) {
        if (other === bi) continue;
        if (bookPoints[other].points.some(p => wordOverlap(point, p) >= effectiveThreshold)) {
          matchedInOther = true;
          break;
        }
      }
      if (matchedInOther) {
        const alreadyIn = common.some(c => wordOverlap(point, c) >= DEDUP_THRESHOLD);
        const norm = normalizeSentence(point);
        if (!alreadyIn && !usedCommon.has(norm)) {
          common.push(point);
          usedCommon.add(norm);
        }
      } else {
        extraPerBook[bi].points.push(point);
      }
    });
  });

  return { common, extra: extraPerBook };
}

// ── Compre Book Notes — standard books list ──
const CN_BOOKS_CV = [
  { id: 'lucent',              label: '📘 Lucent GK' },
  { id: 'sarSangrah',          label: '📒 Sar Sangrah' },
  { id: 'speedyScience',       label: '🔬 Speedy Science' },
  { id: 'speedySocialScience', label: '🌍 Speedy Social Sci' },
];

// ── Component ──

export const CompareView: React.FC<Props> = ({ hits, query, onClose, user, settings }) => {
  // Count unique books, not individual page-hits
  const uniqueBookCount = useMemo(() => new Set(hits.map(h => h.bookName || h.subjectName)).size, [hits]);
  const isSingleBook = uniqueBookCount <= 1;
  const [mode, setMode] = useState<Mode>(isSingleBook ? 'book-by-book' : 'topic-compare');
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set(hits.map((_, i) => i)));

  const [topicResult, setTopicResult] = useState<TopicCompareResult | null>(null);
  const [extractedSections, setExtractedSections] = useState<BookContent[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [activeTopicQuery, setActiveTopicQuery] = useState<string>(query);
  const [limitReached, setLimitReached] = useState(false);
  const [dailyUsedCount, setDailyUsedCount] = useState(() => getDailyUsage().count);

  const isUltra = user?.subscriptionLevel === 'ULTRA' || (user as any)?.subscriptionTier === 'LIFETIME';
  const remainingToday = Math.max(0, FREE_DAILY_LIMIT - dailyUsedCount);

  const [cnAllNotes, setCnAllNotes] = useState<{bookId: string; bookLabel: string; note: CompreNote}[] | null>(null);
  const [cnNotesLoading, setCnNotesLoading] = useState(false);
  const [cnActiveTopic, setCnActiveTopic] = useState<string | null>(null);

  const [floatPos, setFloatPos] = useState({ x: window.innerWidth - 72, y: Math.floor(window.innerHeight * 0.55) });
  const floatDragging = useRef(false);
  const floatMoved = useRef(false);
  const floatStart = useRef({ px: 0, py: 0, bx: 0, by: 0 });

  // Group hits by bookName (deduplicate)
  const books = useMemo(() => {
    const seen = new Set<string>();
    return hits.filter(h => {
      const key = h.bookName || h.subjectName;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [hits]);

  const combinedContent = useMemo(() => {
    return books.map(h => {
      const bookName = h.bookName || h.subjectName;
      return `${bookName}:\n${(h.noteContent || '').trim()}`;
    }).join('\n\n');
  }, [books]);

  // Extract 📌 topic headings from all books' full content for topic picker
  const pinTopics = useMemo(() => {
    const topics: string[] = [];
    const seen = new Set<string>();
    books.forEach(book => {
      const content = book.noteFullContent || book.noteContent || '';
      const parts = content.split(/📌\s*/);
      parts.slice(1).forEach(part => {
        const firstLine = part.split('\n')[0]?.trim() || '';
        if (firstLine.length > 2 && firstLine.length < 200 && !seen.has(firstLine)) {
          seen.add(firstLine);
          topics.push(firstLine);
        }
      });
    });
    return topics;
  }, [books]);

  // ── Load topic compare with topic-boundary extraction ──
  const loadTopicCompare = useCallback(async (overrideQuery?: string) => {
    if (!isUltra) {
      const usage = getDailyUsage();
      if (usage.count >= FREE_DAILY_LIMIT) {
        setLimitReached(true);
        setDailyUsedCount(usage.count);
        return;
      }
      const newCount = incrementDailyUsage();
      setDailyUsedCount(newCount);
    }
    setTopicLoading(true);
    setTopicResult(null);
    try {
      const effectiveQuery = overrideQuery ?? activeTopicQuery;
      const words = effectiveQuery.trim().split(/\s+/).filter(w => w.length >= 2);
      const bookContents: BookContent[] = [];

      // Check if ALL hits have the same topicName — if so, use topic-name based match
      const topicNames = books.map(b => b.topicName).filter(Boolean);
      const allSameTopicName = topicNames.length === books.length && new Set(topicNames).size === 1;

      // Group ALL hits by bookName so we can combine every page of a book, not just the first hit.
      const hitsByBook = new Map<string, NoteSearchResult[]>();
      hits.forEach(h => {
        const bName = h.bookName || h.subjectName;
        if (!hitsByBook.has(bName)) hitsByBook.set(bName, []);
        hitsByBook.get(bName)!.push(h);
      });

      await Promise.all(books.map(async (book) => {
        const bookName = book.bookName || book.subjectName;
        const key = book.storageKey;
        const allBookHits = hitsByBook.get(bookName) || [book];

        let fullText = '';

        if (key.startsWith('hw_') || key.startsWith('lucent_')) {
          // Virtual keys — use top-5 most relevant pages (by matchCount) to keep
          // comparison focused. Using ALL pages dilutes with off-topic content.
          const TOP_PAGES = 5;
          const topHits = [...allBookHits]
            .sort((a, b) => (b.matchCount || 0) - (a.matchCount || 0))
            .slice(0, TOP_PAGES);
          const combined = topHits
            .map(h => (h.noteFullContent || h.noteContent || '').trim())
            .filter(t => t.length > 5)
            .join('\n');
          fullText = combined;
        } else {
          // Real cached chapter — load all pages and pick best match
          const blobs = await loadAllPagesFromKey(key, words);
          if (blobs.length > 0 && blobs[0].text.length > 10) {
            fullText = blobs[0].text;
          } else {
            fullText = book.noteFullContent || book.noteContent || '';
          }
        }

        if (fullText.length <= 10) return;

        // If this note has an explicit topicName tag, use it to extract the section
        // more precisely (prepend as heading so extractTopicSection finds it)
        if (book.topicName) {
          const topicWords = book.topicName.split(/\s+/).filter(w => w.length >= 2);
          const searchWords = allSameTopicName ? topicWords : words;
          const section = extractTopicSection(fullText, searchWords);
          if (section) {
            bookContents.push({
              bookName,
              pageNo: book.pageNo,
              text: section.sectionText,
              topicTitle: book.topicName,
              topicEnd: section.topicEnd,
            });
          } else {
            bookContents.push({
              bookName,
              pageNo: book.pageNo,
              text: fullText,
              topicTitle: book.topicName,
            });
          }
          return;
        }

        // Standard path: try to extract topic-specific section by query words
        const section = extractTopicSection(fullText, words);

        if (section) {
          bookContents.push({
            bookName,
            pageNo: book.pageNo,
            text: section.sectionText,
            topicTitle: section.topicTitle,
            topicEnd: section.topicEnd,
          });
        } else {
          bookContents.push({ bookName, pageNo: book.pageNo, text: fullText });
        }
      }));

      setExtractedSections(bookContents);
      setTopicResult(computeTopicComparison(bookContents));
    } finally {
      setTopicLoading(false);
    }
  }, [books, activeTopicQuery]);

  useEffect(() => { loadTopicCompare(); }, []);
  useEffect(() => {
    if (mode === 'topic-compare' && !topicResult && !topicLoading) loadTopicCompare();
  }, [mode]);
  useEffect(() => {
    loadTopicCompare(activeTopicQuery);
  }, [activeTopicQuery]);

  const cnTopics = useMemo(() => {
    if (!cnAllNotes) return [];
    const seen = new Set<string>();
    const topics: string[] = [];
    cnAllNotes.forEach(e => {
      const topic = e.note.topicName || `Page ${e.note.pageNumber}`;
      if (!seen.has(topic)) { seen.add(topic); topics.push(topic); }
    });
    return topics;
  }, [cnAllNotes]);

  const cnActiveEntries = useMemo(() => {
    if (!cnAllNotes || !cnActiveTopic) return [];
    return cnAllNotes.filter(e => (e.note.topicName || `Page ${e.note.pageNumber}`) === cnActiveTopic);
  }, [cnAllNotes, cnActiveTopic]);

  const loadCnNotes = useCallback(async () => {
    if (cnAllNotes !== null) return;
    setCnNotesLoading(true);
    try {
      const results: {bookId: string; bookLabel: string; note: CompreNote}[] = [];
      await Promise.all(CN_BOOKS_CV.map(async bt => {
        try {
          const notes = await getCompreBookNotes(bt.id);
          notes.forEach(note => results.push({ bookId: bt.id, bookLabel: bt.label, note }));
        } catch {}
      }));
      results.sort((a, b) => b.note.createdAt.localeCompare(a.note.createdAt));
      setCnAllNotes(results);
    } finally {
      setCnNotesLoading(false);
    }
  }, [cnAllNotes]);

  useEffect(() => {
    if (cnAllNotes && cnTopics.length > 0 && !cnActiveTopic) {
      setCnActiveTopic(cnTopics[0]);
    }
  }, [cnAllNotes, cnTopics, cnActiveTopic]);

  const toggleBook = (idx: number) => {
    setExpandedBooks(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  // ── Floating drag ──
  const onFloatTouchStart = (e: React.TouchEvent) => {
    floatDragging.current = true; floatMoved.current = false;
    floatStart.current = { px: e.touches[0].clientX, py: e.touches[0].clientY, bx: floatPos.x, by: floatPos.y };
  };
  const onFloatTouchMove = (e: React.TouchEvent) => {
    if (!floatDragging.current) return;
    const dx = e.touches[0].clientX - floatStart.current.px;
    const dy = e.touches[0].clientY - floatStart.current.py;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) floatMoved.current = true;
    setFloatPos({ x: Math.max(8, Math.min(window.innerWidth - 68, floatStart.current.bx + dx)), y: Math.max(8, Math.min(window.innerHeight - 68, floatStart.current.by + dy)) });
    e.preventDefault();
  };
  const onFloatTouchEnd = () => { floatDragging.current = false; };
  const onFloatMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); floatDragging.current = true; floatMoved.current = false;
    floatStart.current = { px: e.clientX, py: e.clientY, bx: floatPos.x, by: floatPos.y };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - floatStart.current.px; const dy = ev.clientY - floatStart.current.py;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) floatMoved.current = true;
      setFloatPos({ x: Math.max(8, Math.min(window.innerWidth - 68, floatStart.current.bx + dx)), y: Math.max(8, Math.min(window.innerHeight - 68, floatStart.current.by + dy)) });
    };
    const onUp = () => { floatDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };


  return (
    <div className="fixed inset-0 z-[250] bg-white flex flex-col overflow-hidden">

      {/* Header */}
      {!focusMode && (
        <div className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white px-3 py-1.5 flex items-center gap-2 shrink-0">
          <GitCompare size={16} className="shrink-0 opacity-80" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black leading-tight text-white truncate">
              {books.length === 0
                ? `"${query}" — not found`
                : books.length === 1
                  ? `"${query}" — 1 book`
                  : `"${query}" — ${books.length} books`}
            </p>
          </div>
          {!isUltra && (
            <div className="flex items-center gap-0.5 bg-white/20 px-2 py-1 rounded-lg shrink-0">
              <span className="text-[10px] font-black text-violet-100">{remainingToday}/{FREE_DAILY_LIMIT}</span>
              <span className="text-[9px] text-violet-300 ml-0.5">aaj</span>
            </div>
          )}
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Daily Limit Wall */}
      {limitReached && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-slate-50">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Lock size={30} className="text-amber-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-1">Today's limit reached!</h3>
          <p className="text-sm text-slate-500 text-center mb-2">
            On the free plan you can compare <strong>{FREE_DAILY_LIMIT} topics</strong> per day.
          </p>
          <p className="text-xs text-slate-400 text-center mb-6">Come back tomorrow for {FREE_DAILY_LIMIT} more topics — or get Ultra for unlimited compares.</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-lg">
              <Crown size={22} />
              <div>
                <p className="font-black text-sm">Get Ultra — Unlimited</p>
                <p className="text-[11px] text-amber-100">One time — lifetime access</p>
              </div>
            </div>
            <button onClick={onClose} className="text-xs text-slate-400 py-2 hover:text-slate-600 transition-colors">
              Come back tomorrow — Close
            </button>
          </div>
        </div>
      )}

      {/* Mode tabs */}
      {!focusMode && !limitReached && (
        <div className="flex bg-slate-100 p-0.5 gap-0.5 shrink-0 mx-2 mt-1.5 mb-0.5 rounded-lg">
          {!isSingleBook && (
            <button onClick={() => setMode('topic-compare')} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${mode === 'topic-compare' ? 'bg-white shadow text-emerald-700' : 'text-slate-500'}`}>
              <Shuffle size={11} /> Compare
            </button>
          )}
          <button onClick={() => setMode('book-by-book')} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${mode === 'book-by-book' ? 'bg-white shadow text-violet-700' : 'text-slate-500'}`}>
            <BookOpen size={11} /> {isSingleBook ? 'Notes' : 'Book Wise'}
          </button>
          <button onClick={() => setMode('read-all')} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${mode === 'read-all' ? 'bg-white shadow text-violet-700' : 'text-slate-500'}`}>
            <Volume2 size={11} /> Read All
          </button>
          <button onClick={() => { setMode('book-notes'); loadCnNotes(); }} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${mode === 'book-notes' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>
            <GitCompare size={11} /> Book Notes
          </button>
        </div>
      )}

      {/* Focus mode mini bar */}
      {focusMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white shrink-0">
          <span className="text-xs font-bold text-slate-400 truncate">"{query}"</span>
          <button onClick={() => setFocusMode(false)} className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white">
            <Minimize2 size={14} /> Exit Focus
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {!limitReached && <div className="flex-1 overflow-y-auto pb-20">

        {/* ── TOPIC COMPARE MODE ── */}
        {mode === 'topic-compare' && (
          <div className="px-2 pt-2 space-y-2">

            {/* ── 📌 Pin-Topic Picker (shown when notes have 📌 sections) ── */}
            {pinTopics.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2">
                  <span className="text-base">📌</span>
                  <p className="text-[11px] font-black text-amber-800">Select a topic — only that topic will be compared</p>
                </div>
                <div className="flex gap-2 overflow-x-auto px-3 pb-3 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <button
                    onClick={() => setActiveTopicQuery(query)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${activeTopicQuery === query ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-100'}`}
                  >
                    🔍 All
                  </button>
                  {pinTopics.map((topic, ti) => (
                    <button
                      key={ti}
                      onClick={() => setActiveTopicQuery(topic)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border transition-all max-w-[200px] truncate ${activeTopicQuery === topic ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-100'}`}
                      title={topic}
                    >
                      📌 {topic.length > 30 ? topic.substring(0, 30) + '…' : topic}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {topicLoading && (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">Topic-wise compare ho raha hai...</p>
                <p className="text-xs text-slate-400 mt-1">{books.length} books se
                  {books.some(b => b.topicName)
                    ? ` tagged topic "${books.find(b => b.topicName)?.topicName}" ka pura section nikal raha hai`
                    : ` sirf "${activeTopicQuery}" wala section nikal raha hai`}
                </p>
              </div>
            )}

            {!topicLoading && topicResult && (
              <>
                {/* Book + Topic info strip */}
                <div className="flex flex-wrap gap-1.5">
                  {books.map((h, i) => {
                    const bookName = h.bookName || h.subjectName;
                    const bookExtra = topicResult.extra[i];
                    return (
                      <div key={i} className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-xl px-2.5 py-1 min-w-0 max-w-full">
                        <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-[10px] font-black text-violet-800 truncate">{bookName}</span>
                        {h.pageNo && <span className="text-[9px] text-violet-400 font-medium shrink-0">p.{h.pageNo}</span>}
                        {bookExtra?.topicTitle && (
                          <span className="flex items-center gap-0.5">
                            <MapPin size={9} className="text-emerald-500 shrink-0" />
                            <span className="text-[9px] text-emerald-700 font-bold truncate max-w-[80px]">{bookExtra.topicTitle}</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── COMMON POINTS ── */}
                <div className="rounded-xl border-2 border-emerald-400 overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1.5 flex items-center gap-2">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-black">Common Points {topicResult.common.length > 0 ? `(${topicResult.common.length})` : ''}</p>
                    </div>
                  </div>
                  {topicResult.common.length === 0 ? (
                    <div className="bg-white px-4 py-5 text-center">
                      <p className="text-xs text-slate-400">Books ke notes kaafi alag hain — neeche har book ke extra points dekh sakte hain.</p>
                    </div>
                  ) : (
                    <div className="bg-white px-3 pb-2">
                      <ChunkedNotesReader
                        key={`compare-common-${query}`}
                        content={topicResult.common.join('\n')}
                        topBarLabel="Common Points"
                        searchQuery={query}
                        language="hi-IN"
                      />
                    </div>
                  )}
                </div>

                {/* ── EXTRA POINTS (per book) ── */}
                {topicResult.extra.map(({ bookName, pageNo, points, topicTitle }, bi) => {
                  if (points.length === 0) return null;
                  return (
                    <div key={bi} className="rounded-xl border border-violet-200 overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-white/20 text-white font-black text-[10px] flex items-center justify-center shrink-0">{bi + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black truncate">{bookName}{pageNo ? ` · p.${pageNo}` : ''} <span className="font-normal text-violet-200">({points.length} extra)</span></p>
                          </div>
                        </div>
                        {topicTitle && (
                          <div className="flex items-center gap-1 ml-7 mt-0.5">
                            <MapPin size={9} className="text-emerald-300 shrink-0" />
                            <span className="text-[9px] text-emerald-200 font-bold truncate">{topicTitle}</span>
                          </div>
                        )}
                      </div>
                      <div className="bg-white px-3 pb-2">
                        <ChunkedNotesReader
                          key={`compare-extra-${bi}-${query}`}
                          content={points.join('\n')}
                          topBarLabel={`${bookName}${pageNo ? ` · Pg ${pageNo}` : ''}`}
                          searchQuery={query}
                          language="hi-IN"
                        />
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={loadTopicCompare}
                  className="w-full py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
                >
                  🔄 Dobara Compare Karein
                </button>
              </>
            )}

            {!topicLoading && !topicResult && (
              <div className="text-center py-10">
                <p className="text-xs text-slate-400 mb-3">Data could not be loaded.</p>
                <button onClick={loadTopicCompare} className="px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl">Retry</button>
              </div>
            )}
          </div>
        )}

        {/* ── BOOK WISE MODE ── */}
        {mode === 'book-by-book' && (
          <div className="space-y-2 px-2 pt-2">
            {books.map((h, i) => {
              const bookName = h.bookName || h.subjectName;
              const classInfo = h.classLevel === 'COMPETITION' ? 'Competition' : `Class ${h.classLevel}`;
              const isOpen = expandedBooks.has(i);
              return (
                <div key={`${h.storageKey}_${i}`} className="rounded-xl border border-violet-100 overflow-hidden shadow-sm">
                  <button
                    className="w-full flex items-center gap-2 bg-gradient-to-r from-violet-50 to-indigo-50 px-3 py-2 text-left"
                    onClick={() => toggleBook(i)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center font-black text-xs shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{bookName}</p>
                      <p className="text-[9px] font-bold text-violet-500">
                        {classInfo}{h.pageNo ? ` · p.${h.pageNo}` : ''} · {h.matchCount} match{h.matchCount !== 1 ? 'es' : ''}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp size={14} className="text-violet-400 shrink-0" /> : <ChevronDown size={14} className="text-violet-400 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="bg-white px-3 pb-2">
                      {h.matchedWords && h.matchedWords.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-1 pt-2 pb-1">
                          {h.matchedWords.map((w, wi) => (
                            <span key={wi} className="bg-violet-100 text-violet-700 text-[10px] font-black px-2 py-0.5 rounded-full">{w}</span>
                          ))}
                        </div>
                      )}
                      <ChunkedNotesReader
                        key={`compare-book-${i}-${query}`}
                        content={h.noteFullContent || h.noteContent || ''}
                        topBarLabel={`${bookName}${h.pageNo ? ` · Pg ${h.pageNo}` : ''}`}
                        searchQuery={query}
                        language="hi-IN"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── READ ALL MODE ── */}
        {mode === 'read-all' && (() => {
          // Use topic-extracted sections if available, else fallback to full content
          let readContent = '';
          if (extractedSections.length > 0) {
            // Common points first (only for multi-book compare)
            const commonBlock = (!isSingleBook && topicResult && topicResult.common.length > 0)
              ? `✅ COMMON POINTS (sabhi books mein):\n${topicResult.common.join('\n')}\n\n---\n\n`
              : '';
            const bookBlocks = extractedSections.map(sec => {
              const header = `📚 ${sec.bookName}${sec.pageNo ? ` (Page ${sec.pageNo})` : ''}${sec.topicTitle ? `\n📌 ${sec.topicTitle}` : ''}`;
              return `${header}\n\n${sec.text}`;
            }).join('\n\n---\n\n');
            readContent = commonBlock + bookBlocks;
          } else {
            // Fallback: full content
            readContent = combinedContent;
          }
          return (
            <div className="px-3 pt-3">
              {readContent.trim() ? (
                <ChunkedNotesReader
                  content={readContent}
                  topBarLabel={`Read: ${query}`}
                  searchQuery={query}
                  language="hi-IN"
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-2xl mb-2">📭</p>
                  <p className="text-sm font-bold text-slate-500">No content found</p>
                  <p className="text-xs text-slate-400 mt-1">"{query}" topic is not available in any book.</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── BOOK NOTES MODE ── */}
        {mode === 'book-notes' && (
          <div className="px-2 pt-2">
            {cnNotesLoading && (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"/>
                <p className="text-xs font-bold text-slate-500">Book notes load ho rahe hain…</p>
              </div>
            )}

            {!cnNotesLoading && cnAllNotes !== null && cnTopics.length === 0 && (
              <div className="text-center py-12">
                <p className="text-3xl mb-3">📭</p>
                <p className="text-sm font-bold text-slate-600">Koi Book Notes nahi hain</p>
                <p className="text-xs text-slate-400 mt-1">Admin se compare book notes add karwayein</p>
              </div>
            )}

            {!cnNotesLoading && cnTopics.length > 0 && (
              <div className="space-y-3">
                {/* ── Topic navigation pills ── */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl overflow-hidden">
                  <div className="px-3 py-2 flex items-center gap-2">
                    <span className="text-base">📌</span>
                    <p className="text-[11px] font-black text-indigo-800">Topic chunein — us topic ke saare books ke notes dikhenge</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto px-3 pb-3 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {cnTopics.map((topic, ti) => (
                      <button
                        key={ti}
                        onClick={() => setCnActiveTopic(topic)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${cnActiveTopic === topic ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}
                        title={topic}
                      >
                        📌 {topic.length > 30 ? topic.substring(0, 30) + '…' : topic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Notes for selected topic ── */}
                {cnActiveTopic && cnActiveEntries.length > 0 && (
                  <div className="space-y-2">
                    {/* Book count chip */}
                    <div className="flex flex-wrap gap-1.5 px-0.5">
                      {cnActiveEntries.map((entry, ei) => (
                        <div key={ei} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-xl px-2.5 py-1">
                          <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">{ei + 1}</span>
                          <span className="text-[10px] font-black text-indigo-800 truncate max-w-[120px]">{entry.bookLabel}</span>
                          {entry.note.pageNumber && entry.note.pageNumber !== '—' && (
                            <span className="text-[9px] text-indigo-400 font-medium shrink-0">p.{entry.note.pageNumber}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Per-book notes */}
                    {cnActiveEntries.map((entry, ei) => (
                      <div key={entry.note.id} className="rounded-xl border border-indigo-200 overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-3 py-1.5 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-white/20 font-black text-[10px] flex items-center justify-center shrink-0">{ei + 1}</span>
                          <span className="text-[11px] font-black flex-1 truncate">{entry.bookLabel}</span>
                          {entry.note.pageNumber && entry.note.pageNumber !== '—' && (
                            <span className="text-[9px] text-indigo-200 shrink-0">Pg {entry.note.pageNumber}</span>
                          )}
                        </div>
                        <div className="bg-white px-3 pb-2">
                          <ChunkedNotesReader
                            key={`cn-${entry.note.id}`}
                            content={entry.note.notes}
                            topBarLabel={entry.bookLabel}
                            searchQuery={cnActiveTopic ?? ''}
                            language="hi-IN"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>}

      {/* ── Floating Focus Button ── */}
      <div
        style={{ position: 'fixed', left: floatPos.x, top: floatPos.y, zIndex: 350, touchAction: 'none', userSelect: 'none' }}
        onTouchStart={onFloatTouchStart}
        onTouchMove={onFloatTouchMove}
        onTouchEnd={onFloatTouchEnd}
        onMouseDown={onFloatMouseDown}
      >
        <button
          onClick={() => { if (!floatMoved.current) setFocusMode(prev => !prev); }}
          className={`w-14 h-14 rounded-full text-white shadow-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform border-2 border-white/30 ${focusMode ? 'bg-gradient-to-br from-slate-700 to-slate-900' : 'bg-gradient-to-br from-violet-600 to-indigo-600'}`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {focusMode
            ? <><Minimize2 size={20} /><span className="text-[8px] font-black leading-none">EXIT</span></>
            : <><Maximize2 size={20} /><span className="text-[8px] font-black leading-none">FOCUS</span></>
          }
        </button>
      </div>
    </div>
  );
};
