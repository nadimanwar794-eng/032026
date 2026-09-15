// routineAutoTrack.ts
// Automatic per-page read & per-lesson MCQ tracking for My Routine.
// Written by StudentDashboard hooks; read by MyRoutine to show auto progress.

const AUTO_KEY = 'nst_routine_auto_v1';

interface AutoTrackData {
  pageReads:    Record<string, number>;                                          // `${lessonId}__${pageIdx}` → timestamp
  mcqDone:      Record<string, number>;                                          // lessonId → timestamp (lesson-level, kept for compat)
  mcqScore:     Record<string, { correct: number; total: number; ts: number }>;  // lessonId → latest running score (lesson-level)
  pageMcqDone:  Record<string, number>;                                          // `${lessonId}__${pageIdx}` → timestamp (per-page)
  pageMcqScore: Record<string, { correct: number; total: number; ts: number }>;  // `${lessonId}__${pageIdx}` → score (per-page)
  pageMcqBest:  Record<string, { correct: number; total: number; ts: number }>;  // `${lessonId}__${pageIdx}` → best-ever score (per-page)
  timings:      Record<string, number>;                                          // `${lessonId}__${pageIdx}` → accumulated seconds
  mistakes:     Record<string, number>;                                          // lessonId → wrong-answer count
  masks:        Record<string, number>;                                          // lessonId → mask-used count
  lessonRewarded: Record<string, boolean>;                                       // lessonId → 50-coin reward already given
}

function load(): AutoTrackData {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pageReads:      parsed.pageReads      || {},
        mcqDone:        parsed.mcqDone        || {},
        mcqScore:       parsed.mcqScore       || {},
        pageMcqDone:    parsed.pageMcqDone    || {},
        pageMcqScore:   parsed.pageMcqScore   || {},
        pageMcqBest:    parsed.pageMcqBest    || {},
        timings:        parsed.timings        || {},
        mistakes:       parsed.mistakes       || {},
        masks:          parsed.masks          || {},
        lessonRewarded: parsed.lessonRewarded || {},
      };
    }
  } catch {}
  return { pageReads: {}, mcqDone: {}, mcqScore: {}, pageMcqDone: {}, pageMcqScore: {}, pageMcqBest: {}, timings: {}, mistakes: {}, masks: {}, lessonRewarded: {} };
}

function save(data: AutoTrackData): void {
  try { localStorage.setItem(AUTO_KEY, JSON.stringify(data)); } catch {}
}

/** Called when user navigates to a page in the Lucent viewer (credit-gated — only called after cost deducted) */
export function markRoutinePageRead(lessonId: string, pageIdx: number): void {
  if (!lessonId) return;
  const d = load();
  const key = `${lessonId}__${pageIdx}`;
  if (!d.pageReads[key]) {
    d.pageReads[key] = Date.now();
    save(d);
  }
}

/** Called (credit-gated) when user first answers an MCQ for a lesson — marks lesson-level MCQ done (backward compat) */
export function markRoutineMcqDone(lessonId: string): void {
  if (!lessonId) return;
  const d = load();
  if (!d.mcqDone[lessonId]) {
    d.mcqDone[lessonId] = Date.now();
    save(d);
  }
}

/** Called when user first answers an MCQ on a specific page — marks that page's MCQ as done */
export function markRoutinePageMcqDone(lessonId: string, pageIdx: number): void {
  if (!lessonId) return;
  const d = load();
  const key = `${lessonId}__${pageIdx}`;
  if (!d.pageMcqDone[key]) {
    d.pageMcqDone[key] = Date.now();
    save(d);
  }
  // Also set lesson-level for backward compat
  if (!d.mcqDone[lessonId]) {
    d.mcqDone[lessonId] = Date.now();
    save(d);
  }
}

/**
 * Called on EVERY MCQ option click to update the running score for this lesson (lesson-level).
 * `correct` and `total` are the cumulative counts including the just-answered question.
 */
export function updateRoutineMcqScore(lessonId: string, correct: number, total: number): void {
  if (!lessonId) return;
  const d = load();
  d.mcqScore[lessonId] = { correct, total, ts: Date.now() };
  save(d);
}

/**
 * Called on EVERY MCQ option click to update the running score for a specific page.
 * `correct` and `total` are cumulative counts for that page.
 * Also updates best-ever score if this attempt beats the previous best.
 */
export function updateRoutinePageMcqScore(lessonId: string, pageIdx: number, correct: number, total: number): void {
  if (!lessonId) return;
  const d = load();
  const key = `${lessonId}__${pageIdx}`;
  d.pageMcqScore[key] = { correct, total, ts: Date.now() };
  // Update best score if this attempt is better (higher %)
  const pct     = total > 0 ? correct / total : 0;
  const prev    = d.pageMcqBest?.[key];
  const prevPct = prev && prev.total > 0 ? prev.correct / prev.total : -1;
  if (pct > prevPct) {
    if (!d.pageMcqBest) d.pageMcqBest = {};
    d.pageMcqBest[key] = { correct, total, ts: Date.now() };
  }
  save(d);
}

/** Returns 0–100 for the current MCQ attempt on this page, or null if not attempted */
export function getPageMcqPercent(lessonId: string, pageIdx: number): number | null {
  const s = getRoutinePageMcqScore(lessonId, pageIdx);
  if (!s || s.total === 0) return null;
  return Math.round((s.correct / s.total) * 100);
}

/** Returns 0–100 for the best-ever MCQ attempt on this page, or null if never attempted */
export function getPageMcqBestPercent(lessonId: string, pageIdx: number): number | null {
  const d = load();
  const b = d.pageMcqBest?.[`${lessonId}__${pageIdx}`];
  if (!b || b.total === 0) return null;
  return Math.round((b.correct / b.total) * 100);
}

/**
 * Average MCQ % across all pages that have MCQ data. Returns null if no page has MCQ data.
 * Used as the "page component" of the lesson mastery %.
 */
export function getLessonPageAvgPercent(lessonId: string, totalPages: number): number | null {
  let sum = 0, count = 0;
  for (let i = 0; i < totalPages; i++) {
    const pct = getPageMcqPercent(lessonId, i);
    if (pct !== null) { sum += pct; count++; }
  }
  return count > 0 ? Math.round(sum / count) : null;
}

/**
 * Best-ever lesson average (best per-page % averaged across pages that have data).
 */
export function getLessonBestPageAvgPercent(lessonId: string, totalPages: number): number | null {
  let sum = 0, count = 0;
  for (let i = 0; i < totalPages; i++) {
    const pct = getPageMcqBestPercent(lessonId, i);
    if (pct !== null) { sum += pct; count++; }
  }
  return count > 0 ? Math.round(sum / count) : null;
}

/** Returns the latest MCQ score for a lesson (lesson-level), or null if not yet attempted */
export function getRoutineMcqScore(lessonId: string): { correct: number; total: number; ts: number } | null {
  const d = load();
  return d.mcqScore[lessonId] ?? null;
}

/** Returns the MCQ score for a specific page, or null if not yet attempted */
export function getRoutinePageMcqScore(lessonId: string, pageIdx: number): { correct: number; total: number; ts: number } | null {
  const d = load();
  return d.pageMcqScore[`${lessonId}__${pageIdx}`] ?? null;
}

/** Returns true if that specific page has been read */
export function isRoutinePageRead(lessonId: string, pageIdx: number): boolean {
  const d = load();
  return !!d.pageReads[`${lessonId}__${pageIdx}`];
}

/** Returns true if at least one MCQ session was done for this lesson (lesson-level) */
export function isRoutineMcqDone(lessonId: string): boolean {
  const d = load();
  return !!d.mcqDone[lessonId];
}

/** Returns true if MCQ was done on a specific page */
export function isRoutinePageMcqDone(lessonId: string, pageIdx: number): boolean {
  const d = load();
  return !!d.pageMcqDone[`${lessonId}__${pageIdx}`];
}

/**
 * Count how many pages (with MCQ available) have their MCQ done.
 * pagesWithMcq: array of page indices that have MCQ content.
 */
export function countPageMcqDone(lessonId: string, pagesWithMcq: number[]): number {
  const d = load();
  return pagesWithMcq.filter(i => !!d.pageMcqDone[`${lessonId}__${i}`]).length;
}

/** Check page box: green = page read AND that page's MCQ done (per-page tracking) */
export function getAutoPageBoxState(lessonId: string, pageIdx: number): 'green' | 'orange' | 'gray' {
  const d = load();
  const read    = !!d.pageReads[`${lessonId}__${pageIdx}`];
  const mcqDone = !!d.pageMcqDone[`${lessonId}__${pageIdx}`];
  if (read && mcqDone) return 'green';
  if (read) return 'orange';
  return 'gray';
}

/** Returns how many pages of a lesson are fully complete (read + page MCQ done) */
export function getLessonCompletedPages(lessonId: string, totalPages: number): number {
  const d = load();
  let count = 0;
  for (let i = 0; i < totalPages; i++) {
    const read = !!d.pageReads[`${lessonId}__${i}`];
    const mcq  = !!d.pageMcqDone[`${lessonId}__${i}`];
    if (read && mcq) count++;
  }
  return count;
}

/** Returns true if ALL pages are complete (all read + all page MCQs done or no MCQ pages) */
export function isLessonAutoComplete(lessonId: string, totalPages: number): boolean {
  if (totalPages === 0) return false;
  return getLessonCompletedPages(lessonId, totalPages) >= totalPages;
}

/** Full data snapshot — for efficient batch reads in MyRoutine */
export function getAutoTrackSnapshot(): AutoTrackData {
  return load();
}

// ── Time tracking ─────────────────────────────────────────────────────────────

/** Add seconds of reading time to a specific page */
export function addPageTime(lessonId: string, pageIdx: number, seconds: number): void {
  if (!lessonId || seconds <= 0) return;
  const d = load();
  const key = `${lessonId}__${pageIdx}`;
  d.timings[key] = (d.timings[key] || 0) + seconds;
  save(d);
}

/** Get accumulated reading seconds for a specific page */
export function getPageTime(lessonId: string, pageIdx: number): number {
  const d = load();
  return d.timings[`${lessonId}__${pageIdx}`] || 0;
}

/** Reset accumulated reading seconds (and unmark read) for a specific page */
export function resetPageTime(lessonId: string, pageIdx: number): void {
  if (!lessonId) return;
  const d = load();
  const key = `${lessonId}__${pageIdx}`;
  delete d.timings[key];
  delete d.pageReads[key];
  save(d);
}

/** Calculate minimum required reading seconds based on exact word count (120 WPM / 2 words per second) */
export function calculatePageRequiredReadingSec(pageOrContent: any): number {
  if (!pageOrContent) return 15;
  if (typeof pageOrContent === 'object' && typeof pageOrContent.requiredReadingSec === 'number' && pageOrContent.requiredReadingSec > 0) {
    return Math.max(10, pageOrContent.requiredReadingSec);
  }

  let rawText = '';
  if (typeof pageOrContent === 'string') {
    rawText = pageOrContent;
  } else if (typeof pageOrContent === 'object') {
    rawText = pageOrContent.chunkNotes || pageOrContent.content || pageOrContent.notes || pageOrContent.htmlNotes || pageOrContent.text || '';
  }

  if (!rawText || typeof rawText !== 'string') return 15;

  const textOnly = rawText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');

  const words = textOnly.trim().split(/\s+/).filter(w => w.length > 0 && !/^[\W_]+$/.test(w));
  const wordCount = words.length;

  if (wordCount <= 10) return 15;

  // Realistic reading speed: 120 words/min (2 words per second -> Math.round((wordCount / 120) * 60) = Math.round(wordCount / 2))
  // Dynamically scales with page content: short pages = less time (e.g. 45s, 1m 20s), long pages = more time (e.g. 2m 40s, 3m 30s, 6m+)
  let dynamicReqSec = Math.round((wordCount / 120) * 60);
  if (dynamicReqSec < 15) dynamicReqSec = 15;

  return dynamicReqSec;
}

/** Get total reading seconds for an entire lesson */
export function getLessonTotalTime(lessonId: string, totalPages: number): number {
  const d = load();
  let total = 0;
  for (let i = 0; i < totalPages; i++) {
    total += d.timings[`${lessonId}__${i}`] || 0;
  }
  return total;
}

// ── Mistakes & Masks ──────────────────────────────────────────────────────────

/** Increment wrong-answer count for a lesson */
export function recordMistake(lessonId: string): void {
  if (!lessonId) return;
  const d = load();
  d.mistakes[lessonId] = (d.mistakes[lessonId] || 0) + 1;
  save(d);
}

/** Increment mask-used count for a lesson */
export function recordMask(lessonId: string): void {
  if (!lessonId) return;
  const d = load();
  d.masks[lessonId] = (d.masks[lessonId] || 0) + 1;
  save(d);
}

export function getMistakeCount(lessonId: string): number {
  return load().mistakes[lessonId] || 0;
}

export function getMaskCount(lessonId: string): number {
  return load().masks[lessonId] || 0;
}

// ── Star rating (1–5) ─────────────────────────────────────────────────────────

/** Convert MCQ score to 1–5 star rating (lesson-level) */
export function getStarRating(lessonId: string): number | null {
  const d = load();
  const s = d.mcqScore[lessonId];
  if (!s || s.total === 0) return null;
  const pct = s.correct / s.total;
  if (pct >= 0.9) return 5;
  if (pct >= 0.75) return 4;
  if (pct >= 0.55) return 3;
  if (pct >= 0.35) return 2;
  return 1;
}

// ── Lesson reward tracking ────────────────────────────────────────────────────

/** Returns true if 50-coin lesson-complete reward was already given */
export function isLessonRewarded(lessonId: string): boolean {
  return !!load().lessonRewarded[lessonId];
}

/** Mark lesson as rewarded (50 coins already given) */
export function markLessonRewarded(lessonId: string): void {
  if (!lessonId) return;
  const d = load();
  d.lessonRewarded[lessonId] = true;
  save(d);
}

// ── Progress display helpers ──────────────────────────────────────────────────

/** Format seconds into human-readable duration, e.g. "2h 18m" or "8m 22s" */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/**
 * 5-level color system based on completion %:
 * 0% → Red, 1-25% → Orange, 26-50% → Yellow, 51-75% → Blue, 76-100% → Green
 */
export function getProgressColor5(pct: number): { bg: string; text: string; border: string; label: string } {
  if (pct >= 76) return { bg: '#dcfce7', text: '#16a34a', border: '#86efac', label: 'Completed' };
  if (pct >= 51) return { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd', label: 'Almost Done' };
  if (pct >= 26) return { bg: '#fef9c3', text: '#ca8a04', border: '#fde047', label: 'Half Read' };
  if (pct >= 1)  return { bg: '#ffedd5', text: '#ea580c', border: '#fdba74', label: 'Started' };
  return { bg: '#f1f5f9', text: '#94a3b8', border: '#e2e8f0', label: 'Not Started' };
}

/** 5 Tick marks based on %: 100%=✓✓✓✓✓, 80%=✓✓✓✓, 60%=✓✓✓, 40%=✓✓, 1-39%=✓ */
export function getProgressTicks(pct: number): string {
  if (pct >= 100) return '✓✓✓✓✓';
  if (pct >= 80)  return '✓✓✓✓';
  if (pct >= 60)  return '✓✓✓';
  if (pct >= 40)  return '✓✓';
  if (pct >= 1)   return '✓';
  return '';
}

/** Aggregate read + time stats for a single lesson (used on lesson cards) */
export function getLessonStats(lessonId: string, totalPages: number): {
  pagesRead: number; totalTime: number; pct: number;
} {
  const d = load();
  let pagesRead = 0;
  let totalTime = 0;
  for (let i = 0; i < totalPages; i++) {
    const key = `${lessonId}__${i}`;
    if (d.pageReads[key]) pagesRead++;
    totalTime += d.timings[key] || 0;
  }
  const pct = totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;
  return { pagesRead, totalTime, pct };
}

/** Aggregate read + time stats across multiple lessons (for subject / book cards) */
export function getMultiLessonStats(lessons: Array<{ id: string; pageCount: number }>): {
  totalLessons: number; lessonsStarted: number; totalPages: number; pagesRead: number; totalTime: number; pct: number;
} {
  const d = load();
  let totalPages = 0, pagesRead = 0, totalTime = 0, lessonsStarted = 0;
  for (const { id, pageCount } of lessons) {
    let started = false;
    for (let i = 0; i < pageCount; i++) {
      const key = `${id}__${i}`;
      if (d.pageReads[key]) { pagesRead++; started = true; }
      totalTime += d.timings[key] || 0;
    }
    totalPages += pageCount;
    if (started) lessonsStarted++;
  }
  const pct = totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;
  return { totalLessons: lessons.length, lessonsStarted, totalPages, pagesRead, totalTime, pct };
}
