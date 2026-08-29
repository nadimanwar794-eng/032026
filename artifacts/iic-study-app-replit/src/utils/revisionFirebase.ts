/**
 * revisionFirebase.ts
 * Firebase helpers for per-lesson Revision Hub tracking.
 *
 * Firestore path: users/{userId}/revision_lessons/{safeDocId}
 *
 * Each bucket doc = full TopicBucket snapshot.
 * Every write uses merge:false so the doc is fully replaced (latest state wins).
 *
 * MCQ data is NOT accumulated across calls — each sync overwrites the whole bucket,
 * which means Firebase always reflects the latest attempt.
 */

import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../firebase';
import {
  getTrackerMap,
  mergeTrackerMaps,
  replaceTrackerMap,
  setRevisionTrackerUser,
} from './revisionTrackerV2';
import type { TopicBucket, TrackerMap } from './revisionTrackerV2';

/** Replace `::` and Firestore-invalid chars so the key is a valid doc ID */
function safeDocId(key: string): string {
  return key
    .replace(/::/g, '__')
    .replace(/[\/\.#\[\]*]/g, '_')
    .slice(0, 250) || 'unknown';
}

function bucketRef(userId: string, key: string) {
  return doc(db, `users/${userId}/revision_lessons/${safeDocId(key)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sync a single TopicBucket to Firestore — fire and forget.
 * Full overwrite (merge:false) so latest MCQ attempt always wins.
 */
export function syncRevisionBucket(
  userId: string,
  key: string,
  bucket: TopicBucket,
): void {
  if (!userId || !key) return;
  try {
    setDoc(
      bucketRef(userId, key),
      sanitizeForFirestore({ ...bucket, _key: key, updatedAt: Date.now() }),
      { merge: false },
    ).catch(() => {});
  } catch {}
}

/**
 * Sync every bucket in a TrackerMap — fire and forget.
 * Call this after any bulk update (e.g. after a full Revision Hub MCQ session).
 */
export function syncAllRevisionBuckets(userId: string, map: TrackerMap): void {
  if (!userId) return;
  for (const [key, bucket] of Object.entries(map)) {
    syncRevisionBucket(userId, key, bucket);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all revision buckets from Firestore for a user.
 * Returns an empty map on error.
 */
export async function loadRevisionBucketsFromFirebase(
  userId: string,
): Promise<TrackerMap> {
  if (!userId) return {};
  try {
    const colRef = collection(db, `users/${userId}/revision_lessons`);
    const snap = await getDocs(colRef);
    const map: TrackerMap = {};
    snap.forEach(d => {
      const raw = d.data() as TopicBucket & { _key?: string; updatedAt?: number };
      // Restore original key — stored as _key; fallback: reverse safeDocId heuristic
      const key = raw._key || d.id.replace(/__/g, '::');
      const { _key, updatedAt, ...bucket } = raw as any;
      map[key] = bucket as TopicBucket;
    });
    return map;
  } catch {
    return {};
  }
}

/**
 * Restore the active user's revision tracker on this device.
 *
 * Cloud reads are best-effort: an empty/error response never replaces local
 * progress. Local-only entries are uploaded after the merge so an offline
 * device can recover its work on the next phone as well.
 */
export async function hydrateRevisionTracker(userId: string): Promise<TrackerMap> {
  if (!userId) return {};
  setRevisionTrackerUser(userId);
  const local = getTrackerMap();
  const cloud = await loadRevisionBucketsFromFirebase(userId);
  const hasCloudData = Object.keys(cloud).length > 0;
  const merged = hasCloudData
    ? mergeTrackerMaps(local, cloud)
    : local;
  replaceTrackerMap(merged);
  if (Object.keys(merged).length > 0) syncAllRevisionBuckets(userId, merged);
  window.dispatchEvent(new CustomEvent('iic-revision-tracker-hydrated', {
    detail: { userId, count: Object.keys(merged).length },
  }));
  return merged;
}
