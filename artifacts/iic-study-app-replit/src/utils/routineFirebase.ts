/**
 * routineFirebase.ts
 * Firebase helpers for per-lesson Routine tracking.
 *
 * Firestore path: users/{userId}/routine_lessons/{safeDocId}
 *
 * Each lesson doc stores:
 *  - creditGiven  : boolean — credits were given on first open; block on repeat visits
 *  - firstSeenAt  : number  — Unix ms, when first opened
 *  - mcqLatest    : object  — ALWAYS OVERWRITTEN with the latest MCQ attempt (no accumulation)
 *  - updatedAt    : number
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../firebase';

/** Sanitize a lessonId into a valid Firestore document ID */
function safeDocId(lessonId: string): string {
  return lessonId
    .replace(/[\/\.#\[\]*]/g, '_')
    .slice(0, 250) || 'unknown';
}

function lessonRef(userId: string, lessonId: string) {
  return doc(db, `users/${userId}/routine_lessons/${safeDocId(lessonId)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Credit gating
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if credits have already been given for this lesson
 * (i.e. this is a REPEAT visit — give pts only, no credits).
 */
export async function getRoutineLessonCreditGiven(
  userId: string,
  lessonId: string,
): Promise<boolean> {
  if (!userId || !lessonId) return false;
  try {
    const snap = await getDoc(lessonRef(userId, lessonId));
    if (!snap.exists()) return false;
    return !!(snap.data() as any).creditGiven;
  } catch {
    return false;
  }
}

/**
 * Mark credits as given for this lesson.
 * Call this when the user leaves after a first-time earning session.
 */
export async function setRoutineLessonCreditGiven(
  userId: string,
  lessonId: string,
): Promise<void> {
  if (!userId || !lessonId) return;
  try {
    await setDoc(
      lessonRef(userId, lessonId),
      sanitizeForFirestore({
        lessonId,
        creditGiven: true,
        firstSeenAt: Date.now(),
        updatedAt: Date.now(),
      }),
      { merge: true },
    );
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// MCQ data — always overwrite, never accumulate
// ─────────────────────────────────────────────────────────────────────────────

export interface RoutineMcqLatest {
  total: number;
  correct: number;
  score: number;
  lastAttemptAt: number;
}

/**
 * Save the latest MCQ result for a routine lesson.
 * Uses merge:false on the mcqLatest field so each call fully replaces the previous result.
 */
export async function saveRoutineMcqLatest(
  userId: string,
  lessonId: string,
  mcq: { total: number; correct: number; score: number },
): Promise<void> {
  if (!userId || !lessonId) return;
  try {
    await setDoc(
      lessonRef(userId, lessonId),
      sanitizeForFirestore({
        lessonId,
        mcqLatest: { ...mcq, lastAttemptAt: Date.now() },
        updatedAt: Date.now(),
      }),
      { merge: true }, // merge:true for the doc, but mcqLatest is always fully replaced
    );
  } catch {}
}
