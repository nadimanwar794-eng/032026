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
import { ref, update } from 'firebase/database';
import { db, rtdb, sanitizeForFirestore } from '../firebase';
import {
  getTrackerMap,
  mergeTrackerMaps,
  replaceTrackerMap,
  setRevisionTrackerUser,
  setRevisionHydrationState,
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

/**
 * If revision_lessons subcollection in Firestore was empty on a new device or cleared cache,
 * reconstruct buckets from the student's cloud profile (topicStrength, mcqHistory).
 */
export function reconstructBucketsFromUserProfile(user: any): TrackerMap {
  const map: TrackerMap = {};
  if (!user) return map;
  const now = Date.now();

  // 1. From topicStrength
  if (user.topicStrength && typeof user.topicStrength === 'object') {
    for (const [topicName, stats] of Object.entries(user.topicStrength as Record<string, any>)) {
      if (!topicName || !stats) continue;
      const total = Number(stats.total) || 0;
      const correct = Number(stats.correct) || 0;
      const accuracy = total > 0 ? correct / total : 1;
      const subId = stats.subjectId || 'GENERAL';
      const chapId = stats.chapterId || stats.chapterName || 'chapter_1';
      const chapTitle = stats.chapterName || stats.chapterTitle || 'Chapter';
      const k = `${subId}::${chapId}::${chapId}::${topicName}`;

      const tier = accuracy >= 0.8 ? 'mastered' : accuracy >= 0.65 ? 'strong' : accuracy >= 0.5 ? 'average' : 'weak';
      // Due today if weak or below mastery so user immediately sees their topics
      const isDue = accuracy < 0.75;

      map[k] = {
        subjectId: subId,
        subjectName: stats.subjectName || subId,
        chapterId: chapId,
        chapterTitle: chapTitle,
        pageKey: chapId,
        pageLabel: chapTitle,
        topic: topicName,
        total,
        correct,
        lastAttemptAt: stats.lastAttempt ? new Date(stats.lastAttempt).getTime() : now,
        wrongQuestions: [],
        stage: 'MCQ',
        nextDueAt: isDue ? now : now + 24 * 3600 * 1000,
        cycleCount: 1,
        lastTier: tier,
        lastSessionAccuracy: accuracy,
        updatedAt: now,
      };
    }
  }

  // 2. From mcqHistory (if any weak topics not in topicStrength)
  if (Array.isArray(user.mcqHistory)) {
    user.mcqHistory.slice(-15).forEach((h: any) => {
      if (h?.topicAnalysis && typeof h.topicAnalysis === 'object') {
        for (const [topicName, s] of Object.entries(h.topicAnalysis as Record<string, any>)) {
          const total = Number(s?.total) || 0;
          const correct = Number(s?.correct) || 0;
          if (total <= 0) continue;
          const subId = h.subjectId || 'GENERAL';
          const chapId = h.chapterId || 'chapter_1';
          const k = `${subId}::${chapId}::${chapId}::${topicName}`;
          if (!map[k]) {
            const acc = correct / total;
            map[k] = {
              subjectId: subId,
              subjectName: h.subjectName || subId,
              chapterId: chapId,
              chapterTitle: h.chapterTitle || 'Chapter',
              pageKey: chapId,
              pageLabel: h.chapterTitle || 'Chapter',
              topic: topicName,
              total,
              correct,
              lastAttemptAt: h.date ? new Date(h.date).getTime() : now,
              wrongQuestions: [],
              stage: 'MCQ',
              nextDueAt: acc < 0.75 ? now : now + 24 * 3600 * 1000,
              cycleCount: 1,
              lastTier: acc >= 0.8 ? 'mastered' : acc >= 0.65 ? 'strong' : acc >= 0.5 ? 'average' : 'weak',
              lastSessionAccuracy: acc,
              updatedAt: now,
            };
          }
        }
      }
    });
  }

  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sync a single TopicBucket to Firestore & Realtime Database — fire and forget.
 * Full overwrite (merge:false) so latest MCQ attempt always wins.
 */
export function syncRevisionBucket(
  userId: string,
  key: string,
  bucket: TopicBucket,
): void {
  if (!userId || !key) return;
  const payload = sanitizeForFirestore({ ...bucket, _key: key, updatedAt: Date.now() });
  try {
    setDoc(bucketRef(userId, key), payload, { merge: false }).catch(() => {});
  } catch {}

  // Also mirror summary to Realtime Database
  try {
    if (rtdb) {
      const safeKey = safeDocId(key);
      const rtdbPath = `users/${userId}/revision_summary/${safeKey}`;
      update(ref(rtdb, rtdbPath), {
        key,
        topic: bucket.topic || '',
        subjectId: bucket.subjectId || '',
        chapterId: bucket.chapterId || '',
        stage: bucket.stage || 'NOTES',
        cycleCount: bucket.cycleCount || 0,
        accuracy: bucket.lastSessionAccuracy ?? (bucket.total > 0 ? bucket.correct / bucket.total : 0),
        lastTier: bucket.lastTier || 'average',
        nextDueAt: bucket.nextDueAt || 0,
        updatedAt: Date.now(),
      }).catch(() => {});
    }
  } catch {}
}

/**
 * Sync every bucket in a TrackerMap — fire and forget.
 * Call this after any bulk update (e.g. after a full Revision Hub MCQ session).
 */
export function syncAllRevisionBuckets(userId: string, map: TrackerMap): void {
  if (!userId) return;
  const entries = Object.entries(map);
  for (const [key, bucket] of entries) {
    syncRevisionBucket(userId, key, bucket);
  }
  try {
    if (rtdb) {
      update(ref(rtdb, `users/${userId}/revisionOverview`), {
        totalBuckets: entries.length,
        lastSyncedAt: Date.now(),
      }).catch(() => {});
    }
  } catch {}
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
export async function hydrateRevisionTracker(userId: string, userSnapshot?: any): Promise<TrackerMap> {
  if (!userId) return {};
  setRevisionTrackerUser(userId);
  setRevisionHydrationState(true, false);
  try {
    const local = getTrackerMap();
    let cloud = await loadRevisionBucketsFromFirebase(userId);
    let hasCloudData = Object.keys(cloud).length > 0;

    // Fallback on device switch: If cloud revision collection is empty, reconstruct from student profile
    if (!hasCloudData && userSnapshot) {
      const reconstructed = reconstructBucketsFromUserProfile(userSnapshot);
      if (Object.keys(reconstructed).length > 0) {
        cloud = reconstructed;
        hasCloudData = true;
      }
    }

    const merged = hasCloudData
      ? mergeTrackerMaps(local, cloud)
      : local;
    replaceTrackerMap(merged);
    setRevisionHydrationState(false, true);

    if (Object.keys(merged).length > 0) syncAllRevisionBuckets(userId, merged);
    window.dispatchEvent(new CustomEvent('iic-revision-tracker-hydrated', {
      detail: { userId, count: Object.keys(merged).length },
    }));
    return merged;
  } catch (err) {
    setRevisionHydrationState(false, false);
    return getTrackerMap();
  }
}
