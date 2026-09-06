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

import { doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { ref, update, get } from 'firebase/database';
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
      // Due today only if weak
      const isDue = accuracy < 0.5;
      const attemptTime = stats.lastAttempt ? new Date(stats.lastAttempt).getTime() : 0;

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
        lastAttemptAt: attemptTime || now,
        wrongQuestions: [],
        stage: accuracy >= 0.7 ? 'NOTES' : 'MCQ',
        nextDueAt: isDue ? now : now + 24 * 3600 * 1000,
        cycleCount: 1,
        lastTier: tier,
        lastSessionAccuracy: accuracy,
        updatedAt: attemptTime || 0,
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
            const attemptTime = h.date ? new Date(h.date).getTime() : 0;
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
              lastAttemptAt: attemptTime || now,
              wrongQuestions: [],
              stage: acc >= 0.7 ? 'NOTES' : 'MCQ',
              nextDueAt: acc < 0.5 ? now : now + 24 * 3600 * 1000,
              cycleCount: 1,
              lastTier: acc >= 0.8 ? 'mastered' : acc >= 0.65 ? 'strong' : acc >= 0.5 ? 'average' : 'weak',
              lastSessionAccuracy: acc,
              updatedAt: attemptTime || 0,
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

  // Also mirror summary and full bucket to Realtime Database
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

      // Full bucket mirror in RTDB
      const fullBucketPath = `users/${userId}/revisionTracker/buckets/${safeKey}`;
      update(ref(rtdb, fullBucketPath), payload).catch(() => {});
    }
  } catch {}
}

/**
 * Sync every bucket in a TrackerMap — fire and forget using batched writes to prevent write stream exhaustion.
 * Call this after any bulk update (e.g. after a full Revision Hub MCQ session).
 */
export function syncAllRevisionBuckets(userId: string, map: TrackerMap): void {
  if (!userId) return;
  const entries = Object.entries(map || {});
  if (entries.length === 0) return;

  // Split into batches of up to 300 to stay well under Firestore's 500 operations per batch limit
  const CHUNK_SIZE = 300;
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      for (const [key, bucket] of chunk) {
        const payload = sanitizeForFirestore({ ...bucket, _key: key, updatedAt: Date.now() });
        batch.set(bucketRef(userId, key), payload, { merge: false });
      }
      batch.commit().catch(e => {
        console.warn('[revisionFirebase] batch commit failed:', e);
      });
    } catch (err) {
      console.warn('[revisionFirebase] batch init failed:', err);
    }
  }

  // Mirror all to RTDB in a single batch update
  try {
    if (rtdb) {
      const rtdbUpdates: Record<string, any> = {
        [`users/${userId}/revisionOverview/totalBuckets`]: entries.length,
        [`users/${userId}/revisionOverview/lastSyncedAt`]: Date.now(),
      };
      for (const [key, bucket] of entries) {
        const safeKey = safeDocId(key);
        const payload = sanitizeForFirestore({ ...bucket, _key: key, updatedAt: Date.now() });
        rtdbUpdates[`users/${userId}/revision_summary/${safeKey}`] = {
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
        };
        rtdbUpdates[`users/${userId}/revisionTracker/buckets/${safeKey}`] = payload;
      }
      update(ref(rtdb), rtdbUpdates).catch(() => {});
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all revision buckets from Firestore (or RTDB fallback) for a user.
 * Returns an empty map on error.
 */
export async function loadRevisionBucketsFromFirebase(
  userId: string,
): Promise<TrackerMap> {
  if (!userId) return {};
  const map: TrackerMap = {};
  try {
    const colRef = collection(db, `users/${userId}/revision_lessons`);
    const snap = await getDocs(colRef);
    snap.forEach(d => {
      const raw = d.data() as TopicBucket & { _key?: string; updatedAt?: number };
      const key = raw._key || d.id.replace(/__/g, '::');
      const { _key, updatedAt, ...bucket } = raw as any;
      map[key] = bucket as TopicBucket;
    });
  } catch {
    // Firestore error
  }

  // If Firestore had no docs or failed, try Realtime Database mirror
  if (Object.keys(map).length === 0 && rtdb) {
    try {
      const rtdbSnap = await get(ref(rtdb, `users/${userId}/revisionTracker/buckets`));
      if (rtdbSnap.exists()) {
        const val = rtdbSnap.val();
        if (val && typeof val === 'object') {
          for (const item of Object.values(val) as any[]) {
            if (item && item.topic) {
              const k = item._key || `${item.subjectId || 'GENERAL'}::${item.chapterId || 'chapter_1'}::${item.pageKey || item.chapterId || 'chapter_1'}::${item.topic}`;
              map[k] = item as TopicBucket;
            }
          }
        }
      }
    } catch (_) {}
  }

  return map;
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

    // Fallback on device switch: ONLY reconstruct from student profile if BOTH cloud AND local are empty
    if (!hasCloudData && Object.keys(local).length === 0 && userSnapshot) {
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

    // Only sync back to cloud if there are entries that were purely local or newer than cloud
    if (hasCloudData) {
      const cloudKeys = new Set(Object.keys(cloud));
      const localOnly: TrackerMap = {};
      for (const [k, b] of Object.entries(local)) {
        if (!cloudKeys.has(k) || ((b.updatedAt || 0) > (cloud[k]?.updatedAt || 0))) {
          localOnly[k] = b;
        }
      }
      if (Object.keys(localOnly).length > 0) {
        syncAllRevisionBuckets(userId, localOnly);
      }
    } else if (Object.keys(local).length > 0) {
      // First time upload for new user with local work
      syncAllRevisionBuckets(userId, local);
    }
    window.dispatchEvent(new CustomEvent('iic-revision-tracker-hydrated', {
      detail: { userId, count: Object.keys(merged).length },
    }));
    return merged;
  } catch (err) {
    setRevisionHydrationState(false, false);
    return getTrackerMap();
  }
}
