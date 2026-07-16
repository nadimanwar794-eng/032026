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
        timings:        parsed.timings        || {},
        mistakes:       parsed.mistakes       || {},
        masks:          parsed.masks          || {},
        lessonRewarded: parsed.lessonRewarded || {},
      };
    }
  } catch {}
  return { pageReads: {}, mcqDone: {}, mcqScore: {}, pageMcqDone: {}, pageMcqScore: {}, timings: {}, mistakes: {}, masks: {}, lessonRewarded: {} };
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
 */
export function updateRoutinePageMcqScore(lessonId: string, pageIdx: number, correct: number, total: number): void {
  if (!lessonId) return;
  const d = load();
  const key = `${lessonId}__${pageIdx}`;
  d.pageMcqScore[key] = { correct, total, ts: Date.now() };
  save(d);
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
