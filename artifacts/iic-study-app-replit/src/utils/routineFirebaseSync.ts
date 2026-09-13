/**
 * routineFirebaseSync.ts
 * Complete Firebase backup + restore for all Routine data.
 *
 * Two Firestore documents per user:
 *
 *  1. users/{userId}/routine_backup/config  — config + coins + progress
 *     Fields: routineMode, selectedBoard, selectedClass, selectedBook,
 *             selectedBooks, routineCategories, coins, enabled,
 *             unlockedTierSlot, dailyClaims, revisionUnlockedLessons,
 *             lessonProgress, dailyTasks (last 90 days),
 *             trackingHistory (last 120 entries)
 *
 *  2. users/{userId}/routine_backup/autotrack  — per-page read/MCQ/time data
 *     Fields: pageReads, mcqDone, mcqScore, pageMcqDone, pageMcqScore,
 *             pageMcqBest, timings, mistakes, masks, lessonRewarded
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../firebase';
import { loadRoutineData, saveRoutineData, type RoutineData } from './routineStorage';

// ─── localStorage key for auto-track ─────────────────────────────────────────
const AUTO_KEY = 'nst_routine_auto_v1';

function loadAutoTrack(): Record<string, any> {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAutoTrack(data: Record<string, any>): void {
  try { localStorage.setItem(AUTO_KEY, JSON.stringify(data)); } catch {}
}

// ─── Firestore refs ───────────────────────────────────────────────────────────
const configDoc  = (uid: string) => doc(db, `users/${uid}/routine_backup/config`);
const autoDoc    = (uid: string) => doc(db, `users/${uid}/routine_backup/autotrack`);

// ─── Debounce ─────────────────────────────────────────────────────────────────
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Keep only the last N days of dailyTasks (prevents unbounded growth) */
function recentDailyTasks(tasks: Record<string, any>, days = 90): Record<string, any> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const out: Record<string, any> = {};
  for (const [date, val] of Object.entries(tasks || {})) {
    if (date >= cutoffStr) out[date] = val;
  }
  return out;
}

/** Keep only the last N entries of trackingHistory */
function recentHistory(history: any[], max = 120): any[] {
  if (!Array.isArray(history)) return [];
  return history.slice(-max);
}

/** Build the config document payload */
function toConfigPayload(data: RoutineData) {
  return {
    // ── Setup ────────────────────────────────────────────────────────────────
    routineMode:             data.routineMode,
    selectedBoard:           data.selectedBoard  ?? null,
    selectedClass:           data.selectedClass  ?? null,
    selectedBook:            data.selectedBook   ?? null,
    selectedBooks:           data.selectedBooks  ?? [],
    routineCategories:       data.routineCategories ?? [],
    enabled:                 data.enabled        ?? false,
    unlockedTierSlot:        data.unlockedTierSlot ?? false,

    // ── Coins & claims ───────────────────────────────────────────────────────
    coins:                   data.coins          ?? 0,
    dailyClaims:             data.dailyClaims    ?? {},

    // ── Unlocks ──────────────────────────────────────────────────────────────
    revisionUnlockedLessons: data.revisionUnlockedLessons ?? {},

    // ── Lesson-level progress ────────────────────────────────────────────────
    lessonProgress:          data.lessonProgress ?? {},

    // ── Daily tasks — last 90 days ───────────────────────────────────────────
    dailyTasks:              recentDailyTasks(data.dailyTasks),

    // ── Study history — last 120 sessions ────────────────────────────────────
    trackingHistory:         recentHistory(data.trackingHistory),

    _syncedAt: Date.now(),
  };
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Debounced save — fires 12 s after the last call.
 * Saves BOTH config and auto-track documents.
 */
export function scheduleRoutineSync(userId: string, data: RoutineData): void {
  if (!userId) return;
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    _flushBoth(userId, data);
  }, 12_000);
}

/**
 * Immediate save — use for important config changes.
 */
export function syncRoutineNow(userId: string, data: RoutineData): void {
  if (!userId) return;
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
  _flushBoth(userId, data);
}

function _flushBoth(userId: string, data: RoutineData): void {
  // Config doc
  setDoc(
    configDoc(userId),
    sanitizeForFirestore(toConfigPayload(data)),
    { merge: false },
  ).catch(() => {});

  // Auto-track doc
  const at = loadAutoTrack();
  if (Object.keys(at).length > 0) {
    setDoc(
      autoDoc(userId),
      sanitizeForFirestore({ ...at, _syncedAt: Date.now() }),
      { merge: false },
    ).catch(() => {});
  }
}

// ─── Read + Merge ─────────────────────────────────────────────────────────────

/**
 * Restore all routine data from Firebase on login / device change.
 *
 * Merge rules:
 *   Config          — cloud wins only when local is blank (fresh device/cache clear)
 *   Coins           — Math.max (user never loses coins)
 *   dailyClaims     — union (more is better)
 *   revisionUnlocked— union
 *   lessonProgress  — union (merge lesson-by-lesson, local wins per lesson)
 *   dailyTasks      — union (merge date-by-date, local wins per date)
 *   trackingHistory — merge & deduplicate by date+lessonId, sort by date
 *   enabled /
 *   unlockedTierSlot— OR (once unlocked, stays unlocked)
 *   autotrack       — union (merge all keys, local wins per key)
 *
 * Fires 'iic-routine-hydrated' when done so MyRoutine.tsx can reload state.
 */
export async function hydrateRoutineData(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const [configSnap, autoSnap] = await Promise.all([
      getDoc(configDoc(userId)),
      getDoc(autoDoc(userId)),
    ]);

    const local = loadRoutineData(userId);
    const localAt = loadAutoTrack();

    if (!configSnap.exists()) {
      // No cloud yet — upload everything immediately
      syncRoutineNow(userId, local);
      return;
    }

    const cloud = configSnap.data() as ReturnType<typeof toConfigPayload>;
    const cloudAt = autoSnap.exists() ? (autoSnap.data() as Record<string, any>) : {};

    const localIsFresh = !local.routineMode;

    // ── Merge config ────────────────────────────────────────────────────────
    const merged: RoutineData = {
      ...local,

      routineMode:
        localIsFresh ? cloud.routineMode : (local.routineMode ?? cloud.routineMode),
      selectedBoard:
        localIsFresh ? cloud.selectedBoard : (local.selectedBoard ?? cloud.selectedBoard ?? null),
      selectedClass:
        localIsFresh ? cloud.selectedClass : (local.selectedClass ?? cloud.selectedClass ?? null),
      selectedBook:
        localIsFresh ? cloud.selectedBook  : (local.selectedBook  ?? cloud.selectedBook  ?? null),
      selectedBooks:
        localIsFresh
          ? (cloud.selectedBooks ?? [])
          : (local.selectedBooks?.length ? local.selectedBooks : (cloud.selectedBooks ?? [])),
      routineCategories:
        localIsFresh
          ? (cloud.routineCategories ?? [])
          : (local.routineCategories?.length
              ? local.routineCategories
              : (cloud.routineCategories ?? [])),

      enabled:         local.enabled         || cloud.enabled,
      unlockedTierSlot: local.unlockedTierSlot || cloud.unlockedTierSlot,

      // ── Coins — never take away ─────────────────────────────────────────
      coins: Math.max(local.coins ?? 0, cloud.coins ?? 0),

      // ── Claims — union ──────────────────────────────────────────────────
      dailyClaims: { ...(cloud.dailyClaims ?? {}), ...(local.dailyClaims ?? {}) },

      // ── Revision unlocks — union ────────────────────────────────────────
      revisionUnlockedLessons: {
        ...(cloud.revisionUnlockedLessons ?? {}),
        ...(local.revisionUnlockedLessons ?? {}),
      },

      // ── Lesson progress — union (local wins per lesson) ─────────────────
      lessonProgress: {
        ...(cloud.lessonProgress ?? {}),
        ...(local.lessonProgress ?? {}),
      },

      // ── Daily tasks — union (local wins per date) ───────────────────────
      dailyTasks: {
        ...(cloud.dailyTasks ?? {}),
        ...(local.dailyTasks ?? {}),
      },

      // ── Tracking history — merge + sort ────────────────────────────────
      trackingHistory: _mergeHistory(
        cloud.trackingHistory ?? [],
        local.trackingHistory ?? [],
      ),
    };

    saveRoutineData(userId, merged);

    // ── Auto-track merge ────────────────────────────────────────────────────
    const mergedAt = _mergeAutoTrack(cloudAt, localAt);
    saveAutoTrack(mergedAt);

    window.dispatchEvent(
      new CustomEvent('iic-routine-hydrated', { detail: { userId } }),
    );

    // Upload the merged result so the next device gets everything
    syncRoutineNow(userId, merged);

  } catch (err) {
    console.warn('[IIC] Routine hydration skipped:', err);
  }
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

/** Merge two tracking-history arrays, deduplicate, keep last 120 sorted */
function _mergeHistory(cloud: any[], local: any[]): any[] {
  const seen = new Set<string>();
  const combined: any[] = [];
  for (const entry of [...cloud, ...local]) {
    const key = `${entry.date}__${entry.lessonId}__${entry.subjectId}`;
    if (!seen.has(key)) { seen.add(key); combined.push(entry); }
  }
  combined.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return combined.slice(-120);
}

/** Merge two auto-track objects — local wins per key */
function _mergeAutoTrack(
  cloud: Record<string, any>,
  local: Record<string, any>,
): Record<string, any> {
  const merged: Record<string, any> = {};
  const fields = [
    'pageReads','mcqDone','mcqScore',
    'pageMcqDone','pageMcqScore','pageMcqBest',
    'timings','mistakes','masks','lessonRewarded',
  ];
  for (const field of fields) {
    merged[field] = {
      ...(cloud[field] ?? {}),
      ...(local[field] ?? {}), // local wins
    };
  }
  return merged;
}
