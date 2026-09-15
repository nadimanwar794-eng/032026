// Revision Hub V2 — page-aware MCQ attempt tracker with spaced-repetition scheduling.
// Stores per-topic, per-chapter, per-page wrong-answer history + revision schedule so
// the Revision Hub can show students what to review today (notes) and what to practice
// tomorrow (MCQ), cycling until the topic is mastered.
//
// Storage: localStorage key `nst_revision_tracker_v2` → JSON map keyed by
// `${subjectId}::${chapterId}::${pageKey}::${topic}`.

import type { MCQItem } from '../types';
import type { RevisionConfig } from '../types';
import {
  getTrackedQuestionKey,
  normalizeMcqForTracking,
} from './mcqStructure';
import { safeSetItem, pruneLocalStorageForQuota } from './safeUtils';

export interface TopicBucket {
  subjectId: string;
  subjectName?: string;
  chapterId: string;
  chapterTitle?: string;
  pageKey: string;       // either an actual page id or a synthetic key when no pages exist
  pageLabel?: string;
  topic: string;
  total: number;
  correct: number;
  lastAttemptAt: number;
  // Up to 10 most-recent wrong question stems — used as extra search keywords.
  // `wrongCycles` is incremented every time the student gets THIS specific
  // question wrong, so the Revision Hub can prioritise repeat-offenders.
  wrongQuestions: {
    question: string;
    questionNumber?: string;
    statements?: string[];
    correctOption?: string;
    allOptions?: string[];
    correctAnswer?: number;
    explanation?: string;
    at: number;
    wrongCycles?: number;
  }[];
  // Spaced-repetition schedule ------------------------------------------------
  // 'NOTES'  → student should read notes for this topic today
  // 'MCQ'    → student should practice MCQ for this topic today
  stage?: 'NOTES' | 'MCQ';
  // Unix ms timestamp when this item becomes due for the next review
  nextDueAt?: number;
  // How many full cycles (notes → MCQ) the student has completed for this topic
  cycleCount?: number;
  // After the student answers EVERY question in this bucket correctly we
  // enter a long-spacing maintenance mode: notes resurface in 10 days and the
  // MCQ rerun resurfaces in 20 days. These two timestamps drive that.
  longSpacingNotesAt?: number;
  longSpacingMcqAt?: number;
  // Last scored tier — set by markMcqDone / applyInitialSchedule so the
  // Performance tab shows the tier the student ACTUALLY scored, not a
  // recalculated cumulative ratio.
  lastTier?: 'weak' | 'average' | 'strong' | 'mastered';
  // Raw accuracy (0–1) from the last completed MCQ session.
  lastSessionAccuracy?: number;
  // Last 3 MCQ sessions history — newest first. Used to show trend in Performance tab.
  sessionHistory?: { accuracy: number; tier: 'weak' | 'average' | 'strong' | 'mastered'; at: number }[];
  // Last local/cloud mutation time. Used to merge an offline device with Firebase.
  updatedAt?: number;
  // Canonical tracker map key
  key?: string;
  _key?: string;
}

export type TrackerMap = Record<string, TopicBucket>;

const STORAGE_KEY = 'nst_revision_tracker_v2';
const LEGACY_STORAGE_KEY = STORAGE_KEY;
let activeUserId: string | null = null;

// In-memory cache to guarantee zero data loss during session or if storage fails
const memoryTrackerCache: Record<string, TrackerMap> = {};

// Hydration state flags for device-switch and initial cloud load
let isRevisionHydrating = false;
let isRevisionHydrated = false;

export function getIsRevisionHydrating(): boolean {
  return isRevisionHydrating;
}

export function getIsRevisionHydrated(): boolean {
  return isRevisionHydrated;
}

export function setRevisionHydrationState(hydrating: boolean, hydrated: boolean): void {
  isRevisionHydrating = hydrating;
  isRevisionHydrated = hydrated;
  try {
    window.dispatchEvent(new CustomEvent('iic-revision-hydration-state', {
      detail: { hydrating, hydrated, activeUserId }
    }));
  } catch {}
}

function getEffectiveUserId(): string | null {
  if (activeUserId) return activeUserId;
  try {
    const cur = typeof localStorage !== 'undefined' ? localStorage.getItem('nst_current_user') : null;
    if (cur) {
      const u = JSON.parse(cur);
      if (u?.id) return String(u.id);
    }
    const prof = typeof localStorage !== 'undefined' ? localStorage.getItem('nst_user_profile') : null;
    if (prof) {
      const p = JSON.parse(prof);
      if (p?.id) return String(p.id);
    }
    const lastId = typeof localStorage !== 'undefined' ? localStorage.getItem('nst_last_user_id') : null;
    if (lastId) return String(lastId);
  } catch {}
  return null;
}

function userStorageKey(userId?: string | null): string {
  const uid = userId || activeUserId || getEffectiveUserId();
  return uid ? `${STORAGE_KEY}_${encodeURIComponent(uid)}` : STORAGE_KEY;
}

/**
 * Select the account whose revision tracker is active on this device.
 *
 * Revision Hub used to keep one global localStorage record, which could both
 * leak data between accounts and disappear on a cache clear. Keep a one-time
 * migration path for an existing install, then all future writes are scoped
 * to the Firebase user id.
 */
export function setRevisionTrackerUser(userId: string | null | undefined): void {
  activeUserId = userId ? String(userId) : null;
  if (!activeUserId) return;

  try {
    const scopedKey = userStorageKey(activeUserId);
    if (localStorage.getItem(scopedKey) === null) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(scopedKey, legacy);
      }
    }
  } catch {}
}

/**
 * Compacts a TrackerMap so it respects the 5MB browser quota:
 * - Keeps at most 6 recent wrong questions per bucket with bounded string lengths
 * - Keeps at most 5 recent session history records
 */
export function compactTrackerMap(map: TrackerMap, strict: boolean = false): TrackerMap {
  const result: TrackerMap = {};
  const maxWrong = strict ? 3 : 6;
  const maxStrLen = strict ? 250 : 500;

  for (const [key, bucket] of Object.entries(map || {})) {
    if (!bucket) continue;
    const wrongQuestions = Array.isArray(bucket.wrongQuestions)
      ? bucket.wrongQuestions.slice(-maxWrong).map((wrong, idx) => ({
          question: (wrong.question || '').slice(0, maxStrLen),
          questionNumber: wrong.questionNumber,
          statements: Array.isArray(wrong.statements)
            ? wrong.statements.slice(0, 4).map(s => String(s || '').slice(0, 200))
            : undefined,
          correctOption: (wrong.correctOption || '').slice(0, 160),
          allOptions: Array.isArray(wrong.allOptions)
            ? wrong.allOptions.slice(0, 5).map(o => String(o || '').slice(0, 160))
            : undefined,
          correctAnswer: wrong.correctAnswer,
          explanation: (wrong.explanation || '').slice(0, maxStrLen),
          at: wrong.at || Date.now(),
          wrongCycles: wrong.wrongCycles || 1,
        }))
      : [];

    const sessionHistory = Array.isArray(bucket.sessionHistory)
      ? bucket.sessionHistory.slice(-5)
      : undefined;

    result[key] = {
      ...bucket,
      key,
      _key: key,
      wrongQuestions,
      sessionHistory,
    };
  }
  return result;
}

function safeRead(): TrackerMap {
  const currentKey = userStorageKey();
  try {
    let raw = localStorage.getItem(currentKey);
    // If not found in user-scoped key, check legacy key and candidate keys
    if (!raw && currentKey !== LEGACY_STORAGE_KEY) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        try { localStorage.setItem(currentKey, raw); } catch {}
      }
    }
    if (!raw) {
      // Fallback: check for any scoped tracker key
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(`${STORAGE_KEY}_`)) {
            const candidate = localStorage.getItem(k);
            if (candidate && candidate.length > 2) {
              raw = candidate;
              break;
            }
          }
        }
      } catch {}
      if (!raw) {
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      }
    }

    if (!raw) {
      // Fallback to in-memory cache if available
      return memoryTrackerCache[currentKey] ? { ...memoryTrackerCache[currentKey] } : (memoryTrackerCache[LEGACY_STORAGE_KEY] ? { ...memoryTrackerCache[LEGACY_STORAGE_KEY] } : {});
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return memoryTrackerCache[currentKey] ? { ...memoryTrackerCache[currentKey] } : {};
    }

    // Backfill the structured MCQ fields when an older tracker entry is opened.
    // This keeps existing mistakes visible without requiring a destructive reset.
    const result = Object.fromEntries(Object.entries(parsed).map(([key, value]) => {
      const bucket = value as TopicBucket;
      const wrongQuestions = Array.isArray(bucket.wrongQuestions)
        ? bucket.wrongQuestions.map((wrong, index) => {
            const normalized = normalizeMcqForTracking({
              question: wrong?.question,
              questionNumber: wrong?.questionNumber,
              statements: wrong?.statements,
              options: wrong?.allOptions,
              correctAnswer: wrong?.correctAnswer,
              explanation: wrong?.explanation,
            }, index);
            return {
              ...wrong,
              questionNumber: wrong?.questionNumber || normalized.questionNumber,
              statements: wrong?.statements?.length ? wrong.statements : normalized.statements,
              allOptions: normalized.allOptions,
              correctAnswer: Number.isInteger(wrong?.correctAnswer)
                ? wrong.correctAnswer
                : normalized.allOptions.findIndex(option => option === (wrong?.correctOption || '')),
              correctOption: wrong?.correctOption || normalized.correctOption,
            };
          })
        : [];
      return [key, { ...bucket, key, _key: key, wrongQuestions }];
    })) as TrackerMap;

    memoryTrackerCache[currentKey] = result;
    if (currentKey !== LEGACY_STORAGE_KEY) {
      memoryTrackerCache[LEGACY_STORAGE_KEY] = result;
    }
    return result;
  } catch {
    return memoryTrackerCache[currentKey] ? { ...memoryTrackerCache[currentKey] } : {};
  }
}

function safeWrite(map: TrackerMap) {
  const currentKey = userStorageKey();
  // Keep memory cache always updated immediately
  memoryTrackerCache[currentKey] = map;
  if (currentKey !== LEGACY_STORAGE_KEY) {
    memoryTrackerCache[LEGACY_STORAGE_KEY] = map;
  }

  try {
    const compacted = compactTrackerMap(map, false);
    const serialized = JSON.stringify(compacted);
    const ok = safeSetItem(currentKey, serialized);
    if (!ok) {
      // If quota failed, prune storage and try strict compaction
      pruneLocalStorageForQuota();
      const strictlyCompacted = compactTrackerMap(map, true);
      localStorage.setItem(currentKey, JSON.stringify(strictlyCompacted));
    }
    // Also mirror to legacy unscoped key so all components stay in sync
    if (currentKey !== LEGACY_STORAGE_KEY) {
      try {
        safeSetItem(LEGACY_STORAGE_KEY, serialized);
      } catch (_) {}
    }
  } catch (err) {
    try {
      // Emergency: prune storage and write bare essential bucket state
      pruneLocalStorageForQuota();
      const minimalMap: TrackerMap = {};
      for (const [k, b] of Object.entries(map)) {
        if (!b) continue;
        minimalMap[k] = {
          ...b,
          wrongQuestions: (b.wrongQuestions || []).slice(-2),
          sessionHistory: undefined,
        };
      }
      const minimalSerialized = JSON.stringify(minimalMap);
      localStorage.setItem(currentKey, minimalSerialized);
      if (currentKey !== LEGACY_STORAGE_KEY) {
        try { localStorage.setItem(LEGACY_STORAGE_KEY, minimalSerialized); } catch (_) {}
      }
    } catch {
      // In worst-case storage limit, preserve in sessionStorage & memory
      try {
        sessionStorage.setItem(currentKey, JSON.stringify(compactTrackerMap(map, true)));
      } catch {}
      console.warn('[revisionTrackerV2] LocalStorage full. Retained in memory & session cache.');
    }
  }
}

export function bucketKey(subjectId: string, chapterId: string, pageKey: string, topic: string) {
  const p = pageKey || chapterId || '';
  return `${subjectId || ''}::${chapterId || ''}::${p}::${topic || ''}`;
}

/** Returns the start-of-tomorrow (midnight) as a Unix ms timestamp. */
function tomorrowMidnight(): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Returns midnight today. */
function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface RecordAttemptArgs {
  subjectId: string;
  subjectName?: string;
  chapterId: string;
  chapterTitle?: string;
  pageKey?: string;       // optional — defaults to chapterId so flat chapters still bucket correctly
  pageLabel?: string;
  questions: MCQItem[];
  userAnswers: (number | null)[];
}

export function recordAttempt(args: RecordAttemptArgs) {
  if (!args || !args.questions || !args.questions.length) return;
  const map = safeRead();
  const pageKey = args.pageKey || args.chapterId;
  const now = Date.now();
  // Track which keys already existed before this attempt so we know if a bucket
  // is brand new (first attempt). Brand-new all-correct buckets should NOT be
  // added to the revision hub — only wrong answers trigger tracking.
  const existingKeys = new Set(Object.keys(map));
  // Track per-session totals per bucket so we can detect "all correct in this
  // session" and apply the long-spacing schedule (notes +10d, MCQ +20d).
  const sessionStats: Record<string, { total: number; correct: number }> = {};
  args.questions.forEach((q, idx) => {
    const tracked = normalizeMcqForTracking(q, idx);
    const topic = (q.topic || 'General').trim() || 'General';
    const k = bucketKey(args.subjectId, args.chapterId, pageKey, topic);
    const prev: TopicBucket = map[k] || {
      subjectId: args.subjectId,
      subjectName: args.subjectName,
      chapterId: args.chapterId,
      chapterTitle: args.chapterTitle,
      pageKey, pageLabel: args.pageLabel,
      topic,
      total: 0, correct: 0,
      lastAttemptAt: now,
      wrongQuestions: [],
      stage: 'NOTES',
      nextDueAt: tomorrowMidnight(),
      cycleCount: 0,
    };
    prev.total += 1;
    const ans = args.userAnswers[idx];
    const isCorrect = ans !== null && ans !== undefined && ans === tracked.correctAnswer;
    if (isCorrect) {
      prev.correct += 1;
    } else {
      // Per-question wrong-cycle tracking: if this exact question was already
      // in `wrongQuestions`, bump its `wrongCycles` counter; otherwise insert
      // a fresh entry with wrongCycles = 1.
      const existingIdx = prev.wrongQuestions.findIndex(w =>
        getTrackedQuestionKey({
          question: w.question,
          questionNumber: w.questionNumber,
        }) === getTrackedQuestionKey(tracked)
      );
      if (existingIdx >= 0) {
        const existing = prev.wrongQuestions[existingIdx];
        const updated = {
          ...existing,
          question: tracked.question,
          questionNumber: tracked.questionNumber ?? existing.questionNumber,
          statements: tracked.statements,
          correctOption: tracked.correctOption || existing.correctOption,
          allOptions: tracked.allOptions,
          correctAnswer: tracked.correctAnswer,
          explanation: tracked.explanation || existing.explanation,
          at: now,
          wrongCycles: (existing.wrongCycles || 1) + 1,
        };
        prev.wrongQuestions = [
          updated,
          ...prev.wrongQuestions.filter((_, i) => i !== existingIdx),
        ].slice(0, 10);
      } else {
        prev.wrongQuestions = [
          {
            question: tracked.question,
            questionNumber: tracked.questionNumber,
            statements: tracked.statements,
            correctOption: tracked.correctOption,
            allOptions: tracked.allOptions,
            correctAnswer: tracked.correctAnswer,
            explanation: tracked.explanation,
            at: now,
            wrongCycles: 1,
          },
          ...prev.wrongQuestions,
        ].slice(0, 10);
      }

      // Reset to NOTES stage if this is a new wrong answer and currently in MCQ or no stage
      if (!prev.stage || prev.stage === 'MCQ') {
        prev.stage = 'NOTES';
        // Only reschedule if not already due today or earlier
        const currentDue = prev.nextDueAt ?? 0;
        if (currentDue > now) {
          prev.nextDueAt = tomorrowMidnight();
        }
      } else if (!prev.nextDueAt) {
        prev.nextDueAt = tomorrowMidnight();
      }
      // A new wrong answer cancels any pending long-spacing schedule.
      prev.longSpacingNotesAt = undefined;
      prev.longSpacingMcqAt = undefined;
    }
    prev.lastAttemptAt = now;
    prev.updatedAt = now;
    // keep latest labels in case admin renames things later
    prev.subjectName = args.subjectName ?? prev.subjectName;
    prev.chapterTitle = args.chapterTitle ?? prev.chapterTitle;
    prev.pageLabel = args.pageLabel ?? prev.pageLabel;
    map[k] = prev;
    const s = sessionStats[k] || { total: 0, correct: 0 };
    s.total += 1;
    if (isCorrect) s.correct += 1;
    sessionStats[k] = s;
  });

  // Long-spacing pass: any bucket where the student answered EVERY question
  // correctly in this session (and has no lingering wrong questions overall)
  // graduates to the maintenance schedule — notes resurface in 10 days, the
  // MCQ rerun resurfaces 10 days after that (20 days total).
  const TEN_DAYS_MS  = 10 * 24 * 3600 * 1000;
  const TWENTY_DAYS_MS = 20 * 24 * 3600 * 1000;
  Object.entries(sessionStats).forEach(([k, s]) => {
    if (s.total > 0 && s.correct === s.total) {
      const b = map[k];
      if (!b) return;
      // Clear out wrong questions because the student got everything right.
      b.wrongQuestions = [];
      b.stage = 'NOTES';
      b.longSpacingNotesAt = now + TEN_DAYS_MS;
      b.longSpacingMcqAt   = now + TWENTY_DAYS_MS;
      // Set nextDueAt to the notes resurface time so the Schedule page
      // surfaces this bucket again on day 10.
      b.nextDueAt = b.longSpacingNotesAt;
      map[k] = b;
    }
  });
  safeWrite(map);
}

export function getAllBuckets(): TopicBucket[] {
  return Object.values(safeRead());
}

/** Return a copy of the active user's complete tracker map. */
export function getTrackerMap(): TrackerMap {
  return safeRead();
}

/**
 * Replace the active user's local tracker after a cloud restore.
 * This is intentionally explicit so a failed Firebase read never wipes local data.
 */
export function replaceTrackerMap(map: TrackerMap): void {
  safeWrite(map || {});
}

/**
 * Merge an offline map with the Firebase map. A newer local mutation wins;
 * otherwise the cloud snapshot wins. Entries that exist on only one side are
 * always retained so offline work is not silently discarded.
 */
export function mergeTrackerMaps(local: TrackerMap, cloud: TrackerMap): TrackerMap {
  const merged: TrackerMap = { ...cloud };
  for (const [key, localBucket] of Object.entries(local || {})) {
    const cloudBucket = merged[key];
    if (!cloudBucket) {
      merged[key] = localBucket;
      continue;
    }
    const localTime = localBucket.updatedAt || localBucket.lastAttemptAt || 0;
    const cloudTime = cloudBucket.updatedAt || cloudBucket.lastAttemptAt || 0;
    const localHasAdvanced = (localBucket.stage === 'NOTES' && cloudBucket.stage === 'MCQ') ||
                             ((localBucket.cycleCount || 0) > (cloudBucket.cycleCount || 0));
    if (localTime >= cloudTime || localHasAdvanced) {
      merged[key] = localBucket;
    }
  }
  return merged;
}

export interface WeakBucket extends TopicBucket {
  accuracy: number;   // 0..1
  wrongCount: number;
}

export function getWeakBuckets(opts?: { minAttempts?: number; maxAccuracy?: number }): WeakBucket[] {
  const minAttempts = opts?.minAttempts ?? 2;
  const maxAccuracy = opts?.maxAccuracy ?? 0.7;
  return getAllBuckets()
    .filter(b => b.total >= minAttempts)
    .map(b => ({ ...b, accuracy: b.correct / Math.max(b.total, 1), wrongCount: b.total - b.correct }))
    .filter(b => b.accuracy <= maxAccuracy)
    .sort((a, b) => a.accuracy - b.accuracy || b.wrongCount - a.wrongCount);
}

/** A bucket counts as "trackable" if it has wrong questions OR is in the
 *  long-spacing maintenance window (notes/MCQ rerun queued). */
function isTrackable(b: TopicBucket) {
  // Always track: topics with wrong answers, long-spacing maintenance, OR
  // freshly scheduled routine lessons (NOTES OR MCQ stage, never cycled yet).
  return (
    b.wrongQuestions.length > 0 ||
    !!b.longSpacingNotesAt ||
    !!b.longSpacingMcqAt ||
    (b.stage === 'NOTES' && (b.cycleCount ?? 0) === 0) ||
    (b.stage === 'MCQ'   && (b.cycleCount ?? 0) === 0)
  );
}

/** Midnight at the START of today (00:00:00.000). */
function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Midnight at the START of the calendar day that contains `ts`. */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Returns items that are due for review today or overdue.
 *  Boundary is midnight — anything whose due-day ≤ today is shown,
 *  regardless of the exact hour it was scheduled. */
export function getDueItems(): WeakBucket[] {
  const todayStart = startOfToday();
  return getAllBuckets()
    .filter(isTrackable)
    .filter(b => !b.nextDueAt || startOfDay(b.nextDueAt) <= todayStart)
    .map(b => ({ ...b, accuracy: b.correct / Math.max(b.total, 1), wrongCount: b.total - b.correct }))
    .sort((a, b) => (a.nextDueAt || 0) - (b.nextDueAt || 0));
}

/** Returns items coming up in the next N days (but NOT due today).
 *  Boundary is midnight — "tomorrow" means due-day = tomorrow's calendar date. */
export function getUpcomingItems(days = 7): WeakBucket[] {
  const todayStart = startOfToday();
  const limitDay   = todayStart + days * 24 * 3600 * 1000;
  return getAllBuckets()
    .filter(isTrackable)
    .filter(b => b.nextDueAt && startOfDay(b.nextDueAt) > todayStart && startOfDay(b.nextDueAt) <= limitDay)
    .map(b => ({ ...b, accuracy: b.correct / Math.max(b.total, 1), wrongCount: b.total - b.correct }))
    .sort((a, b) => (a.nextDueAt || 0) - (b.nextDueAt || 0));
}

/** Mark a topic's notes as reviewed → schedule the MCQ for tomorrow.
 *  If this bucket is in the long-spacing maintenance window, schedule the
 *  MCQ rerun for `longSpacingMcqAt` (typically 10 days after notes). */
export function markNotesReviewed(key: string, config?: RevisionConfig) {
  const map = safeRead();
  const b = map[key];
  if (!b) return;
  b.stage = 'MCQ';
  if (b.longSpacingMcqAt && b.longSpacingMcqAt > Date.now()) {
    // Maintenance mode: notes were just resurfaced on day 10, MCQ rerun on day 20.
    b.nextDueAt = b.longSpacingMcqAt;
    // Notes part is now consumed for this cycle; clear the notes timestamp so
    // we don't keep re-listing it.
    b.longSpacingNotesAt = undefined;
  } else {
    // MCQ due immediately after reading notes — show in today's list right away
    b.nextDueAt = Date.now();
  }
  b.updatedAt = Date.now();
  map[key] = b;
  safeWrite(map);
  // Notify RoutineRevisionBadge (and any other listeners) that revision state changed.
  try { window.dispatchEvent(new CustomEvent('iic-revision-updated')); } catch {}
}

/** Mark an MCQ session done. accuracy = 0..1. Schedules next revision based on performance. */
export function markMcqDone(
  key: string,
  accuracy: number,
  config?: RevisionConfig,
  sessionDetails?: {
    total?: number;
    got?: number;
    correctQuestionTexts?: string[];
  }
) {
  const map = safeRead();
  let targetKey = key;
  let b = map[targetKey];
  if (!b) {
    // Robust key search: check if matching by topic or partial subject/chapter
    const foundKey = Object.keys(map).find(k => {
      if (k === key) return true;
      const item = map[k];
      if (item?.topic && key.endsWith(`::${item.topic}`)) return true;
      const parts = k.split('::');
      const keyParts = key.split('::');
      if (parts[0] === keyParts[0] && parts[1] === keyParts[1] && parts[3] === keyParts[3]) return true;
      if (item?.topic && (item.topic.trim().toLowerCase() === keyParts[3]?.trim().toLowerCase())) return true;
      return false;
    });
    if (foundKey) {
      targetKey = foundKey;
      b = map[foundKey];
    }
  }

  const thresholds = config?.thresholds ?? { strong: 65, average: 50, mastery: 80 };
  const intervals = config?.intervals ?? {
    weak:     { revision: 86400,      mcq: 259200  },
    average:  { revision: 259200,     mcq: 432000  },
    strong:   { revision: 604800,     mcq: 864000  },
    mastered: { revision: 2592000,    mcq: 864000  },
  };

  const pct = accuracy * 100;
  let nextRevisionSecs: number;
  let tier: 'weak' | 'average' | 'strong' | 'mastered';
  if (pct >= thresholds.mastery) {
    nextRevisionSecs = intervals.mastered.revision;
    tier = 'mastered';
  } else if (pct >= thresholds.strong) {
    nextRevisionSecs = intervals.strong.revision;
    tier = 'strong';
  } else if (pct >= thresholds.average) {
    nextRevisionSecs = intervals.average.revision;
    tier = 'average';
  } else {
    nextRevisionSecs = intervals.weak.revision;
    tier = 'weak';
  }

  if (!b) {
    // Bucket was not in tracker yet (e.g. routine-scheduled or reconstructed) — synthesize it so completion is NEVER lost
    const parts = key.split('::');
    b = {
      subjectId: parts[0] || 'GENERAL',
      chapterId: parts[1] || 'chapter',
      pageKey: parts[2] || parts[1] || 'chapter',
      topic: parts[3] || key,
      total: sessionDetails?.total || 1,
      correct: sessionDetails?.got ?? Math.round(accuracy * (sessionDetails?.total || 1)),
      lastAttemptAt: Date.now(),
      wrongQuestions: [],
      stage: 'NOTES',
      nextDueAt: Math.max(tomorrowMidnight(), Date.now() + Math.max(86400, nextRevisionSecs) * 1000),
      cycleCount: 1,
      lastTier: tier,
      lastSessionAccuracy: accuracy,
      updatedAt: Date.now(),
    };
  } else {
    b.lastTier = tier;
    b.lastSessionAccuracy = accuracy;

    // Filter out any wrong questions that the user answered correctly in this session
    if (sessionDetails?.correctQuestionTexts && Array.isArray(b.wrongQuestions)) {
      const correctNormalized = new Set(
        sessionDetails.correctQuestionTexts.map(t => (t || '').trim().toLowerCase())
      );
      b.wrongQuestions = b.wrongQuestions.filter(
        q => q && q.question && !correctNormalized.has((q.question || '').trim().toLowerCase())
      );
    }

    // If 100% accuracy or no wrong questions left in the bucket, clear all wrong questions
    if (accuracy >= 1 || (b.wrongQuestions?.length ?? 0) === 0) {
      b.wrongQuestions = [];
    }

    // Replace previous score with latest session score as requested
    if (sessionDetails?.total) {
      b.total = sessionDetails.total;
      b.correct = sessionDetails.got || 0;
    }

    // Session history: last 3 sessions, newest first
    b.sessionHistory = [
      { accuracy, tier, at: Date.now() },
      ...(b.sessionHistory || []),
    ].slice(0, 3);
    b.stage = 'NOTES';
    b.cycleCount = (b.cycleCount || 0) + 1;

    // Perfect run → enter the long-spacing maintenance window
    if (accuracy >= 1 || (b.wrongQuestions?.length ?? 0) === 0) {
      const TEN_DAYS_MS  = 10 * 24 * 3600 * 1000;
      const TWENTY_DAYS_MS = 20 * 24 * 3600 * 1000;
      b.wrongQuestions = [];
      b.longSpacingNotesAt = Date.now() + TEN_DAYS_MS;
      b.longSpacingMcqAt   = Date.now() + TWENTY_DAYS_MS;
      b.nextDueAt = b.longSpacingNotesAt;
    } else {
      b.nextDueAt = Math.max(tomorrowMidnight(), Date.now() + Math.max(86400, nextRevisionSecs) * 1000);
    }
    b.updatedAt = Date.now();
  }

  map[targetKey] = b;
  safeWrite(map);
  // Notify RoutineRevisionBadge (and any other listeners) that revision state changed.
  try { window.dispatchEvent(new CustomEvent('iic-revision-updated')); } catch {}
}

export function clearTracker() {
  safeWrite({});
}

/**
 * Returns 0–100 accuracy % for all Revision Hub attempts linked to a lesson
 * (matched by chapterId === lessonId). Returns null if no data exists yet.
 */
export function getLessonRevHubPercent(lessonId: string): number | null {
  if (!lessonId) return null;
  const map = safeRead();
  let totalQ = 0, correctQ = 0;
  for (const b of Object.values(map)) {
    if (b.chapterId === lessonId) {
      totalQ   += b.total   || 0;
      correctQ += b.correct || 0;
    }
  }
  if (totalQ === 0) return null;
  return Math.round((correctQ / totalQ) * 100);
}

// ─── Topic Notes Direct Storage ─────────────────────────────────────────────
// Stores notes pasted by admin alongside MCQs (from <NOTE: topic> blocks).
// Key: nst_topic_notes → { [topicKey]: { title, content, savedAt } }

const TOPIC_NOTES_KEY = 'nst_topic_notes';

export interface TopicNoteEntry {
  title: string;
  content: string;
  savedAt: number;
}

export function saveTopicNotes(notes: { title: string; content: string }[]) {
  try {
    const existing: Record<string, TopicNoteEntry> = JSON.parse(localStorage.getItem(TOPIC_NOTES_KEY) || '{}');
    const now = Date.now();
    for (const n of notes) {
      if (!n.title || !n.content) continue;
      const k = n.title.trim().toLowerCase();
      existing[k] = { title: n.title.trim(), content: n.content.trim(), savedAt: now };
    }
    localStorage.setItem(TOPIC_NOTES_KEY, JSON.stringify(existing));
  } catch {}
}

export function getTopicNote(topicName: string): TopicNoteEntry | null {
  try {
    const map: Record<string, TopicNoteEntry> = JSON.parse(localStorage.getItem(TOPIC_NOTES_KEY) || '{}');
    const k = topicName.trim().toLowerCase();
    if (map[k]) return map[k];
    // Partial match — find any key that contains the topic or vice versa
    for (const [key, val] of Object.entries(map)) {
      if (k.includes(key) || key.includes(k)) return val;
    }
    return null;
  } catch { return null; }
}

// ─── Initial Schedule After First MCQ Attempt ───────────────────────────────
// Call this AFTER recordAttempt to apply interval-settings-based scheduling.
// Unlike markMcqDone, this does NOT increment cycleCount (it's the first attempt).
export function applyInitialSchedule(
  key: string,
  accuracy: number,
  config?: RevisionConfig
) {
  const map = safeRead();
  // Upsert: create a minimal bucket if it doesn't exist yet (handles key
  // mismatch between per-question recordAttempt keys and per-topic applyInitialSchedule keys)
  const parts = key.split('::');
  const b: TopicBucket = map[key] ?? {
    subjectId: parts[0] || key,
    chapterId: parts[1] || key,
    pageKey: parts[2] || key,
    topic: parts[3] || key,
    total: 0,
    correct: 0,
    lastAttemptAt: Date.now(),
    wrongQuestions: [],
    stage: 'NOTES' as const,
    nextDueAt: 0,
    cycleCount: 0,
  };

  const thresholds = config?.thresholds ?? { strong: 65, average: 50, mastery: 80 };
  const intervals = config?.intervals ?? {
    weak:     { revision: 86400,   mcq: 86400   },
    average:  { revision: 259200,  mcq: 432000  },
    strong:   { revision: 604800,  mcq: 864000  },
    mastered: { revision: 2592000, mcq: 864000  },
  };

  const pct = accuracy * 100;
  let nextRevisionSecs: number;
  let tier: 'weak' | 'average' | 'strong' | 'mastered';
  if (pct >= thresholds.mastery) {
    nextRevisionSecs = intervals.mastered.revision;
    tier = 'mastered';
  } else if (pct >= thresholds.strong) {
    nextRevisionSecs = intervals.strong.revision;
    tier = 'strong';
  } else if (pct >= thresholds.average) {
    nextRevisionSecs = intervals.average.revision;
    tier = 'average';
  } else {
    nextRevisionSecs = intervals.weak.revision;
    tier = 'weak';
  }

  b.lastTier = tier;
  b.lastSessionAccuracy = accuracy;
  // ── Session history: last 3 sessions, newest first ────────────────────
  b.sessionHistory = [
    { accuracy, tier, at: Date.now() },
    ...(b.sessionHistory || []),
  ].slice(0, 3);
  b.stage = 'NOTES';
  // Perfect on first try → long-spacing immediately
  if (accuracy >= 1) {
    const TEN_DAYS_MS   = 10 * 24 * 3600 * 1000;
    const TWENTY_DAYS_MS = 20 * 24 * 3600 * 1000;
    b.wrongQuestions = [];
    b.longSpacingNotesAt = Date.now() + TEN_DAYS_MS;
    b.longSpacingMcqAt   = Date.now() + TWENTY_DAYS_MS;
    b.nextDueAt = b.longSpacingNotesAt;
  } else {
    b.nextDueAt = Date.now() + nextRevisionSecs * 1000;
  }
  b.updatedAt = Date.now();
  map[key] = b;
  safeWrite(map);
  try { window.dispatchEvent(new CustomEvent('iic-revision-updated')); } catch {}
}

/**
 * Schedule a routine-completed lesson for Revision Hub review.
 * Called when a student finishes a routine lesson — creates a NOTES-stage
 * bucket that becomes due tomorrow so it appears in the Revision Hub the
 * next day.  Skips silently if the lesson is already tracked.
 */
export function scheduleRoutineLessonForRevision(opts: {
  lessonId: string;
  subjectId: string;
  subjectName?: string;
  lessonTitle?: string;
}): void {
  try {
    const map = safeRead();
    const { lessonId, subjectId, subjectName, lessonTitle } = opts;
    const k = bucketKey(subjectId, lessonId, lessonId, lessonTitle || lessonId);
    // Don't overwrite an existing bucket that has real MCQ history
    if (map[k] && (map[k].total > 0 || map[k].cycleCount)) return;
    const now = Date.now();
    map[k] = {
      ...(map[k] || {}),
      subjectId,
      subjectName: subjectName || subjectId,
      chapterId: lessonId,
      chapterTitle: lessonTitle || lessonId,
      pageKey: lessonId,
      pageLabel: lessonTitle || lessonId,
      topic: lessonTitle || lessonId,
      total: map[k]?.total ?? 0,
      correct: map[k]?.correct ?? 0,
      lastAttemptAt: now,
      wrongQuestions: map[k]?.wrongQuestions ?? [],
      stage: 'NOTES',
      // due immediately so it shows up in today's routine revision badge
      nextDueAt: Date.now(),
      cycleCount: map[k]?.cycleCount ?? 0,
      lastTier: map[k]?.lastTier ?? 'average',
      updatedAt: now,
    };
    safeWrite(map);
  } catch { /* storage failure — ignore */ }
}

// ── Routine ↔ Revision Hub link ─────────────────────────────────────────────

export interface LessonRevisionStatus {
  key: string;
  /** Current revision stage for this lesson */
  stage: 'NOTES' | 'MCQ';
  /** Due today or overdue → user should go to Revision Hub now */
  isDueToday: boolean;
  /** Revision done for this cycle — next due date is in the future */
  isDoneForNow: boolean;
  /** Number of completed revision cycles */
  cycleCount: number;
  /** 0–1 accuracy across all attempts */
  accuracy: number;
  topic: string;
  nextDueAt?: number;
}

/**
 * Returns the revision status for a lesson that was scheduled via
 * scheduleRoutineLessonForRevision.  Returns null if no bucket exists yet
 * (lesson not yet completed in Routine).
 */
export function getRevisionStatusForLesson(lessonId: string): LessonRevisionStatus | null {
  const map = safeRead();
  const todayStart = startOfToday();
  const normId = (lessonId || '').trim().toLowerCase();
  const entry = Object.entries(map).find(([k, b]) => {
    if (!b) return false;
    if (b.chapterId === lessonId || b.pageKey === lessonId) return true;
    if (k === lessonId || k.includes(`::${lessonId}::`) || k.endsWith(`::${lessonId}`)) return true;
    if (b.topic && normId && b.topic.trim().toLowerCase() === normId) return true;
    return false;
  });
  if (!entry) return null;
  const [key, b] = entry;
  const dueDay = b.nextDueAt ? startOfDay(b.nextDueAt) : 0;
  const isDueToday = !b.nextDueAt || dueDay <= todayStart;
  // "done for now" = at least one full cycle done AND next due is in the future
  const isDoneForNow = (b.cycleCount ?? 0) > 0 && !!(b.nextDueAt && dueDay > todayStart);
  return {
    key,
    stage: b.stage || 'NOTES',
    isDueToday,
    isDoneForNow,
    cycleCount: b.cycleCount ?? 0,
    accuracy: b.total > 0 ? b.correct / b.total : 0,
    topic: b.topic || lessonId,
    nextDueAt: b.nextDueAt,
  };
}

// Build a list of search keywords for a weak bucket — topic name plus salient
// nouns from the wrong-question stems. The Revision Hub uses these to scan
// notes for matching content.
export function keywordsForBucket(b: TopicBucket): string[] {
  const stop = new Set(['the','a','an','of','and','or','to','in','on','with','for','is','are','was','were','be','been','by','from','as','at','that','this','these','those','it','its','which','who','whom','whose','what','how','when','where','why','about','into','than','then','also','any','all','some','most','more','less','one','two','three','four','five','first','second','third','because','if','but','not','no','do','does','did','have','has','had','can','could','should','would','may','might','will','shall','their','them','they','he','she','his','her','you','your','our','we','i','me','my','mine','option','options','correct','incorrect','answer','question','statement','statements','following','below','above','given','find','choose','select','mark','tick','example','examples','among','only','both','either','neither','many','much','very','well','best','worst','true','false']);
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | undefined) => {
    if (!raw) return;
    raw.toString().toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ').split(/\s+/).forEach(w => {
      if (!w || w.length < 3 || stop.has(w)) return;
      if (seen.has(w)) return;
      seen.add(w); out.push(w);
    });
  };
  push(b.topic);
  b.wrongQuestions.forEach(q => { push(q.question); push(q.correctOption); });
  return out.slice(0, 12);
}
