import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Download, CheckCircle2, BookOpen, GitCompare, ChevronLeft, ChevronRight, Crown, Search, Trash2, ChevronDown, ChevronUp, Loader2, Play, Headphones, FileText, Volume2, Layers, RotateCcw } from 'lucide-react';
import { isDesktopModeOn, rotateScreen } from '../utils/displayPrefs';
import { ChunkedNotesReader } from './ChunkedNotesReader';
import type { SystemSettings } from '../types';
import { getCompreBookNotes, type CompreNote } from '../firebase';

const POINTS_PER_PAGE = 50;

function getCompareTierGrad(user?: { subscriptionLevel?: string; isPremium?: boolean }): string {
  const level = user?.subscriptionLevel?.toUpperCase();
  if (level === 'ULTRA') return 'linear-gradient(135deg, #0F172A 0%, #1A2F5E 50%, #0F172A 100%)';
  if (level === 'BASIC' || user?.isPremium) return 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';
  return 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)';
}

// ── Comparison helpers ──

// Common Hindi + English stop-words — inflate similarity scores without real meaning
const FBC_STOP_WORDS = new Set([
  'और','पर','में','की','के','का','से','है','हैं','था','थे','थी','एक','यह','वह',
  'इस','उस','जो','तो','भी','ही','कि','या','न','नहीं','हो','कर','को','ने',
  'हुए','हुई','हुआ','लिए','साथ','बाद','पहले','अब','जब','तब','अगर','जिसे','जिसमें',
  'the','and','or','of','in','is','are','was','were','a','an','to','for',
  'on','at','by','as','it','its','this','that','with','from','be','has','have',
]);

function normalizeSentence(s: string): string {
  return s.toLowerCase().replace(/[^\u0900-\u097fa-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
function getSignificantWords(s: string): string[] {
  return normalizeSentence(s).split(' ').filter(w => w.length >= 3 && !FBC_STOP_WORDS.has(w));
}
// Dice coefficient: 2*|intersection|/(|A|+|B|) — fair for asymmetric-length points
function wordOverlap(a: string, b: string): number {
  const wa = new Set(getSignificantWords(a));
  const wb = new Set(getSignificantWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersect = 0;
  wa.forEach(w => { if (wb.has(w)) intersect++; });
  return (2 * intersect) / (wa.size + wb.size);
}
function splitIntoPoints(text: string): string[] {
  return text
    .split(/[\n।\|]+/)
    .map(s => s
      .replace(/^[\s📌📚🔹🔸▪•●\-\*→>\d]+[\.\)\:]\s*/, '')
      .replace(/^[\s📌📚🔹🔸▪•●\-\*→>\d]+\s+/, '')
      .trim()
    )
    .filter(s => s.length >= 8 && !/^(page|date|notes|pg)\s*[:—]/i.test(s));
}

function computeFullBookComparison(bookContents: { bookName: string; text: string }[]): {
  common: string[];
  extra: { bookName: string; points: string[] }[];
} {
  if (bookContents.length === 0) return { common: [], extra: [] };
  const bookPoints = bookContents.map(bc => ({
    bookName: bc.bookName,
    points: splitIntoPoints(bc.text.substring(0, 80000)),
  }));
  // MATCH_THRESHOLD: Dice >= 0.55 to call two points "the same fact"
  // Short points (< 4 meaningful words) need >= 0.65 to prevent accidental matches
  // DEDUP_THRESHOLD: 0.50 to avoid adding near-duplicate phrasing of same fact twice
  const MATCH_THRESHOLD = 0.55;
  const DEDUP_THRESHOLD = 0.50;

  const common: string[] = [];
  const usedCommon = new Set<string>();
  const extraPerBook = bookPoints.map(b => ({ bookName: b.bookName, points: [] as string[] }));
  bookPoints.forEach((book, bi) => {
    book.points.forEach(point => {
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
        const norm = normalizeSentence(point);
        if (!usedCommon.has(norm) && !common.some(c => wordOverlap(point, c) >= DEDUP_THRESHOLD)) {
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

// Standard book names map
const HW_LABELS: Record<string, string> = {
  sarSangrah: 'Sar Sangrah',
  speedyScience: 'Speedy Science',
  speedySocialScience: 'Speedy Social Science',
  lucent: 'Lucent GK',
};
const COMPRE_BOOK_NAMES: Record<string, string> = {
  lucent: 'Lucent GK',
  sarSangrah: 'Sar Sangrah',
  speedyScience: 'Speedy Science',
  speedySocialScience: 'Speedy Social Science',
};

interface Props {
  settings: SystemSettings | null;
  user?: { subscriptionLevel?: string; isPremium?: boolean; isAdmin?: boolean };
  isLimited?: boolean;
  freeLimit?: number;
  onClose: () => void;
  isFocusMode?: boolean;
  topBarGrad?: string;
  profileBg?: string;
  profileCardBg?: string;
  isDarkMode?: boolean;
  primaryColor?: string;
}

export const FullBookCompare: React.FC<Props> = ({ settings, user, isLimited = false, freeLimit = 4, onClose, isFocusMode = false, topBarGrad, profileBg, profileCardBg, isDarkMode = false, primaryColor }) => {
  const isAdmin = !!(user?.isAdmin);
  // Effective color priority: passed primaryColor (full tierTheme) > settings.themeColor > subscription tier default
  const _baseSubColor = (user?.subscriptionLevel === 'ULTRA' && user?.isPremium) ? '#1d4ed8'
    : (user?.subscriptionLevel === 'BASIC' && user?.isPremium) ? '#2563eb'
    : '#0ea5e9';
  const subColor = primaryColor || (settings as any)?.themeColor || _baseSubColor;
  const _hexToRgba = (hex: string, alpha: number) => {
    const h = hex.replace('#','').padEnd(6,'0');
    return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${alpha})`;
  };
  const subColorLight = _hexToRgba(subColor, 0.08);
  const subColorBorder = _hexToRgba(subColor, 0.30);

  // ── Search state ──
  const [searchWord, setSearchWord] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Compare state ──
  const [processing, setProcessing] = useState(true);
  const [result, setResult] = useState<{ common: string[]; extra: { bookName: string; points: string[] }[] } | null>(null);
  const [bookContents, setBookContents] = useState<{ bookName: string; text: string }[]>([]);
  const [tab, setTab] = useState<'search' | 'fullnotes'>('search');
  const [commonPage, setCommonPage] = useState(0);
  const [activeExtraBook, setActiveExtraBook] = useState<string | null>(null);
  const [extraPages, setExtraPages] = useState<Record<string, number>>({});
  const [topicResult, setTopicResult] = useState<{ common: string[]; extra: { bookName: string; points: string[] }[]; topicName: string; bookNotes?: { bookName: string; chunkNotes: string; htmlNotes: string }[] } | null>(null);
  const [topicViewMode, setTopicViewMode] = useState<'read' | 'write'>('read');
  const [topicNotesActiveBook, setTopicNotesActiveBook] = useState<string | null>(null);
  const [activeFullNotesBook, setActiveFullNotesBook] = useState<string | null>(null);
  const [fullNotesViewMode, setFullNotesViewMode] = useState<'read' | 'write'>('read');
  const _isDesktopMode = isDesktopModeOn();
  const [isLandscapeFbc, setIsLandscapeFbc] = useState<boolean>(() => {
    try { return window.matchMedia('(orientation: landscape)').matches; } catch { return false; }
  });
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = (e: MediaQueryListEvent) => setIsLandscapeFbc(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const handleRotateFbc = async () => {
    const result = await rotateScreen();
    if (result === null) alert('Screen auto-rotate is not supported on this device. You can rotate your phone manually.');
  };

  // ── Compre notes (Firestore) — loaded at mount for search ──
  const [allCompreNotes, setAllCompreNotes] = useState<Record<string, CompreNote[]>>({});
  const [compreLoading, setCompreLoading] = useState(true);
  const [_fbcFocus, _setFbcFocus] = useState(false);
  const effectiveFocusMode = isFocusMode || _fbcFocus;

  // ── Subject filter ──
  const [compreSubject, setCompreSubject] = useState<string>('all');
  const SUBJECT_FILTERS = [
    { id: 'all',    label: 'All' },
    { id: 'phy',    label: 'Physics' },
    { id: 'che',    label: 'Chemistry' },
    { id: 'bio',    label: 'Biology' },
    { id: 'his',    label: 'History' },
    { id: 'geo',    label: 'Geography' },
    { id: 'polity', label: 'Polity' },
    { id: 'eco',    label: 'Economics' },
  ] as const;

  useEffect(() => {
    const customBooks = ((settings as any)?.customBooks || []) as Array<{ id: string; name: string }>;
    customBooks.forEach(b => { if (b.id && b.name) COMPRE_BOOK_NAMES[b.id] = b.name; });

    const lucentBookIds = ((settings?.lucentNotes || []) as any[]).reduce((acc: string[], entry: any) => {
      const name = (entry.bookName?.trim()) || 'Lucent GK';
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!acc.includes(id)) acc.push(id);
      return acc;
    }, []);

    const bookIds = Array.from(new Set([
      'lucent', 'sarSangrah', 'speedyScience', 'speedySocialScience',
      ...lucentBookIds,
      ...customBooks.map(b => b.id),
    ]));

    setCompreLoading(true);
    Promise.all(
      bookIds.map(id =>
        getCompreBookNotes(id)
          .then(notes => ({ id, notes }))
          .catch(() => ({ id, notes: [] as CompreNote[] }))
      )
    ).then(results => {
      const map: Record<string, CompreNote[]> = {};
      results.forEach(r => { if (r.notes.length > 0) map[r.id] = r.notes; });
      setAllCompreNotes(map);
      setCompreLoading(false);
    }).catch(() => setCompreLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build bookContents for full compare ──
  useEffect(() => {
    const stripHtml = (s: string) => (s || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const bookMap = new Map<string, string[]>();

    const lucentNotes = ((settings?.lucentNotes || []) as any[])
      .filter((n: any) => !n.classLevel || n.classLevel === 'COMPETITION');
    lucentNotes.forEach((entry: any) => {
      const bookName = (entry.bookName?.trim()) || 'Lucent GK';
      if (!bookMap.has(bookName)) bookMap.set(bookName, []);
      const pageText = (entry.pages || []).map((p: any) => stripHtml(p.content || '')).join('\n');
      if (pageText.trim()) bookMap.get(bookName)!.push(pageText);
    });

    const customBooks = ((settings as any)?.customBooks || []) as Array<{ id: string; name: string }>;
    const labels: Record<string, string> = { ...HW_LABELS };
    customBooks.forEach(b => { if (b.id !== 'mcq') labels[b.id] = b.name; });

    const allHw = (settings?.homework || []) as any[];
    Object.entries(labels).forEach(([bookId, bookName]) => {
      const items = allHw.filter((hw: any) => hw.targetSubject === bookId && (hw.notes?.trim() || hw.chunkNotes?.trim() || hw.htmlNotes?.trim()));
      if (items.length === 0) return;
      if (!bookMap.has(bookName)) bookMap.set(bookName, []);
      items.forEach((hw: any) => bookMap.get(bookName)!.push(stripHtml(hw.notes || hw.chunkNotes || hw.htmlNotes || '')));
    });

    const contents = Array.from(bookMap.entries())
      .map(([bookName, chunks]) => ({ bookName, text: chunks.join('\n') }))
      .filter(b => b.text.trim().length > 20);

    setBookContents(contents);
    setTimeout(() => {
      if (contents.length < 2) {
        setResult({ common: [], extra: contents.map(b => ({ bookName: b.bookName, points: splitIntoPoints(b.text) })) });
      } else {
        setResult(computeFullBookComparison(contents));
      }
      setProcessing(false);
    }, 80);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Word search results ──
  const wordSearchResults = useMemo(() => {
    const word = searchWord.trim().toLowerCase();
    if (word.length < 2) return [];
    // Normalized word: strip emojis/symbols for point-level matching
    // (splitIntoPoints strips leading emojis from lines, so "📌 X" becomes "X")
    const wordNorm = word.replace(/[^\u0900-\u097fa-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

    const stripHtml = (s: string) => (s || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim();

    const bookData = new Map<string, string[]>(); // bookName → matching text chunks
    const addMatch = (bookName: string, text: string) => {
      if (!bookData.has(bookName)) bookData.set(bookName, []);
      bookData.get(bookName)!.push(text);
    };

    // 1. Lucent notes pages
    ((settings?.lucentNotes || []) as any[]).forEach((entry: any) => {
      const bookName = (entry.bookName?.trim()) || 'Lucent GK';
      (entry.pages || []).forEach((pg: any) => {
        const content = stripHtml(pg.content || '');
        if (content.toLowerCase().includes(word)) addMatch(bookName, content);
      });
    });

    // 2. Homework book-wise notes
    const customBooks = ((settings as any)?.customBooks || []) as Array<{ id: string; name: string }>;
    const labels: Record<string, string> = { ...HW_LABELS };
    customBooks.forEach(b => { if (b.id && b.name) labels[b.id] = b.name; });
    ((settings?.homework || []) as any[]).forEach((hw: any) => {
      const notes = stripHtml(hw.notes || '');
      if (notes.toLowerCase().includes(word)) {
        const bookName = labels[hw.targetSubject || ''] || 'Notes';
        addMatch(bookName, notes);
      }
    });

    // 3. Compre notes from Firestore/RTDB (filtered by subject)
    // These are handled separately to avoid splitIntoPoints stripping emoji from topicName
    const compreBookData = new Map<string, { points: string[]; totalText: string }>();
    Object.entries(allCompreNotes).forEach(([bookId, notes]) => {
      const bookName = COMPRE_BOOK_NAMES[bookId] || bookId;
      const filtered = compreSubject === 'all'
        ? (notes || [])
        : (notes || []).filter((n: CompreNote) => n.subject === compreSubject);
      filtered.forEach((note: CompreNote) => {
        const cleanTopic = (note.topicName || '').replace(/^[\s📌📚🔹🔸▪•●\-\*→>\d]+\s*/, '').trim();
        const searchText = [note.topicName, note.pageNumber !== '—' ? note.pageNumber : '', note.notes].filter(Boolean).join('\n');
        const matchesWord = searchText.toLowerCase().includes(word);
        const matchesNorm = wordNorm.length >= 2 && searchText.toLowerCase().includes(wordNorm);
        if (matchesWord || matchesNorm) {
          if (!compreBookData.has(bookName)) compreBookData.set(bookName, { points: [], totalText: '' });
          const entry = compreBookData.get(bookName)!;
          // Add topic as a point if it's meaningful, then add content lines
          if (cleanTopic && cleanTopic.length >= 2) entry.points.push(cleanTopic);
          (note.notes || '').split('\n').map(l => l.trim()).filter(l => l.length >= 3).forEach(l => entry.points.push(l));
          entry.totalText += (entry.totalText ? '\n' : '') + [cleanTopic, note.notes].filter(Boolean).join('\n');
        }
      });
    });

    const regularResults = Array.from(bookData.entries()).map(([bookName, chunks]) => {
      const allText = chunks.join('\n');
      const allPoints = splitIntoPoints(allText);
      const matchingPoints = allPoints.filter(p =>
        p.toLowerCase().includes(word) || (wordNorm.length >= 2 && p.toLowerCase().includes(wordNorm))
      );
      return { bookName, points: matchingPoints, totalText: allText };
    }).filter(r => r.points.length > 0);

    const compreResults = Array.from(compreBookData.entries())
      .map(([bookName, data]) => ({ bookName, points: data.points, totalText: data.totalText }))
      .filter(r => r.points.length > 0);

    // Merge: if a bookName appears in both, combine points
    const merged = [...regularResults];
    compreResults.forEach(cr => {
      const existing = merged.find(r => r.bookName === cr.bookName);
      if (existing) {
        existing.points = [...existing.points, ...cr.points];
        existing.totalText += '\n' + cr.totalText;
      } else {
        merged.push(cr);
      }
    });
    return merged;
  }, [searchWord, settings, allCompreNotes, compreSubject]);

  // ── All unique topics from loaded compre notes (for topic list) ──
  const allCompreTopics = useMemo(() => {
    const topicMap = new Map<string, { topicName: string; groupId?: string; books: string[]; createdAt: string }>();
    Object.entries(allCompreNotes).forEach(([bookId, notes]) => {
      const bookName = COMPRE_BOOK_NAMES[bookId] || bookId;
      const filtered = compreSubject === 'all'
        ? (notes || [])
        : (notes || []).filter(n => n.subject === compreSubject);
      filtered.forEach(note => {
        const key = note.groupId || note.topicName || note.id;
        if (!topicMap.has(key)) {
          topicMap.set(key, { topicName: note.topicName || '(Untitled)', groupId: note.groupId, books: [], createdAt: note.createdAt });
        }
        const entry = topicMap.get(key)!;
        if (!entry.books.includes(bookName)) entry.books.push(bookName);
        if (note.createdAt > entry.createdAt) entry.createdAt = note.createdAt;
      });
    });
    return Array.from(topicMap.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allCompreNotes, compreSubject]);

  // ── Click a topic → directly open comparison ──
  const handleTopicSelect = useCallback((topicName: string, groupId?: string) => {
    const bookContentsForTopic: { bookName: string; text: string }[] = [];
    const bookNotesForTopic: { bookName: string; chunkNotes: string; htmlNotes: string }[] = [];
    Object.entries(allCompreNotes).forEach(([bookId, notes]) => {
      const bookName = COMPRE_BOOK_NAMES[bookId] || bookId;
      const filtered = compreSubject === 'all'
        ? (notes || [])
        : (notes || []).filter(n => n.subject === compreSubject);
      const matchingNotes = filtered.filter(n =>
        groupId ? n.groupId === groupId : (n.topicName === topicName)
      );
      if (matchingNotes.length > 0) {
        const text = matchingNotes.map(n => n.notes || '').filter(Boolean).join('\n');
        const chunkNotes = matchingNotes.map(n => n.chunkNotes || n.notes || '').filter(Boolean).join('\n');
        const htmlNotes = matchingNotes.map(n => n.htmlNotes || '').filter(Boolean).join('\n');
        if (text.trim()) bookContentsForTopic.push({ bookName, text });
        if (chunkNotes.trim() || htmlNotes.trim()) {
          bookNotesForTopic.push({ bookName, chunkNotes, htmlNotes });
        }
      }
    });
    if (bookContentsForTopic.length === 0 && bookNotesForTopic.length === 0) return;
    const safeContents = bookContentsForTopic.length > 0 ? bookContentsForTopic : bookNotesForTopic.map(b => ({ bookName: b.bookName, text: b.chunkNotes }));
    const comparison = safeContents.length >= 2
      ? computeFullBookComparison(safeContents)
      : { common: [], extra: safeContents.map(b => ({ bookName: b.bookName, points: splitIntoPoints(b.text) })) };
    setTopicResult({ ...comparison, topicName, bookNotes: bookNotesForTopic });
    setActiveExtraBook(comparison.extra[0]?.bookName ?? null);
    setTopicNotesActiveBook(bookNotesForTopic[0]?.bookName ?? null);
    setActiveFullNotesBook(bookNotesForTopic[0]?.bookName ?? null);
    setTopicViewMode('read');
    setFullNotesViewMode('read');
    setExtraPages({});
    setCommonPage(0);
    setTab('fullnotes');
  }, [allCompreNotes, compreSubject]);

  // ── Open word comparison across books ──
  const openWordCompare = useCallback(() => {
    if (wordSearchResults.length === 0) return;
    const contents = wordSearchResults.map(r => ({ bookName: r.bookName, text: r.totalText }));
    const comparison = contents.length >= 2
      ? computeFullBookComparison(contents)
      : { common: [], extra: contents.map(b => ({ bookName: b.bookName, points: splitIntoPoints(b.text) })) };
    setTopicResult({ ...comparison, topicName: searchWord.trim() });
    setActiveExtraBook(comparison.extra[0]?.bookName ?? null);
    setExtraPages({});
    setCommonPage(0);
    setTab('fullnotes');
  }, [wordSearchResults, searchWord]);


  const paginate = (points: string[], page: number) => points.slice(page * POINTS_PER_PAGE, (page + 1) * POINTS_PER_PAGE);
  const totalPg = (points: string[]) => Math.max(1, Math.ceil(points.length / POINTS_PER_PAGE));
  const activeResult = topicResult ?? result;
  const activeExtraData = activeResult?.extra.find(e => e.bookName === activeExtraBook);
  const extraCurPage = extraPages[activeExtraBook ?? ''] ?? 0;

  // ── Highlight word in text ──
  const highlight = (text: string, word: string) => {
    if (!word || word.length < 2) return <>{text}</>;
    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part)
            ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
            : <span key={i}>{part}</span>
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[250] flex flex-col overflow-hidden animate-in fade-in" style={{ background: (settings as any)?.appBackground || '#ffffff' }}>
      {/* Floating focus toggle button */}
      <button
        onClick={() => _setFbcFocus(v => !v)}
        style={{
          position: 'fixed',
          bottom: '88px',
          right: '16px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: effectiveFocusMode ? 'rgba(79,70,229,0.95)' : 'rgba(15,23,42,0.88)',
          border: `2.5px solid ${effectiveFocusMode ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.5)'}`,
          backdropFilter: 'blur(10px)',
          zIndex: 9200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
        title={effectiveFocusMode ? 'Exit Focus' : 'Focus Mode'}
      >
        <span style={{ fontSize: '18px', pointerEvents: 'none' }}>{effectiveFocusMode ? '↩' : '🎯'}</span>
        <span style={{ position: 'absolute', top: '3px', right: '3px', width: '10px', height: '10px', borderRadius: '50%', background: effectiveFocusMode ? '#6366f1' : '#22c55e', border: '2px solid #fff', pointerEvents: 'none' }} />
      </button>

      {/* Header — hidden in focus mode */}
      {!effectiveFocusMode && (
        <div className="text-white px-4 py-3 flex items-center gap-3 shrink-0 shadow-xl" style={{ background: topBarGrad || getCompareTierGrad(user) }}>
          <div className="p-2 rounded-xl bg-white/10">
            <Crown size={18} className="text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-black text-base leading-tight">Full Book Compare</h2>
              <span className="text-[9px] font-black bg-yellow-400 text-black px-2 py-0.5 rounded-full tracking-wide">ULTRA</span>
            </div>
            <p className="text-[11px] text-white/70 truncate">
              {topicResult
                ? `"${topicResult.topicName}" · ${topicResult.common.length} common · ${topicResult.extra.reduce((a, e) => a + e.points.length, 0)} extra`
                : compreLoading
                  ? 'Loading notes…'
                  : `${bookContents.length} books ready — search a word`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>
      )}

      {/* ── TOPIC COMPARE breadcrumb + tabs — hidden in focus mode ── */}
      {!effectiveFocusMode && topicResult && (
        <>
          <div className="flex items-center gap-2 px-3 pt-3 shrink-0">
            <button
              onClick={() => { setTopicResult(null); setTab('search'); }}
              className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full active:scale-95 transition-all border"
              style={{ color: subColor, background: subColorLight, borderColor: subColorBorder }}
            >
              <ChevronLeft size={13} /> Back
            </button>
            <span className="text-[12px] font-black text-slate-700 truncate">🔍 "{topicResult.topicName}"</span>
          </div>

          <div className="flex bg-slate-100 p-1 gap-1 shrink-0 mx-3 mt-2 rounded-xl overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            <button
              onClick={() => setTab('fullnotes')}
              className={`shrink-0 flex-1 py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${tab === 'fullnotes' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}
            >
              <Layers size={11} /> Full Notes
            </button>
          </div>
        </>
      )}

      {/* ══════ CONTENT AREA ══════ */}
      <div className="flex-1 overflow-y-auto pb-8">

        {/* ── WORD SEARCH VIEW ── */}
        {!topicResult && (
          <div className="px-3 pt-4 space-y-3">
            {/* Subject filter pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
              {SUBJECT_FILTERS.map(sf => (
                <button
                  key={sf.id}
                  onClick={() => { setCompreSubject(sf.id); }}
                  className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border-2 transition-all"
                  style={compreSubject === sf.id ? { background: subColor, color: 'white', borderColor: subColor } : { background: 'white', color: subColor, borderColor: subColorBorder }}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            {/* Loading indicator */}
            {compreLoading && (
              <div className="flex items-center gap-2 px-2 text-[11px] font-semibold" style={{ color: subColor }}>
                <Loader2 size={13} className="animate-spin" />
                Loading Compre Notes…
              </div>
            )}

            {/* Empty state — show saved topics list */}
            {!searchWord && (
              <div className="space-y-3">
                {compreLoading ? null : allCompreTopics.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: subColor }}>
                        📚 Saved Topics ({allCompreTopics.length})
                      </p>
                      <p className="text-[10px] text-slate-400">Click → Compare</p>
                    </div>
                    <div className="space-y-2">
                      {allCompreTopics.map(topic => {
                        const cleanName = topic.topicName.replace(/^[\s📌📚🔹🔸▪•●\-\*→>\d]+\s*/, '').trim() || topic.topicName;
                        const dateStr = topic.createdAt ? new Date(topic.createdAt).toLocaleDateString('hi-IN', { day: '2-digit', month: 'short' }) : '';
                        return (
                          <button
                            key={topic.groupId || topic.topicName}
                            onClick={() => handleTopicSelect(topic.topicName, topic.groupId)}
                            className="w-full text-left bg-white border-2 active:scale-[0.98] rounded-2xl px-4 py-3 transition-all shadow-sm group"
                            style={{ borderColor: subColorBorder }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-slate-800 leading-snug group-hover:text-violet-700 transition-colors truncate">
                                  {topic.topicName}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {topic.books.map(b => (
                                    <span key={b} className="text-[10px] font-bold border px-2 py-0.5 rounded-full" style={{ background: subColorLight, color: subColor, borderColor: subColorBorder }}>
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-1">
                                <span className="text-[10px] text-slate-400">{dateStr}</span>
                                <span className="text-[10px] font-black text-white px-2 py-0.5 rounded-full" style={{ background: subColor }}>
                                  {topic.books.length} book{topic.books.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 text-center">Or search any word in the bar above</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-slate-400">
                    <Search size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-black text-slate-500 text-base">Word Search</p>
                    <p className="text-xs mt-2 leading-relaxed text-slate-400">
                      Type any word above.<br />
                      All notes and points containing that word across all books will appear.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {['Mughal', 'Congress', 'Photosynthesis', 'DNA', 'संविधान', 'Newton'].map(ex => (
                        <button
                          key={ex}
                          onClick={() => setSearchWord(ex)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                          style={{ background: subColorLight, color: subColor }}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search too short */}
            {searchWord && searchWord.trim().length < 2 && (
              <p className="text-center text-xs text-slate-400 py-4">Type at least 2 characters…</p>
            )}

            {/* No results */}
            {searchWord.trim().length >= 2 && wordSearchResults.length === 0 && !compreLoading && (
              <div className="text-center py-14 text-slate-400">
                <Search size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-black text-slate-500">"{searchWord}" not found</p>
                <p className="text-xs mt-2">No notes for this word found in any book. Try a different word.</p>
              </div>
            )}

            {/* Results */}
            {wordSearchResults.length > 0 && (
              <>
                {/* Summary bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: subColor }}>
                    {wordSearchResults.reduce((a, r) => a + r.points.length, 0)} points — found in {wordSearchResults.length} book{wordSearchResults.length !== 1 ? 's' : ''}
                  </p>
                  {wordSearchResults.length >= 2 && (
                    <button
                      onClick={openWordCompare}
                      className="flex items-center gap-1.5 text-white px-4 py-2 rounded-2xl text-xs font-black active:scale-95 transition-all shadow-md"
                      style={{ background: subColor }}
                    >
                      <GitCompare size={13} /> Compare Books
                    </button>
                  )}
                </div>

                {/* Per-book results */}
                {wordSearchResults.map(res => (
                  <div key={res.bookName} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    {/* Book header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: subColorLight, borderColor: subColorBorder }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: subColorLight }}>
                        <BookOpen size={15} style={{ color: subColor }} />
                      </div>
                      <p className="flex-1 text-sm font-black text-slate-800">{res.bookName}</p>
                      <span className="shrink-0 text-[11px] font-black text-white px-2.5 py-1 rounded-full" style={{ background: subColor }}>
                        {res.points.length} points
                      </span>
                    </div>

                    {/* Matching points */}
                    <div className="p-3 space-y-1.5">
                      {res.points.map((point, pi) => (
                        <div key={pi} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed py-1 border-b border-slate-50 last:border-0">
                          <span className="shrink-0 text-[10px] font-black mt-0.5 w-5 text-right" style={{ color: subColor }}>{pi + 1}.</span>
                          <span>{highlight(point, searchWord.trim())}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── FULL NOTES TAB ── */}
        {tab === 'fullnotes' && topicResult && (
          <div className="px-3 pt-3 space-y-3">
            {/* Book selector pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
              {(topicResult.bookNotes || []).map(({ bookName }) => (
                <button
                  key={bookName}
                  onClick={() => setActiveFullNotesBook(bookName)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black border-2 transition-all ${activeFullNotesBook === bookName ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'}`}
                >
                  <Layers size={12} /> {bookName}
                </button>
              ))}
            </div>

            {(() => {
              const activeBookNote = (topicResult.bookNotes || []).find(bn => bn.bookName === activeFullNotesBook);
              if (!activeBookNote) return (
                <div className="text-center py-14 text-slate-400">
                  <Layers size={44} className="mx-auto mb-3 opacity-20" />
                  <p className="font-black text-slate-500">Select a book above</p>
                </div>
              );
              const hasHtml = !!activeBookNote.htmlNotes?.trim();
              const hasChunk = !!activeBookNote.chunkNotes?.trim();
              const fullNotesPointCount = splitIntoPoints(activeBookNote.chunkNotes || activeBookNote.htmlNotes?.replace(/<[^>]+>/g,'') || '').length;
              return (
                <>
                  {/* Header bar */}
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <Layers size={18} className="text-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-blue-800">{activeBookNote.bookName}</p>
                      <p className="text-[10px] text-blue-500">"{topicResult.topicName}" — Complete chapter notes{fullNotesPointCount > 0 ? ` · ${fullNotesPointCount} points` : ''}</p>
                    </div>
                    {/* Rotate */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={handleRotateFbc}
                        className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-black transition-all border ${isLandscapeFbc ? 'bg-green-500 text-white border-green-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-green-300'}`}
                        title="Screen Rotate"
                      >
                        <RotateCcw size={10} /> Rot
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  {hasChunk ? (
                    <ChunkedNotesReader
                      key={`fbc-fullnotes-${activeFullNotesBook}`}
                      content={activeBookNote.chunkNotes}
                      topBarLabel={`${activeBookNote.bookName} — Full Notes`}
                      language="hi-IN"
                    />
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Layers size={36} className="mx-auto mb-3 opacity-20" />
                      <p className="font-black text-slate-500 text-sm">No notes available</p>
                      <p className="text-xs mt-2">Notes have not been added for this topic in this book.</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}


      </div>
    </div>
  );
};
