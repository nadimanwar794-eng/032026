import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc, collection, updateDoc, deleteDoc, onSnapshot, getDocs, query, where, limitToLast, orderBy, increment, arrayUnion, limit } from "firebase/firestore";
import { getDatabase, ref, set, get, onValue, update, remove, query as rtdbQuery, limitToLast as rtdbLimitToLast, orderByChild as rtdbOrderByChild, equalTo as rtdbEqualTo, runTransaction } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { storage } from "./utils/storage";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDyYNuSJr72nC52MinT0rt6jbDae8HLCts",
  authDomain: "project-1959318394445181665.firebaseapp.com",
  databaseURL: "https://project-1959318394445181665-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-1959318394445181665",
  storageBucket: "project-1959318394445181665.firebasestorage.app",
  messagingSenderId: "130030264192",
  appId: "1:130030264192:web:1b8a53d694b15c8ef1eb65"
};

// ── Stale IndexedDB guard ──────────────────────────────────────────────────
// When the Firebase project changes the old Firestore IndexedDB cache causes
// "INTERNAL ASSERTION FAILED" crashes. Detect the switch, delete every
// firestore/firebase IndexedDB database, then continue normally.
const _FSP_KEY = 'nst_firebase_project_id';
const _lastProject = (() => { try { return localStorage.getItem(_FSP_KEY); } catch { return null; } })();
if (_lastProject && _lastProject !== firebaseConfig.projectId) {
  // Project switched — nuke stale caches synchronously before init
  try {
    (indexedDB as any).databases?.().then((dbs: { name?: string }[]) => {
      dbs.filter(d => d.name && (d.name.includes('firestore') || d.name.includes('firebase')))
        .forEach(d => { try { indexedDB.deleteDatabase(d.name!); } catch {} });
    }).catch(() => {});
  } catch {}
}
try { localStorage.setItem(_FSP_KEY, firebaseConfig.projectId); } catch {}

// ── Global Firestore assertion-error auto-recovery ─────────────────────────
// If the assertion error slips through (e.g. mid-session project switch),
// delete all Firebase IndexedDB databases and hard-reload automatically.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event?.reason?.message || event?.reason || '');
    if (msg.includes('FIRESTORE') && msg.includes('INTERNAL ASSERTION FAILED')) {
      event.preventDefault();
      console.warn('[IIC] Firestore assertion error — clearing IndexedDB cache and reloading…');
      const doReload = () => { try { localStorage.removeItem(_FSP_KEY); } catch {} window.location.reload(); };
      try {
        (indexedDB as any).databases?.().then((dbs: { name?: string }[]) => {
          const dels = dbs
            .filter(d => d.name && (d.name.includes('firestore') || d.name.includes('firebase')))
            .map(d => new Promise<void>(res => {
              const r = indexedDB.deleteDatabase(d.name!);
              r.onsuccess = () => res();
              r.onerror = () => res();
            }));
          Promise.all(dels).then(doReload).catch(doReload);
        }).catch(doReload);
      } catch { doReload(); }
    }
  });
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// Use new persistentLocalCache API (replaces deprecated enableMultiTabIndexedDbPersistence)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const rtdb = getDatabase(app);
const auth = getAuth(app);

// --- EXPORTED HELPERS ---

// Helper to remove undefined fields (Firestore doesn't support them)
export const sanitizeForFirestore = (obj: any): any => {
  // Preserve Date objects (Firestore supports them or converts to Timestamp)
  if (obj instanceof Date) {
      return obj;
  }
  
  if (Array.isArray(obj)) {
    // Filter out undefineds from arrays (Firestore rejects arrays with undefined)
    return obj.map(v => sanitizeForFirestore(v)).filter(v => v !== undefined);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const value = sanitizeForFirestore(obj[key]);
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
  }
  return obj;
};

// Connection State Monitoring
let isFirebaseConnected = false;
const connectedRef = ref(rtdb, ".info/connected");
onValue(connectedRef, (snap) => {
  isFirebaseConnected = !!snap.val();
});

export const checkFirebaseConnection = () => {
  // Return true if either navigator is online AND we have a realtime connection
  // Fallback to navigator.onLine if RTDB isn't initialized yet (rare)
  return isFirebaseConnected;
};

export const subscribeToAuth = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};

// --- SAFE CACHE RESET (replaces Nuclear Reset) ---
// ── Backup ALL existing Firebase content_data → __backup__ path ──────────────
// Run this once to seed the backup with existing data. After this, every
// saveChapterData call automatically keeps the backup fresh.
export const backupAllContentToFirebase = async (
  onProgress?: (done: number, total: number, key: string) => void
): Promise<{ backed: number; failed: number }> => {
  let backed = 0, failed = 0;

  // ── 1. content_data (chapters / notes) ──────────────────────────────────────
  try {
    const snap = await get(ref(rtdb, 'content_data'));
    if (snap.exists()) {
      const all = snap.val() as Record<string, any>;
      const keys = Object.keys(all);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        try {
          await set(ref(rtdb, `__backup__/content_data/${key}`), all[key]);
          backed++;
          onProgress?.(i + 1, keys.length, key);
        } catch {
          failed++;
        }
      }
    }
  } catch {}

  // ── 2. homework_entries & lucent_entries (per-item collections) ──────────────
  try {
    const hwSnap = await get(ref(rtdb, 'homework_entries'));
    if (hwSnap.exists()) await set(ref(rtdb, '__backup__/homework_entries'), hwSnap.val());
    backed++;
  } catch { failed++; }
  try {
    const luSnap = await get(ref(rtdb, 'lucent_entries'));
    if (luSnap.exists()) await set(ref(rtdb, '__backup__/lucent_entries'), luSnap.val());
    backed++;
  } catch { failed++; }

  // ── 3. Sharded arrays: competition MCQs, daily GK, and related ───────────────
  const shardedPaths = [
    'competition_mcqs',
    'daily_gk',
    'notifications',
    'broadcast_codes',
    'global_challenge_mcq',
  ];
  for (const prefix of shardedPaths) {
    try {
      // Read meta to know how many shards exist
      const metaSnap = await get(ref(rtdb, `${prefix}_meta`));
      const shardCount: number = metaSnap.exists() ? (metaSnap.val()?.shardCount ?? 1) : 1;
      for (let idx = 0; idx < shardCount; idx++) {
        try {
          const shardSnap = await get(ref(rtdb, `${prefix}_shard_${idx}`));
          if (shardSnap.exists()) {
            await set(ref(rtdb, `__backup__/${prefix}_shard_${idx}`), shardSnap.val());
            backed++;
            onProgress?.(backed, backed + failed, `${prefix}_shard_${idx}`);
          }
        } catch { failed++; }
      }
      // Also backup meta
      if (metaSnap.exists()) {
        await set(ref(rtdb, `__backup__/${prefix}_meta`), metaSnap.val());
      }
    } catch {}
  }

  console.log(`[IIC] Full Snapshot complete: ${backed} items backed up, ${failed} failed`);
  return { backed, failed };
};

// ── Restore content_data from __backup__ → main paths ────────────────────────
// Use when content_data was accidentally deleted but backup survived.
export const restoreContentFromFirebaseBackup = async (
  onProgress?: (done: number, total: number, key: string) => void
): Promise<{ restored: number; failed: number }> => {
  const snap = await get(ref(rtdb, '__backup__/content_data'));
  if (!snap.exists()) throw new Error('Koi backup nahi mila Firebase mein. Pehle "Backup Now" karo.');
  const all = snap.val() as Record<string, any>;
  const keys = Object.keys(all);
  let restored = 0, failed = 0;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      await set(ref(rtdb, `content_data/${key}`), all[key]);
      await setDoc(doc(db, "content_data", key), sanitizeForFirestore(all[key]));
      restored++;
      onProgress?.(i + 1, keys.length, key);
    } catch {
      failed++;
    }
  }
  // ── Restore homework & lucent entries ────────────────────────────────────────
  try {
    const hwSnap = await get(ref(rtdb, '__backup__/homework_entries'));
    if (hwSnap.exists()) await set(ref(rtdb, 'homework_entries'), hwSnap.val());
    restored++;
  } catch { failed++; }
  try {
    const luSnap = await get(ref(rtdb, '__backup__/lucent_entries'));
    if (luSnap.exists()) await set(ref(rtdb, 'lucent_entries'), luSnap.val());
    restored++;
  } catch { failed++; }

  // ── Restore sharded arrays: competition MCQs, daily GK, and related ──────────
  const shardedPaths = [
    'competition_mcqs',
    'daily_gk',
    'notifications',
    'broadcast_codes',
    'global_challenge_mcq',
  ];
  for (const prefix of shardedPaths) {
    try {
      const metaSnap = await get(ref(rtdb, `__backup__/${prefix}_meta`));
      const shardCount: number = metaSnap.exists() ? (metaSnap.val()?.shardCount ?? 1) : 1;
      for (let idx = 0; idx < shardCount; idx++) {
        try {
          const shardSnap = await get(ref(rtdb, `__backup__/${prefix}_shard_${idx}`));
          if (shardSnap.exists()) {
            await set(ref(rtdb, `${prefix}_shard_${idx}`), shardSnap.val());
            await setDoc(doc(db, 'config', `${prefix}_shard_${idx}`), sanitizeForFirestore(shardSnap.val()));
            restored++;
            onProgress?.(restored, restored + failed, `${prefix}_shard_${idx}`);
          }
        } catch { failed++; }
      }
      if (metaSnap.exists()) {
        await set(ref(rtdb, `${prefix}_meta`), metaSnap.val());
        await setDoc(doc(db, 'config', `${prefix}_meta`), sanitizeForFirestore(metaSnap.val()));
      }
    } catch {}
  }

  console.log(`[IIC] Restore complete: ${restored} items restored, ${failed} failed`);
  return { restored, failed };
};

// ── Export __backup__ snapshot → downloadable JSON file ──────────────────────
// Reads all data from RTDB __backup__ path and triggers a browser file download.
export const exportBackupAsJson = async (
  onProgress?: (msg: string) => void
): Promise<void> => {
  const SHARDED = ['competition_mcqs', 'daily_gk', 'notifications', 'broadcast_codes', 'global_challenge_mcq'];
  const bundle: Record<string, any> = {
    _version: 2,
    _exportedAt: new Date().toISOString(),
    _app: 'IIC',
  };

  onProgress?.('Reading content_data…');
  try {
    const snap = await get(ref(rtdb, '__backup__/content_data'));
    if (snap.exists()) bundle.content_data = snap.val();
  } catch {}

  onProgress?.('Reading homework & lucent entries…');
  try {
    const hw = await get(ref(rtdb, '__backup__/homework_entries'));
    if (hw.exists()) bundle.homework_entries = hw.val();
  } catch {}
  try {
    const lu = await get(ref(rtdb, '__backup__/lucent_entries'));
    if (lu.exists()) bundle.lucent_entries = lu.val();
  } catch {}

  for (const prefix of SHARDED) {
    try {
      const metaSnap = await get(ref(rtdb, `__backup__/${prefix}_meta`));
      const shardCount: number = metaSnap.exists() ? (metaSnap.val()?.shardCount ?? 1) : 1;
      if (metaSnap.exists()) bundle[`${prefix}_meta`] = metaSnap.val();
      for (let idx = 0; idx < shardCount; idx++) {
        onProgress?.(`Reading ${prefix} shard ${idx}…`);
        try {
          const s = await get(ref(rtdb, `__backup__/${prefix}_shard_${idx}`));
          if (s.exists()) bundle[`${prefix}_shard_${idx}`] = s.val();
        } catch {}
      }
    } catch {}
  }

  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `iic_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
  onProgress?.('✅ Download shuru ho gaya!');
};

// ── Import JSON backup file → restore everything to Firebase ─────────────────
// Takes a parsed JSON bundle (from exportBackupAsJson) and writes it back.
// RTDB is the primary store — Firestore sync is best-effort (permission errors are tolerated).
export const importBackupFromJson = async (
  bundle: Record<string, any>,
  onProgress?: (done: number, total: number, msg: string) => void
): Promise<{ restored: number; failed: number }> => {
  if (!bundle._version) throw new Error('Invalid backup file — IIC JSON backup nahi hai.');
  const SHARDED = ['competition_mcqs', 'daily_gk', 'notifications', 'broadcast_codes', 'global_challenge_mcq'];
  let restored = 0, failed = 0;
  let step = 0;
  const contentKeys = bundle.content_data ? Object.keys(bundle.content_data) : [];
  const totalSteps = contentKeys.length + Object.keys(bundle).filter(k => !k.startsWith('_') && k !== 'content_data').length;

  // ── Restore content_data (primary: RTDB, secondary: Firestore best-effort) ──
  for (const key of contentKeys) {
    const data = bundle.content_data[key];
    let rtdbOk = false;
    try {
      await set(ref(rtdb, `content_data/${key}`), data);
      // Also write to backup path so future exports work
      await set(ref(rtdb, `__backup__/content_data/${key}`), data);
      rtdbOk = true;
    } catch (e) {
      console.error(`[IIC] RTDB write failed for ${key}:`, e);
    }
    if (rtdbOk) {
      // Firestore is best-effort — permission errors are common in dev; don't fail the item
      try {
        await setDoc(doc(db, 'content_data', key), sanitizeForFirestore(data));
      } catch (e) {
        console.warn(`[IIC] Firestore sync skipped for ${key} (non-fatal):`, (e as any)?.code ?? e);
      }
      restored++;
    } else {
      failed++;
    }
    onProgress?.(++step, totalSteps, `content_data/${key}`);
  }

  // ── Restore homework_entries ──
  if (bundle.homework_entries) {
    try {
      await set(ref(rtdb, 'homework_entries'), bundle.homework_entries);
      restored++;
    } catch { failed++; }
    onProgress?.(++step, totalSteps, 'homework_entries');
  }

  // ── Restore lucent_entries ──
  if (bundle.lucent_entries) {
    try {
      await set(ref(rtdb, 'lucent_entries'), bundle.lucent_entries);
      restored++;
    } catch { failed++; }
    onProgress?.(++step, totalSteps, 'lucent_entries');
  }

  // ── Restore sharded arrays ──
  for (const prefix of SHARDED) {
    try {
      const meta = bundle[`${prefix}_meta`];
      const shardCount: number = meta?.shardCount ?? 1;
      if (meta) {
        try { await set(ref(rtdb, `${prefix}_meta`), meta); } catch {}
        try { await setDoc(doc(db, 'config', `${prefix}_meta`), sanitizeForFirestore(meta)); } catch {}
      }
      for (let idx = 0; idx < shardCount; idx++) {
        const shardKey = `${prefix}_shard_${idx}`;
        const shardData = bundle[shardKey];
        if (!shardData) continue;
        let ok = false;
        try { await set(ref(rtdb, shardKey), shardData); ok = true; } catch { failed++; }
        if (ok) {
          try { await setDoc(doc(db, 'config', shardKey), sanitizeForFirestore(shardData)); } catch {}
          restored++;
        }
        onProgress?.(++step, totalSteps, shardKey);
      }
    } catch {}
  }

  // ── Post-import: clear stale localforage so RTDB data is fetched fresh ──────
  // getChapterData reads localforage FIRST. If old empty data was cached there,
  // it returns that instead of the freshly imported RTDB data. We must wipe it.
  try {
    const localforage = (await import('localforage')).default;
    localforage.config({ name: 'nst_storage' });
    const allCachedKeys = await localforage.keys();
    const contentCachedKeys = allCachedKeys.filter(k => k.startsWith('nst_content_'));
    await Promise.all(contentCachedKeys.map(k => localforage.removeItem(k)));
    console.log(`[IIC] Cleared ${contentCachedKeys.length} stale localforage entries`);
  } catch (e) {
    console.warn('[IIC] localforage clear failed (non-fatal):', e);
  }
  // Also clear in-memory chapter cache
  try { invalidateChapterCache(); } catch {}

  // ── Post-import: rebuild content_index so subject card badges update ────────
  // content_index is what SubjectSelection reads for Notes/PDF/MCQ badge counts.
  // Without this, all subject cards show 0 even though content is in RTDB.
  if (bundle.content_data && Object.keys(bundle.content_data).length > 0) {
    try {
      await rebuildContentIndex();
      console.log('[IIC] content_index rebuilt after JSON import');
    } catch (e) {
      console.warn('[IIC] content_index rebuild failed (non-fatal):', e);
    }
  }

  console.log(`[IIC] JSON Import complete: ${restored} restored, ${failed} failed`);
  return { restored, failed };
};

// ── Content Recovery: re-uploads all cached chapter data from IndexedDB → Firebase ──
// Useful when Firebase content got accidentally deleted but local cache (IndexedDB) still has it.
// Reads all 'nst_content_*' keys from localforage and pushes them back to RTDB + Firestore.
export const recoverContentFromCache = async (
  onProgress?: (done: number, total: number, key: string) => void
): Promise<{ recovered: number; failed: number; keys: string[] }> => {
  const localforage = (await import('localforage')).default;
  localforage.config({ name: 'nst_storage' });
  const allKeys = await localforage.keys();
  const contentKeys = allKeys.filter(k => k.startsWith('nst_content_'));
  let recovered = 0;
  let failed = 0;
  const recoveredKeys: string[] = [];
  for (let i = 0; i < contentKeys.length; i++) {
    const key = contentKeys[i];
    try {
      const data = await localforage.getItem<any>(key);
      if (!data) { failed++; continue; }
      await saveChapterData(key, data);
      recovered++;
      recoveredKeys.push(key);
      onProgress?.(i + 1, contentKeys.length, key);
    } catch (e) {
      console.error(`[IIC] Recovery failed for ${key}:`, e);
      failed++;
    }
  }
  console.log(`[IIC] Recovery complete: ${recovered} recovered, ${failed} failed`);
  return { recovered, failed, keys: recoveredKeys };
};

// ── Check what's available for recovery — shows counts from all sources ──────
// Run this BEFORE recovery to understand what options exist.
export const checkRecoveryStatus = async (): Promise<{
  localforageCount: number;
  backupCount: number;
  liveCount: number;
  localforageKeys: string[];
  backupKeys: string[];
}> => {
  const localforage = (await import('localforage')).default;
  localforage.config({ name: 'nst_storage' });

  // 1. Check localforage (this device's browser cache)
  let localforageKeys: string[] = [];
  try {
    const allKeys = await localforage.keys();
    localforageKeys = allKeys.filter(k => k.startsWith('nst_content_'));
  } catch {}

  // 2. Check Firebase __backup__/content_data
  let backupKeys: string[] = [];
  try {
    const snap = await get(ref(rtdb, '__backup__/content_data'));
    if (snap.exists()) {
      backupKeys = Object.keys(snap.val()).filter(k => k.startsWith('nst_content_'));
    }
  } catch {}

  // 3. Check live content_data in Firebase
  let liveCount = 0;
  try {
    const snap = await get(ref(rtdb, 'content_data'));
    if (snap.exists()) {
      liveCount = Object.keys(snap.val()).filter(k => k.startsWith('nst_content_')).length;
    }
  } catch {}

  return {
    localforageCount: localforageKeys.length,
    backupCount: backupKeys.length,
    liveCount,
    localforageKeys,
    backupKeys,
  };
};

// PROTECTED: content_data is NEVER deleted — it contains all educational content.
// Only local caches are cleared. User sessions and cloud data are preserved.
// ── Explicit single-item delete — ONLY way to remove homework/lucent entries ──
// These are the ONLY functions allowed to delete from homework_entries or
// lucent_entries. _savePerItemCollection NEVER deletes — it only writes/updates.
export const deleteHomeworkEntry = async (id: string): Promise<void> => {
  // Save to trash — both local storage AND Firebase RTDB/Firestore (so recoverable from any device)
  try {
    const snap = await getDoc(doc(db, 'homework_entries', id));
    const data = snap.exists() ? snap.data() : { id };
    const trashPayload = {
      collectionName: 'homework_entries',
      rtdbBasePath: 'homework_entries',
      id,
      data,
      name: (data as any)?.title || id,
      deletedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
    // Local cache trash (device-specific)
    await storage.setItem(`nst_trash_homework_entries_${id}_${Date.now()}`, trashPayload).catch(() => {});
    // Firebase trash — survives device change & cache clear, recoverable from Firebase console
    await Promise.allSettled([
      set(ref(rtdb, `trash/homework_entries/${id}`), trashPayload),
      setDoc(doc(db, 'trash_homework_entries', id), trashPayload),
    ]);
  } catch (e) {
    console.warn('[deleteHomeworkEntry] Trash backup failed (non-fatal):', e);
  }
  await Promise.allSettled([
    deleteDoc(doc(db, 'homework_entries', id)),
    remove(ref(rtdb, `homework_entries/${id}`)),
    remove(ref(rtdb, `__backup__/homework_entries/${id}`)),
  ]);
  // Update index: remove this id from config/homework_index
  try {
    const idxSnap = await getDoc(doc(db, 'config', 'homework_index'));
    const oldIds: string[] = idxSnap.exists() ? (idxSnap.data()?.ids ?? []) : [];
    const newIds = oldIds.filter(i => i !== id);
    await Promise.allSettled([
      setDoc(doc(db, 'config', 'homework_index'), { ids: newIds }),
      set(ref(rtdb, 'homework_index'), { ids: newIds }),
    ]);
  } catch {}
  console.log(`[IIC] deleteHomeworkEntry: ${id} deleted from Firebase`);
};

export const deleteLucentEntry = async (id: string): Promise<void> => {
  // Save to trash — both local storage AND Firebase RTDB/Firestore (so recoverable from any device)
  try {
    const snap = await getDoc(doc(db, 'lucent_entries', id));
    const data = snap.exists() ? snap.data() : { id };
    const trashPayload = {
      collectionName: 'lucent_entries',
      rtdbBasePath: 'lucent_entries',
      id,
      data,
      name: (data as any)?.lessonTitle || id,
      deletedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
    // Local cache trash (device-specific)
    await storage.setItem(`nst_trash_lucent_entries_${id}_${Date.now()}`, trashPayload).catch(() => {});
    // Firebase trash — survives device change & cache clear, recoverable from Firebase console
    await Promise.allSettled([
      set(ref(rtdb, `trash/lucent_entries/${id}`), trashPayload),
      setDoc(doc(db, 'trash_lucent_entries', id), trashPayload),
    ]);
  } catch (e) {
    console.warn('[deleteLucentEntry] Trash backup failed (non-fatal):', e);
  }
  await Promise.allSettled([
    deleteDoc(doc(db, 'lucent_entries', id)),
    remove(ref(rtdb, `lucent_entries/${id}`)),
    remove(ref(rtdb, `__backup__/lucent_entries/${id}`)),
  ]);
  // Update index: remove this id from config/lucent_index
  try {
    const idxSnap = await getDoc(doc(db, 'config', 'lucent_index'));
    const oldIds: string[] = idxSnap.exists() ? (idxSnap.data()?.ids ?? []) : [];
    const newIds = oldIds.filter(i => i !== id);
    await Promise.allSettled([
      setDoc(doc(db, 'config', 'lucent_index'), { ids: newIds }),
      set(ref(rtdb, 'lucent_index'), { ids: newIds }),
    ]);
  } catch {}
  console.log(`[IIC] deleteLucentEntry: ${id} deleted from Firebase`);
};

export const saveLucentEntryDirect = async (entry: any): Promise<void> => {
  const id = entry.id as string;
  const payload = sanitizeForFirestore(entry);
  await Promise.allSettled([
    setDoc(doc(db, 'lucent_entries', id), payload),
    set(ref(rtdb, `lucent_entries/${id}`), payload),
    set(ref(rtdb, `__backup__/lucent_entries/${id}`), payload),
  ]);
  console.log(`[IIC] saveLucentEntryDirect: ${id} saved`);
};

export const saveHomeworkEntryDirect = async (entry: any): Promise<void> => {
  const id = entry.id as string;
  const payload = sanitizeForFirestore(entry);
  await Promise.allSettled([
    setDoc(doc(db, 'homework_entries', id), payload),
    set(ref(rtdb, `homework_entries/${id}`), payload),
    set(ref(rtdb, `__backup__/homework_entries/${id}`), payload),
  ]);
  console.log(`[IIC] saveHomeworkEntryDirect: ${id} saved`);
};

// ── MCQ Lessons (per-lesson Firebase docs) ───────────────────────────────────
export const saveMcqLesson = async (lesson: any): Promise<void> => {
  const id = lesson.id as string;
  const payload = sanitizeForFirestore(lesson);
  await Promise.allSettled([
    setDoc(doc(db, 'mcq_lessons', id), payload),
    set(ref(rtdb, `mcq_lessons/${id}`), payload),
  ]);
  console.log(`[IIC] saveMcqLesson: ${id} saved (${lesson.mcqCount} MCQs)`);
};

export const fetchMcqLesson = async (id: string): Promise<any | null> => {
  if (!id) return null;
  try {
    const snap = await get(ref(rtdb, `mcq_lessons/${id}`));
    if (snap.exists()) return snap.val();
  } catch (_) {}
  try {
    const docSnap = await getDoc(doc(db, 'mcq_lessons', id));
    if (docSnap.exists()) return docSnap.data();
  } catch (_) {}
  return null;
};

/**
 * Search Firebase chapter content for a specific topic note.
 * Uses the content_index to find candidate chapters (by board/class/subject),
 * then fetches each candidate and looks for a matching topicNotes entry.
 * Caps at 8 candidates to limit network requests.
 */
export const fetchTopicNoteFromChapters = async (
  board: string,
  classLevel: string,
  subjectName: string,
  topicName: string
): Promise<{ title: string; content: string } | null> => {
  if (!board || !classLevel || !topicName) return null;
  try {
    const statsKey = `${board}_${classLevel}`;
    const snap = await get(ref(rtdb, `content_index/${statsKey}`));
    if (!snap.exists()) return null;
    const indexRaw = snap.val() as Record<string, { notes: boolean; subject?: string }>;
    const topicLower = topicName.trim().toLowerCase();
    const subjectLower = (subjectName || '').trim().toLowerCase();

    const findNote = async (keys: string[]) => {
      for (const safeKey of keys) {
        try {
          const data = await getChapterData(safeKey);
          if (!data || !Array.isArray(data.topicNotes)) continue;
          const note = data.topicNotes.find((n: any) =>
            n?.title && n.title.trim().toLowerCase() === topicLower
          ) || data.topicNotes.find((n: any) =>
            n?.title && (
              n.title.trim().toLowerCase().includes(topicLower) ||
              topicLower.includes(n.title.trim().toLowerCase())
            )
          );
          if (note?.content) return { title: note.title as string, content: note.content as string };
        } catch (_) { continue; }
      }
      return null;
    };

    const allKeys = Object.keys(indexRaw);

    // Pass 1: subject-filtered candidates (up to 8)
    if (subjectLower) {
      const subjectFiltered = allKeys.filter(safeKey => {
        const entry = indexRaw[safeKey];
        if (!entry?.notes) return false;
        const entrySubject = (entry.subject || '').replace(/-/g, ' ').toLowerCase();
        return entrySubject.includes(subjectLower) || subjectLower.includes(entrySubject);
      }).slice(0, 8);
      const found = await findNote(subjectFiltered);
      if (found) return found;
    }

    // Pass 2: all chapters with notes (up to 8), excluding already-checked ones
    const allWithNotes = allKeys.filter(k => indexRaw[k]?.notes).slice(0, 8);
    return await findNote(allWithNotes);
  } catch (_) {}
  return null;
};

export const deleteMcqLesson = async (id: string): Promise<void> => {
  await Promise.allSettled([
    deleteDoc(doc(db, 'mcq_lessons', id)),
    remove(ref(rtdb, `mcq_lessons/${id}`)),
  ]);
  console.log(`[IIC] deleteMcqLesson: ${id} deleted`);
};

export const subscribeMcqLessons = (cb: (lessons: any[]) => void): (() => void) => {
  const r = ref(rtdb, 'mcq_lessons');
  const unsub = onValue(r, (snap) => {
    if (!snap.exists()) { cb([]); return; }
    const val = snap.val();
    const lessons = Object.values(val) as any[];
    lessons.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    cb(lessons);
  });
  return unsub;
};

export const resetAllContent = async () => {
  let cloudError = null;
  try {
    console.log("STARTING SAFE CACHE RESET...");

    // 1. Clear only LOCAL CACHE — preserve user session and important keys
    try {
        const PRESERVE_KEYS = [
          'nst_current_user', 'nst_users', 'nst_firebase_project_id',
          'nst_system_settings', 'nst_user_history',
        ];
        const keysToRemove = Object.keys(localStorage).filter(k => !PRESERVE_KEYS.includes(k));
        keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
        // Only clear content cache in IndexedDB — NOT full wipe
        await storage.clearContentCache();
        console.log("✅ Local Cache Cleared (user session preserved)");
    } catch (localErr) {
        console.error("Local Clear Error (Non-Fatal):", localErr);
    }

    // 2. RTDB — only clear analytics/logs, NEVER content_data
    try {
        const rtdbPaths = ['public_activity', 'ai_interactions', 'universal_analysis_logs'];
        await Promise.all(rtdbPaths.map(path => remove(ref(rtdb, path))));
        console.log("✅ RTDB Analytics Cleared (content_data preserved)");
    } catch (e: any) {
        console.error("RTDB Reset Error:", e);
        cloudError = e;
    }

    // 3. Firestore — only clear analytics/logs, NEVER content_data or users
    try {
        const collections = ['public_activity', 'ai_interactions', 'universal_analysis_logs'];
        for (const colName of collections) {
          const q = query(collection(db, colName));
          const snapshot = await getDocs(q);
          const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
        }
        console.log("✅ Firestore Analytics Cleared (content_data & users preserved)");
    } catch (e: any) {
        console.error("Firestore Reset Error:", e);
        if (!cloudError) cloudError = e;
    }

    // Report Outcome
    if (cloudError) {
        throw new Error(`LOCAL CACHE CLEARED, but Cloud Reset had an error. Check Console.`);
    }

    console.log("SAFE CACHE RESET COMPLETE");
  } catch (e) {
    console.error("RESET ERROR", e);
    throw e;
  }
};

// ── Rebuild content_index from ALL existing content_data in Firebase ──────────
// Run this once to backfill the index for any content uploaded before the
// real-time index feature existed. After this, every saveChapterData call keeps
// the index fresh automatically. Progress callback: (done, total, key) => void.
export const rebuildContentIndex = async (
  onProgress?: (done: number, total: number, key: string) => void
): Promise<{ indexed: number; failed: number }> => {
  let indexed = 0, failed = 0;
  try {
    const snap = await get(ref(rtdb, 'content_data'));
    if (!snap.exists()) return { indexed: 0, failed: 0 };
    const all = snap.val() as Record<string, any>;
    const keys = Object.keys(all).filter(k => k.startsWith('nst_content_'));
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        const data = all[key] || {};
        const withoutPrefix = key.slice('nst_content_'.length);
        const parts = withoutPrefix.split('_');
        if (parts.length < 3) continue;
        const board      = parts[0];
        const classLevel = parts[1];
        const statsKey   = `${board}_${classLevel}`;
        const safeKey    = key.replace(/[.#$[\]/]/g, '-');
        const subjectName = parts.slice(2, parts.length - 1).join(' ');
        const hasNotes = !!(data.freeNotes || data.topicNotes?.length || data.premiumNotes || data.content || data.teachingStrategyNotes);
        const hasPdf   = !!(data.pdfUrl || data.pdfList?.length);
        const hasVideo = !!(data.videoPlaylist?.length || data.topicVideos?.length);
        const hasAudio = !!(data.audioPlaylist?.length);
        const hasMcq   = !!(data.manualMcqData?.length || data.weeklyTestMcqData?.length || data.mcqList?.length);
        await set(ref(rtdb, `content_index/${statsKey}/${safeKey}`), {
          notes: hasNotes, pdf: hasPdf, video: hasVideo, audio: hasAudio, mcq: hasMcq,
          subject: subjectName,
        });
        indexed++;
        onProgress?.(i + 1, keys.length, key);
      } catch {
        failed++;
      }
    }
  } catch (e) {
    console.error('[IIC] rebuildContentIndex failed:', e);
    throw e;
  }
  return { indexed, failed };
};

// --- SCORE LOG FIREBASE SYNC ---
// Saves the full score log array to RTDB under users/{uid}/scoreLog
export const saveScoreLogToFirebase = async (userId: string, log: any[]): Promise<void> => {
  if (!userId || !log) return;
  try {
    await set(ref(rtdb, `users/${userId}/scoreLog`), log);
  } catch {}
};

// Reads score log from RTDB for a user
export const getScoreLogFromFirebase = async (userId: string): Promise<any[]> => {
  if (!userId) return [];
  try {
    const snap = await get(ref(rtdb, `users/${userId}/scoreLog`));
    if (snap.exists()) {
      const val = snap.val();
      return Array.isArray(val) ? val : [];
    }
    return [];
  } catch { return []; }
};

// --- DUAL WRITE / SMART READ LOGIC ---

// 1. User Data Sync
export const saveUserToLive = async (user: any) => {
  try {
    if (!user || !user.id) return;

    // Sanitize data before saving
    const sanitizedUser = sanitizeForFirestore(user);

    // EXTRACT BULKY DATA FOR SEGREGATION
    const {
        mcqHistory, usageHistory, progress, testResults, inbox,
        topicStrength, subscriptionHistory, activeSubscriptions,
        pendingRewards, redeemedCodes, unlockedContent, timedUnlocks, dailyRoutine,
        ...coreProfile
    } = sanitizedUser;

    // ── ROLE PROTECTION ────────────────────────────────────────────────────────
    // Never downgrade a privileged role (ADMIN / SUB_ADMIN) to a lower one via
    // a regular save. If the stored role is privileged and the incoming role is
    // not, silently preserve the stored role. This prevents accidental demotion
    // caused by fallback login flows or incomplete user objects.
    const PRIVILEGED_ROLES = ['ADMIN', 'SUB_ADMIN'];
    if (coreProfile.role && !PRIVILEGED_ROLES.includes(coreProfile.role)) {
      try {
        const existingRoleSnap = await get(ref(rtdb, `users/${user.id}/role`));
        if (existingRoleSnap.exists() && PRIVILEGED_ROLES.includes(existingRoleSnap.val())) {
          console.warn(`[saveUserToLive] Role protection: preserving '${existingRoleSnap.val()}' for user ${user.id} — incoming role '${coreProfile.role}' ignored.`);
          coreProfile.role = existingRoleSnap.val();
        }
      } catch (roleCheckErr) {
        console.warn('[saveUserToLive] Role protection check failed (non-fatal):', roleCheckErr);
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    const promises = [];

    // 1. Save Core Profile to RTDB & Firestore (users/{uid})
    promises.push(update(ref(rtdb, `users/${user.id}`), coreProfile).catch(e => console.error("RTDB Core Save Error:", e)));
    promises.push(setDoc(doc(db, "users", user.id), coreProfile, { merge: true }).catch(e => console.error("Firestore Core Save Error:", e)));

    // 2. Save Bulky Data to Subcollections or Document Extensions to avoid 1MB document limit
    // Note: To keep things intact for the current frontend without massive refactoring,
    // we save the bulky data in a parallel collection `user_data/{uid}`

    // SAFETY CHECK: Only overwrite bulky data if the user object explicitly contains them.
    // This prevents accidental wiping of history if saveUserToLive is called with an incomplete user object (e.g. during a fast login/logout cycle).
    const bulkyData: any = {};
    if (user.hasOwnProperty('mcqHistory')) bulkyData.mcqHistory = mcqHistory;
    if (user.hasOwnProperty('usageHistory')) bulkyData.usageHistory = usageHistory;
    if (user.hasOwnProperty('progress')) bulkyData.progress = progress;
    if (user.hasOwnProperty('testResults')) bulkyData.testResults = testResults;
    if (user.hasOwnProperty('inbox')) bulkyData.inbox = inbox;
    if (user.hasOwnProperty('topicStrength')) bulkyData.topicStrength = topicStrength;
    if (user.hasOwnProperty('subscriptionHistory')) bulkyData.subscriptionHistory = subscriptionHistory;
    if (user.hasOwnProperty('activeSubscriptions')) bulkyData.activeSubscriptions = activeSubscriptions;
    if (user.hasOwnProperty('pendingRewards')) bulkyData.pendingRewards = pendingRewards;
    if (user.hasOwnProperty('redeemedCodes')) bulkyData.redeemedCodes = redeemedCodes;
    if (user.hasOwnProperty('unlockedContent')) bulkyData.unlockedContent = unlockedContent;
    if (user.hasOwnProperty('timedUnlocks')) bulkyData.timedUnlocks = timedUnlocks;
    if (user.hasOwnProperty('dailyRoutine')) bulkyData.dailyRoutine = dailyRoutine;

    // Use { merge: true } so we don't delete fields we didn't explicitly pass this time.
    if (Object.keys(bulkyData).length > 0) {
        promises.push(setDoc(doc(db, "user_data", user.id), sanitizeForFirestore(bulkyData), { merge: true }).catch(e => console.error("Firestore Bulky Data Save Error:", e)));
    }

    await Promise.all(promises);
  } catch (error) {
    console.error("Error saving user:", error);
  }
};

export const subscribeToUsers = (callback: (users: any[]) => void) => {
  // Prefer Firestore for Admin List (More Reliable)
  const q = collection(db, "users");
  return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data());
      if (users.length > 0) {
          callback(users);
      } else {
          // Fallback to RTDB if Firestore is empty (migration scenario)
          const usersRef = ref(rtdb, 'users');
          onValue(usersRef, (snap) => {
             const data = snap.val();
             const userList = data ? Object.values(data) : [];
             callback(userList);
          }, { onlyOnce: true });
      }
  });
};

export const subscribeToUser = (userId: string, callback: (user: any) => void) => {
    // Primary: Firestore onSnapshot (requires Firebase Auth session).
    // Fallback: RTDB onValue (no auth needed) — used when Firestore gives permission-denied
    // (e.g. RTDB-recovered login on a fresh device with no Firebase Auth session).

    let unsubRtdb: (() => void) | null = null;

    const unsubFirestore = onSnapshot(
        doc(db, "users", userId),
        (docSnap) => {
            if (docSnap.exists()) {
                // Firestore working — cancel any RTDB fallback listener
                if (unsubRtdb) { unsubRtdb(); unsubRtdb = null; }
                callback(docSnap.data());
            } else {
                // Only treat as deleted when we have an active Firebase Auth session.
                // Without a session, Firestore returns a non-existent snapshot due to
                // permission-denied — NOT because the document was truly deleted.
                if (auth.currentUser) {
                    callback(null); // genuinely deleted by admin → force logout
                }
                // No auth session → permission-denied masquerading as missing doc → ignore
            }
        },
        (error) => {
            // Firestore permission-denied → fall back to RTDB so user data still loads.
            // Any other error → log but do NOT log out the user.
            if (error.code === 'permission-denied') {
                if (!unsubRtdb) {
                    unsubRtdb = onValue(ref(rtdb, `users/${userId}`), (snap) => {
                        if (snap.exists()) {
                            callback(snap.val());
                        }
                        // RTDB also missing → user may be deleted; but we don't force-logout
                        // without a confirmed Firestore delete to avoid false positives.
                    });
                }
            } else {
                console.warn('[IIC] subscribeToUser Firestore error:', error.code);
            }
        }
    );

    return () => {
        unsubFirestore();
        if (unsubRtdb) unsubRtdb();
    };
};

export const getUserData = async (userId: string) => {
    try {
        let coreData: any = null;

        // Try RTDB
        const snap = await get(ref(rtdb, `users/${userId}`));
        if (snap.exists()) {
             coreData = snap.val();
        } else {
            // Try Firestore
            const docSnap = await getDoc(doc(db, "users", userId));
            if (docSnap.exists()) {
                 coreData = docSnap.data();
            }
        }

        if (coreData) {
             // Fetch segregated bulky data
             const bulkySnap = await getDoc(doc(db, "user_data", userId)).catch(() => null);
             if (bulkySnap && bulkySnap.exists()) {
                  return { ...coreData, ...bulkySnap.data() };
             }
             return coreData;
        }

        return null;
    } catch (e) { console.error(e); return null; }
};

export const getUserByEmail = async (email: string) => {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const coreData = querySnapshot.docs[0].data();
            // Fetch segregated bulky data to ensure history is not lost on re-login
            if (coreData && coreData.id) {
                const bulkySnap = await getDoc(doc(db, "user_data", coreData.id)).catch(() => null);
                if (bulkySnap && bulkySnap.exists()) {
                    return { ...coreData, ...bulkySnap.data() };
                }
            }
            return coreData;
        }
        return null; 
    } catch (e) { console.error(e); return null; }
};

export const getUserByNameAndClass = async (name: string, classLevel: string) => {
    try {
        const nameNorm = name.trim().toLowerCase();
        const q = query(collection(db, "users"), where("classLevel", "==", classLevel));
        const snap = await getDocs(q);
        if (snap.empty) return null;

        // Find by case-insensitive name match
        const matched = snap.docs.find(d => {
            const n = (d.data().name || '').toLowerCase().trim();
            return n === nameNorm;
        });
        if (!matched) return null;

        const coreData = matched.data();
        if (coreData?.id) {
            const bulkySnap = await getDoc(doc(db, "user_data", coreData.id)).catch(() => null);
            if (bulkySnap && bulkySnap.exists()) return { ...coreData, ...bulkySnap.data() };
        }
        return coreData;
    } catch (e) { console.error(e); return null; }
};

export const getUserByLinkedGoogleUid = async (googleUid: string) => {
    try {
        const q = query(collection(db, "users"), where("linkedGoogleUid", "==", googleUid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const coreData = querySnapshot.docs[0].data();
            if (coreData && coreData.id) {
                const bulkySnap = await getDoc(doc(db, "user_data", coreData.id)).catch(() => null);
                if (bulkySnap && bulkySnap.exists()) {
                    return { ...coreData, ...bulkySnap.data() };
                }
            }
            return coreData;
        }
        return null;
    } catch (e) { console.error(e); return null; }
};

// ── RTDB-based user lookup (works without Firebase Auth session) ──
const getUserFromRTDB = async (field: 'mobile' | 'displayId' | 'email', value: string): Promise<any | null> => {
    try {
        const q = rtdbQuery(ref(rtdb, 'users'), rtdbOrderByChild(field), rtdbEqualTo(value));
        const snap = await get(q);
        if (!snap.exists()) return null;
        const entries = Object.values(snap.val() as Record<string, any>);
        return entries.length > 0 ? entries[0] : null;
    } catch { return null; }
};

export const getUserByMobileOrId = async (input: string) => {
    try {
        // STRATEGY: Try Firestore first (requires auth session); fall back to RTDB
        // which typically has broader read rules and works on fresh devices.

        // ── 1. Firestore attempt ──
        try {
            const qMobile = query(collection(db, "users"), where("mobile", "==", input));
            const qDisplayId = query(collection(db, "users"), where("displayId", "==", input));
            const qEmail = query(collection(db, "users"), where("email", "==", input));

            const [snapMobile, snapId, snapEmail] = await Promise.all([
                getDocs(qMobile),
                getDocs(qDisplayId),
                getDocs(qEmail)
            ]);

            let coreData: any = null;
            if (!snapMobile.empty) coreData = snapMobile.docs[0].data();
            else if (!snapId.empty) coreData = snapId.docs[0].data();
            else if (!snapEmail.empty) coreData = snapEmail.docs[0].data();

            if (coreData && coreData.id) {
                const bulkySnap = await getDoc(doc(db, "user_data", coreData.id)).catch(() => null);
                if (bulkySnap && bulkySnap.exists()) {
                    return { ...coreData, ...bulkySnap.data() };
                }
                return coreData;
            }
        } catch (firestoreErr: any) {
            // Firestore blocked (permission-denied on fresh device) — fall through to RTDB
            console.warn('[IIC] Firestore lookup blocked, trying RTDB:', firestoreErr?.code);
        }

        // ── 2. RTDB fallback (no auth needed if RTDB rules allow reads) ──
        const rtdbUser =
            await getUserFromRTDB('mobile', input) ||
            await getUserFromRTDB('displayId', input) ||
            await getUserFromRTDB('email', input);

        if (rtdbUser && rtdbUser.id) {
            console.log('[IIC] User found via RTDB fallback');
            return rtdbUser;
        }

        return null;
    } catch (e) { console.error(e); return null; }
};

// 2. System Settings Sync
export const getSystemSettings = async () => {
    try {
        const snap = await get(ref(rtdb, 'system_settings'));
        if (snap.exists()) return snap.val();
    } catch (e) {
        console.warn("RTDB getSystemSettings failed:", e);
    }

    try {
        const docSnap = await getDoc(doc(db, "config", "system_settings"));
        if (docSnap.exists()) return docSnap.data();
    } catch (e) {
        console.error("Firestore getSystemSettings failed:", e);
    }

    return null;
};

// ── Auto-sharding storage helpers ─────────────────────────────────────────────
// Firestore limit: 1 MB per document. We use 512 KB (50%) as the shard
// boundary so data stays safely under the limit even with metadata overhead.
// Layout:
//   Firestore: config/{prefix}_shard_0, config/{prefix}_shard_1, …
//              config/{prefix}_meta  → { shardCount: N }
//   RTDB:      {rtdbPrefix}_shard_0, …   /  {rtdbPrefix}_meta
// Both stores are kept in sync. Firestore is the source of truth.

const SHARD_LIMIT_BYTES = 512 * 1024; // 512 KB = 50% of Firestore 1 MB limit

const _estimateBytes = (obj: any): number => {
  try { return new TextEncoder().encode(JSON.stringify(obj)).length; } catch { return 999_999; }
};

const _splitIntoShards = (items: any[]): any[][] => {
  if (items.length === 0) return [[]];
  const shards: any[][] = [];
  let shard: any[] = [];
  let shardBytes = 2; // '[]' wrapper
  for (const item of items) {
    const sz = _estimateBytes(item) + 1; // +1 for comma
    if (shardBytes + sz > SHARD_LIMIT_BYTES && shard.length > 0) {
      shards.push(shard);
      shard = [];
      shardBytes = 2;
    }
    shard.push(item);
    shardBytes += sz;
  }
  if (shard.length > 0) shards.push(shard);
  if (shards.length === 0) shards.push([]);
  return shards;
};

// Saves items across auto-sized shards. Returns a promise that resolves once
// old-shard metadata is read (needed to delete stale shards).
const _saveShardsForArray = async (
  fsPrefix: string,
  rtdbPrefix: string,
  items: any[],
  writes: Promise<any>[],
): Promise<void> => {
  const sanitized = sanitizeForFirestore(items);
  const shards = _splitIntoShards(sanitized);
  const newShardCount = shards.length;

  let oldShardCount = 1;
  try {
    const metaSnap = await getDoc(doc(db, "config", `${fsPrefix}_meta`));
    if (metaSnap.exists()) oldShardCount = metaSnap.data()?.shardCount ?? 1;
  } catch {}

  shards.forEach((shardItems, idx) => {
    writes.push(setDoc(doc(db, "config", `${fsPrefix}_shard_${idx}`), { items: shardItems }));
    writes.push(set(ref(rtdb, `${rtdbPrefix}_shard_${idx}`), { items: shardItems }));
    // ── Auto-backup mirror (never deleted) ──────────────────────────────────
    writes.push(set(ref(rtdb, `__backup__/${rtdbPrefix}_shard_${idx}`), { items: shardItems }));
  });

  for (let i = newShardCount; i < oldShardCount; i++) {
    writes.push(deleteDoc(doc(db, "config", `${fsPrefix}_shard_${i}`)));
    writes.push(remove(ref(rtdb, `${rtdbPrefix}_shard_${i}`)));
  }

  writes.push(setDoc(doc(db, "config", `${fsPrefix}_meta`), { shardCount: newShardCount }));
  writes.push(set(ref(rtdb, `${rtdbPrefix}_meta`), { shardCount: newShardCount }));
};

// Real-time subscription that dynamically tracks shard count and rebuilds the
// merged array whenever any shard or the metadata doc changes.
const _subscribeShardedArray = (
  fsPrefix: string,
  rtdbPrefix: string,
  onUpdate: (arr: any[]) => void,
): (() => void) => {
  let shardCount = 1;
  const shardsData: Record<number, any[]> = {};
  const shardsConfirmed = new Set<number>(); // which shards have fired at least once
  let metaConfirmed = false;                 // meta doc has fired at least once
  let shardUnsubs: (() => void)[] = [];

  // Only emit once meta AND every known shard have responded at least once.
  // This prevents partial / out-of-order data from being shown during initial load.
  const _rebuild = () => {
    if (!metaConfirmed) return;
    for (let i = 0; i < shardCount; i++) {
      if (!shardsConfirmed.has(i)) return; // still waiting for this shard
    }
    const all: any[] = [];
    for (let i = 0; i < shardCount; i++) {
      const s = shardsData[i];
      if (s) all.push(...s);
    }
    onUpdate(all);
  };

  const _listenToShard = (idx: number): (() => void) => {
    let fsOk = false;
    const unsubFs = onSnapshot(doc(db, "config", `${fsPrefix}_shard_${idx}`), (snap) => {
      fsOk = true;
      shardsData[idx] = snap.exists() ? (snap.data()?.items ?? []) : [];
      shardsConfirmed.add(idx);
      _rebuild();
    });
    const unsubRtdb = onValue(ref(rtdb, `${rtdbPrefix}_shard_${idx}`), (snap) => {
      if (fsOk) return;
      shardsData[idx] = snap.val()?.items ?? [];
      shardsConfirmed.add(idx);
      _rebuild();
    });
    return () => { unsubFs(); unsubRtdb(); };
  };

  const _applyShardCount = (count: number) => {
    if (count === shardCount && shardUnsubs.length === count) return;
    // Tear down extra listeners if shard count shrank
    for (let i = count; i < shardUnsubs.length; i++) {
      shardUnsubs[i]?.();
      delete shardsData[i];
      shardsConfirmed.delete(i);
    }
    shardUnsubs = shardUnsubs.slice(0, count);
    // Add new listeners for newly added shards
    for (let i = shardUnsubs.length; i < count; i++) {
      shardUnsubs.push(_listenToShard(i));
    }
    shardCount = count;
  };

  // Start listening to shard 0 immediately — it will be ready before meta.
  _applyShardCount(1);

  let metaFromFs = false;
  const unsubMeta = onSnapshot(doc(db, "config", `${fsPrefix}_meta`), (snap) => {
    metaFromFs = true;
    metaConfirmed = true;
    _applyShardCount(snap.exists() ? (snap.data()?.shardCount ?? 1) : 1);
    _rebuild(); // re-check now that meta is confirmed
  });
  const unsubMetaRtdb = onValue(ref(rtdb, `${rtdbPrefix}_meta`), (snap) => {
    if (metaFromFs) return;
    metaConfirmed = true;
    _applyShardCount(snap.val()?.shardCount ?? 1);
    _rebuild();
  });

  return () => {
    shardUnsubs.forEach(u => u());
    unsubMeta();
    unsubMetaRtdb();
  };
};

// Per-item collection helper: saves each item as its own Firestore document
// (identical to the lucent_entries pattern). Use for arrays whose individual
// items can themselves be large (e.g. HomeworkItem with embedded HTML + MCQs).
const _savePerItemCollection = async (
  collectionName: string,
  rtdbBasePath: string,
  indexFsDocId: string,
  rtdbIndexPath: string,
  items: any[],
  writes: Promise<any>[],
): Promise<void> => {
  const sanitized: any[] = sanitizeForFirestore(items);
  const newIds: string[] = sanitized.map((e: any) => e?.id).filter(Boolean);

  // ── If new array is empty, skip entirely — never touch index ────────────────
  // An empty array almost certainly means the collection hasn't loaded yet
  // (race condition). Overwriting with empty would hide all existing entries.
  if (newIds.length === 0) {
    console.warn(`[IIC] _savePerItemCollection(${collectionName}): new array is empty — skipping entirely to protect existing Firebase data.`);
    return;
  }

  // Write/update every document in this batch
  sanitized.forEach((entry: any) => {
    if (!entry?.id) return;
    writes.push(setDoc(doc(db, collectionName, entry.id), entry));
    writes.push(set(ref(rtdb, `${rtdbBasePath}/${entry.id}`), entry));
    // ── Backup mirror (NEVER deleted by any cleanup) ─────────────────────────
    writes.push(set(ref(rtdb, `__backup__/${rtdbBasePath}/${entry.id}`), entry));
  });

  // ── SAFE INDEX UPDATE: MERGE, not overwrite ───────────────────────────────
  // Read the current index from Firebase and UNION it with newIds.
  // This ensures IDs present in Firebase but not in this batch (because the
  // admin session hadn't loaded them yet) are NEVER silently removed.
  // Removal from the index happens ONLY via explicit deleteHomeworkEntry /
  // deleteLucentEntry calls — never as a side-effect of a settings save.
  try {
    const oldSnap = await getDoc(doc(db, "config", indexFsDocId));
    const existingIds: string[] = oldSnap.exists() ? (oldSnap.data()?.ids ?? []) : [];
    // Union: keep all existing IDs + add any brand-new ones from this batch
    const mergedIds: string[] = [...new Set([...existingIds, ...newIds])];
    const indexPayload = { ids: mergedIds };
    writes.push(setDoc(doc(db, "config", indexFsDocId), indexPayload));
    writes.push(set(ref(rtdb, rtdbIndexPath), indexPayload));
    console.log(`[IIC] _savePerItemCollection(${collectionName}): index merged — existing ${existingIds.length} + new ${newIds.length} → ${mergedIds.length} total IDs`);
  } catch (e) {
    // If index read fails, fall back to writing only what we know — still safe
    // because we never shrink below newIds
    console.warn(`[IIC] _savePerItemCollection(${collectionName}): index read failed, falling back to newIds only:`, e);
    const indexPayload = { ids: newIds };
    writes.push(setDoc(doc(db, "config", indexFsDocId), indexPayload));
    writes.push(set(ref(rtdb, rtdbIndexPath), indexPayload));
  }
};

// Per-item collection subscriber. Returns up to 4 unsub functions.
// IMPORTANT: only emits once BOTH the collection snapshot AND the index have
// responded at least once. This prevents empty-flash (index loads first →
// order=[] → empty array emitted) or orphan-flash (collection loads first →
// items shown in arbitrary order before index arrives).
const _subscribePerItemCollection = (
  collectionName: string,
  rtdbBasePath: string,
  indexFsDocId: string,
  rtdbIndexPath: string,
  onUpdate: (arr: any[]) => void,
): (() => void)[] => {
  let itemMap: Record<string, any> = {};
  let order: string[] = [];
  let collectionConfirmed = false; // collection snapshot has fired at least once
  let indexConfirmed = false;      // index snapshot has fired at least once
  let collectionFromFs = false;
  let indexFromFs = false;

  // Only emit when BOTH collection AND index are confirmed.
  const _rebuild = () => {
    if (!collectionConfirmed || !indexConfirmed) return;
    onUpdate(order.map(id => itemMap[id]).filter(Boolean));
  };

  // Firestore collection — source of truth for item data
  const unsubCollection = onSnapshot(collection(db, collectionName), (snapshot) => {
    collectionFromFs = true;
    collectionConfirmed = true;
    itemMap = {};
    snapshot.forEach(d => { itemMap[d.id] = d.data(); });
    _rebuild();
  });

  // RTDB backup — only fills itemMap before Firestore confirms (offline / cold start)
  const unsubRtdb = onValue(ref(rtdb, rtdbBasePath), (snap) => {
    if (collectionFromFs) return; // Firestore is source of truth once it responds
    const data = snap.val();
    if (data && typeof data === 'object') {
      collectionConfirmed = true;
      Object.entries(data).forEach(([id, entry]: [string, any]) => {
        if (!itemMap[id]) itemMap[id] = entry;
      });
      _rebuild();
    }
  });

  // Firestore index — source of truth for ordering
  const unsubIndex = onSnapshot(doc(db, "config", indexFsDocId), (snap) => {
    indexFromFs = true;
    indexConfirmed = true;
    order = snap.exists() ? (snap.data()?.ids ?? []) : [];
    _rebuild();
  });

  // RTDB index backup
  const unsubIndexRtdb = onValue(ref(rtdb, rtdbIndexPath), (snap) => {
    if (indexFromFs) return;
    const d = snap.val();
    if (d?.ids) {
      indexConfirmed = true;
      order = d.ids;
      _rebuild();
    } else if (!indexConfirmed) {
      // RTDB responded but no index yet — treat as confirmed empty so we don't block forever
      indexConfirmed = true;
      _rebuild();
    }
  });

  return [unsubCollection, unsubRtdb, unsubIndex, unsubIndexRtdb];
};

// ─────────────────────────────────────────────────────────────────────────────

export const saveSystemSettings = async (settings: any) => {
  try {
    // ── Extract ALL bulky arrays from core settings ───────────────────────────
    // config/system_settings now contains ONLY scalar settings — it will never
    // approach 1 MB. Each array type lives in its own segregated storage path.
    const {
      lucentNotes,
      homework,
      competitionMcqs,
      dailyGk,
      notifications,
      broadcastRedeemCodes,
      globalChallengeMcq,
      ...coreSettings
    } = settings;
    const sanitizedCore = sanitizeForFirestore(coreSettings);

    const writes: Promise<any>[] = [
      set(ref(rtdb, 'system_settings'), sanitizedCore),
      setDoc(doc(db, "config", "system_settings"), sanitizedCore),
    ];

    // ── homework: per-item documents (each can be large — HTML + MCQs) ───────
    // BUG FIX: Only save homework when array has actual entries.
    // An empty array passed before the subscription loads would wipe ALL homework entries.
    // This mirrors the same protection already applied to lucentNotes in handleSaveSettings.
    if (homework != null && Array.isArray(homework) && homework.length > 0) {
      await _savePerItemCollection(
        "homework_entries", "homework_entries",
        "homework_index", "homework_index",
        homework, writes,
      );
    }

    // ── competitionMcqs: auto-sharded at 512 KB ───────────────────────────────
    if (competitionMcqs != null && Array.isArray(competitionMcqs)) {
      await _saveShardsForArray("competition_mcqs", "competition_mcqs", competitionMcqs, writes);
    }

    // ── dailyGk: auto-sharded at 512 KB ──────────────────────────────────────
    if (dailyGk != null && Array.isArray(dailyGk)) {
      await _saveShardsForArray("daily_gk", "daily_gk", dailyGk, writes);
    }

    // ── notifications: auto-sharded at 512 KB ────────────────────────────────
    if (notifications != null && Array.isArray(notifications)) {
      await _saveShardsForArray("notifications", "notifications", notifications, writes);
    }

    // ── broadcastRedeemCodes: auto-sharded at 512 KB ──────────────────────────
    if (broadcastRedeemCodes != null && Array.isArray(broadcastRedeemCodes)) {
      await _saveShardsForArray("broadcast_codes", "broadcast_codes", broadcastRedeemCodes, writes);
    }

    // ── globalChallengeMcq: auto-sharded at 512 KB ───────────────────────────
    if (globalChallengeMcq != null && Array.isArray(globalChallengeMcq)) {
      await _saveShardsForArray("global_challenge_mcq", "global_challenge_mcq", globalChallengeMcq, writes);
    }

    // ── lucentNotes: per-item documents (existing pattern — unchanged) ────────
    if (lucentNotes != null && Array.isArray(lucentNotes)) {
      await _savePerItemCollection(
        "lucent_entries", "lucent_entries",
        "lucent_index", "lucent_index",
        lucentNotes, writes,
      );
    }

    const results = await Promise.allSettled(writes);
    const anySuccess = results.some(r => r.status === 'fulfilled');
    const errors = results.filter(r => r.status === 'rejected').map((r: any) => r.reason);

    if (!anySuccess) {
      throw new Error(errors.map(e => e.message).join(' | ') || "All writes failed");
    } else if (errors.length > 0) {
      console.warn("Partial Save Warning:", errors);
    }
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
};

export const subscribeToSettings = (callback: (settings: any) => void) => {
  // ── State ────────────────────────────────────────────────────────────────────
  let latestCore: any = null;

  // Bulky arrays — null = not yet loaded (fall back to embedded value in latestCore).
  let latestHomework:          any[] | null = null;
  let latestCompetitionMcqs:   any[] | null = null;
  let latestDailyGk:           any[] | null = null;
  let latestNotifications:     any[] | null = null;
  let latestBroadcastCodes:    any[] | null = null;
  let latestGlobalChallengeMcq: any[] | null = null;

  // Lucent per-item state
  let latestLucentMap: Record<string, any> = {};
  let latestOrder: string[] = [];
  let lucentEntriesConfirmed = false;

  // ── Emit ─────────────────────────────────────────────────────────────────────
  const emit = () => {
    if (latestCore == null) return;

    // Prefer separately-loaded arrays; fall back to any embedded value in
    // latestCore for backward compat with data saved before this migration.
    const merged: any = {
      ...latestCore,
      homework:            latestHomework            ?? latestCore.homework            ?? [],
      competitionMcqs:     latestCompetitionMcqs     ?? latestCore.competitionMcqs     ?? [],
      dailyGk:             latestDailyGk             ?? latestCore.dailyGk             ?? [],
      notifications:       latestNotifications       ?? latestCore.notifications       ?? [],
      broadcastRedeemCodes: latestBroadcastCodes     ?? latestCore.broadcastRedeemCodes ?? [],
      globalChallengeMcq:  latestGlobalChallengeMcq  ?? latestCore.globalChallengeMcq  ?? [],
    };

    if (lucentEntriesConfirmed) {
      merged.lucentNotes = latestOrder.map(id => latestLucentMap[id]).filter(Boolean);
    }

    callback(merged);
  };

  // ── Core settings (Firestore primary, RTDB backup) ────────────────────────
  let coreFromFs = false;
  const unsubCoreFs = onSnapshot(doc(db, "config", "system_settings"), (snap) => {
    coreFromFs = true;
    if (snap.exists()) { latestCore = snap.data(); emit(); }
  });
  const unsubCoreRtdb = onValue(ref(rtdb, 'system_settings'), (snap) => {
    if (coreFromFs) return;
    const d = snap.val(); if (d) { latestCore = d; emit(); }
  });

  // ── homework: per-item collection subscription ────────────────────────────
  const unsubHomework = _subscribePerItemCollection(
    "homework_entries", "homework_entries", "homework_index", "homework_index",
    (arr) => { latestHomework = arr; emit(); },
  );

  // ── sharded array subscriptions ───────────────────────────────────────────
  const unsubCompetition = _subscribeShardedArray(
    "competition_mcqs", "competition_mcqs",
    (arr) => { latestCompetitionMcqs = arr; emit(); },
  );
  const unsubDailyGk = _subscribeShardedArray(
    "daily_gk", "daily_gk",
    (arr) => { latestDailyGk = arr; emit(); },
  );
  const unsubNotifs = _subscribeShardedArray(
    "notifications", "notifications",
    (arr) => { latestNotifications = arr; emit(); },
  );
  const unsubBroadcast = _subscribeShardedArray(
    "broadcast_codes", "broadcast_codes",
    (arr) => { latestBroadcastCodes = arr; emit(); },
  );
  const unsubGlobalMcq = _subscribeShardedArray(
    "global_challenge_mcq", "global_challenge_mcq",
    (arr) => { latestGlobalChallengeMcq = arr; emit(); },
  );

  // ── lucent: per-item collection (Firestore primary) ───────────────────────
  const unsubLucentEntries = onSnapshot(collection(db, "lucent_entries"), (snapshot) => {
    latestLucentMap = {};
    snapshot.forEach(d => { latestLucentMap[d.id] = d.data(); });
    lucentEntriesConfirmed = true;
    emit();
  });
  const unsubLucentRtdb = onValue(ref(rtdb, 'lucent_entries'), (snap) => {
    if (lucentEntriesConfirmed) return;
    const data = snap.val();
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([id, entry]: [string, any]) => {
        if (!latestLucentMap[id]) latestLucentMap[id] = entry;
      });
      lucentEntriesConfirmed = true;
      emit();
    }
  });
  let lucentIndexFromFs = false;
  const unsubLucentIndex = onSnapshot(doc(db, "config", "lucent_index"), (snap) => {
    lucentIndexFromFs = true;
    if (snap.exists()) { latestOrder = snap.data()?.ids ?? []; emit(); }
  });
  const unsubLucentIndexRtdb = onValue(ref(rtdb, 'lucent_index'), (snap) => {
    if (lucentIndexFromFs) return;
    const d = snap.val(); if (d?.ids) { latestOrder = d.ids; emit(); }
  });

  return () => {
    unsubCoreFs(); unsubCoreRtdb();
    unsubHomework.forEach(u => u());
    unsubCompetition();
    unsubDailyGk();
    unsubNotifs();
    unsubBroadcast();
    unsubGlobalMcq();
    unsubLucentEntries(); unsubLucentRtdb();
    unsubLucentIndex(); unsubLucentIndexRtdb();
  };
};

// 3. Content Links Sync (Bulk Uploads)
export const bulkSaveLinks = async (updates: Record<string, any>) => {
  try {
    const sanitizedUpdates = sanitizeForFirestore(updates);
    const promises = [];

    // RTDB
    promises.push(update(ref(rtdb, 'content_links'), sanitizedUpdates));
    
    // Firestore - Merge into existing content_data documents so that only
    // freeLink/premiumLink/price fields are updated — all other fields (notes,
    // videos, PDFs, MCQs) are preserved even if they are absent from `data`.
    // Using plain setDoc (no merge) here would REPLACE the entire document and
    // silently wipe all chapter content whenever localStorage is stale/empty.
    Object.entries(sanitizedUpdates).forEach(([key, data]) => {
         promises.push(setDoc(doc(db, "content_data", key), data as any, { merge: true }));
    });

    const results = await Promise.allSettled(promises);
    const anySuccess = results.some(r => r.status === 'fulfilled');
    const errors = results.filter(r => r.status === 'rejected').map((r: any) => r.reason);

    if (!anySuccess) {
      throw new Error(errors.map(e => e.message).join(' | ') || "All bulk saves failed");
    } else if (errors.length > 0) {
      console.warn("Partial Bulk Save Warning:", errors);
    }
  } catch (error) {
    console.error("Error bulk saving links:", error);
    throw error;
  }
};

// 4. Chapter Data Sync (Individual)
export const saveChapterData = async (key: string, data: any) => {
  try {
    // 1. Sanitize Data
    const sanitizedData = sanitizeForFirestore(data);

    // 2. Cache Locally (Primary Source of Truth for this user session) +
    //    update the in-memory cache so next read is instant and fresh.
    await storage.setItem(key, sanitizedData);
    try { _memCachePut(key, sanitizedData); } catch {}

    // 3. Cloud Sync (Wait for at least one success to confirm)
    const promises: Promise<any>[] = [];
    promises.push(set(ref(rtdb, `content_data/${key}`), sanitizedData));
    promises.push(setDoc(doc(db, "content_data", key), sanitizedData));
    // ── Backup mirror: RTDB __backup__/content_data/{key} — never deleted ────
    promises.push(set(ref(rtdb, `__backup__/content_data/${key}`), sanitizedData));

    // 4. Update content_index for real-time stats on home screen
    if (key.startsWith('nst_content_')) {
      try {
        const withoutPrefix = key.slice('nst_content_'.length); // e.g. "CBSE_10_Physics_ch1"
        const parts = withoutPrefix.split('_');
        if (parts.length >= 3) {
          const board = parts[0];       // CBSE or BSEB
          const classLevel = parts[1];  // 6-12 or COMPETITION
          const statsKey = `${board}_${classLevel}`;
          const safeKey = key.replace(/[.#$[\]/]/g, '-');
          // Subject is everything between classLevel and last part (chapterId)
          const subjectName = parts.slice(2, parts.length - 1).join(' ');
          const hasNotes = !!(sanitizedData.freeNotes || sanitizedData.topicNotes?.length || sanitizedData.premiumNotes || sanitizedData.content || sanitizedData.teachingStrategyNotes);
          const hasPdf   = !!(sanitizedData.pdfUrl || sanitizedData.pdfList?.length);
          const hasVideo = !!(sanitizedData.videoPlaylist?.length || sanitizedData.topicVideos?.length);
          const hasAudio = !!(sanitizedData.audioPlaylist?.length);
          const hasMcq   = !!(sanitizedData.manualMcqData?.length || sanitizedData.weeklyTestMcqData?.length || sanitizedData.mcqList?.length);
          promises.push(
            set(ref(rtdb, `content_index/${statsKey}/${safeKey}`), {
              notes: hasNotes, pdf: hasPdf, video: hasVideo, audio: hasAudio, mcq: hasMcq,
              subject: subjectName,
            })
          );
        }
      } catch (_indexErr) {
        // Non-fatal — index update failure should not block content save
      }
    }

    const results = await Promise.allSettled(promises);
    const anySuccess = results.some(r => r.status === 'fulfilled');
    const errors = results.filter(r => r.status === 'rejected').map((r: any) => r.reason);

    if (!anySuccess) {
      throw new Error(errors.map(e => e.message).join(' | ') || "All chapter saves failed");
    } else if (errors.length > 0) {
      console.warn("Partial Chapter Save Warning:", errors);
    }
    return true;
  } catch (error) {
    console.error("Error saving chapter data:", error);
    throw error;
  }
};

// Subscribe to content_index stats for a board+class — returns an unsubscribe fn.
export interface ContentTypeStats { notes: number; pdf: number; video: number; audio: number; mcq: number; }
export type ContentIndexMap = Record<string, { notes: boolean; pdf: boolean; video: boolean; audio: boolean; mcq: boolean; subject?: string }>;
export const subscribeToContentIndex = (
  board: string,
  classLevel: string,
  callback: (stats: ContentTypeStats, rawIndex: ContentIndexMap) => void
): (() => void) => {
  const statsKey = `${board}_${classLevel}`;
  const indexRef = ref(rtdb, `content_index/${statsKey}`);
  return onValue(indexRef, (snap) => {
    if (!snap.exists()) { callback({ notes: 0, pdf: 0, video: 0, audio: 0, mcq: 0 }, {}); return; }
    const raw = snap.val() as ContentIndexMap;
    const entries = Object.values(raw);
    callback({
      notes: entries.filter(e => e?.notes).length,
      pdf:   entries.filter(e => e?.pdf).length,
      video: entries.filter(e => e?.video).length,
      audio: entries.filter(e => e?.audio).length,
      mcq:   entries.filter(e => e?.mcq).length,
    }, raw);
  });
};

// ── In-memory LRU cache for chapter data ─────────────────────────────────────
// Same-session repeat fetches return INSTANTLY from this map (no IndexedDB,
// no network). Capped to 60 entries so memory stays bounded even after a long
// session. We use a Map (insertion-ordered) so the eviction-of-oldest strategy
// is just `keys().next().value`. Cache is invalidated by: (a) saveChapterData
// after a successful write, and (b) the realtime subscriber in
// `subscribeToChapterData` whenever a fresh snapshot arrives.
const CHAPTER_MEM_CACHE: Map<string, any> = new Map();
const CHAPTER_MEM_CACHE_MAX = 60;
const _memCachePut = (key: string, data: any) => {
    if (CHAPTER_MEM_CACHE.has(key)) CHAPTER_MEM_CACHE.delete(key);
    CHAPTER_MEM_CACHE.set(key, data);
    if (CHAPTER_MEM_CACHE.size > CHAPTER_MEM_CACHE_MAX) {
        const oldest = CHAPTER_MEM_CACHE.keys().next().value;
        if (oldest) CHAPTER_MEM_CACHE.delete(oldest);
    }
};
export const invalidateChapterCache = (key?: string) => {
    if (key) CHAPTER_MEM_CACHE.delete(key);
    else CHAPTER_MEM_CACHE.clear();
};

// Stale-while-revalidate: returns the FASTEST source (memory > storage)
// immediately, while refreshing from the network in the background.
// Worst-case latency: ~5 ms (storage hit) instead of ~500-2000 ms (RTDB hit).
export const getChapterData = async (key: string) => {
    // 1. ⚡ In-memory cache — instant (microseconds)
    if (CHAPTER_MEM_CACHE.has(key)) {
        const cached = CHAPTER_MEM_CACHE.get(key);
        // Background refresh so next call still benefits if RTDB has updates.
        // (Fire-and-forget — does NOT block return.)
        _backgroundRefreshChapter(key);
        return cached;
    }

    // 2. ⚡ Local storage — very fast (~5 ms via IndexedDB)
    try {
        const stored = await storage.getItem(key);
        if (stored) {
            _memCachePut(key, stored);
            // Same background refresh so memory cache catches latest server data.
            _backgroundRefreshChapter(key);
            return stored;
        }
    } catch (e) {
        // continue to network
    }

    // 3. Network — RTDB first, then Firestore fallback
    try {
        const snapshot = await get(ref(rtdb, `content_data/${key}`));
        if (snapshot.exists()) {
            const data = snapshot.val();
            _memCachePut(key, data);
            await storage.setItem(key, data);
            return data;
        }
    } catch (e) {
        console.warn("RTDB fetch failed for chapter data:", e);
    }

    try {
        const docSnap = await getDoc(doc(db, "content_data", key));
        if (docSnap.exists()) {
            const data = docSnap.data();
            _memCachePut(key, data);
            await storage.setItem(key, data);
            return data;
        }
    } catch (e) {
        console.warn("Firestore fetch failed for chapter data:", e);
    }

    return null;
};

// Background-only refresh — never blocks the UI. Updates the in-memory + storage
// caches if the network has newer data than what we just served.
const _backgroundRefreshInFlight = new Set<string>();
const _backgroundRefreshChapter = (key: string) => {
    if (_backgroundRefreshInFlight.has(key)) return;
    _backgroundRefreshInFlight.add(key);
    get(ref(rtdb, `content_data/${key}`))
      .then(snap => {
        if (snap.exists()) {
            const data = snap.val();
            _memCachePut(key, data);
            storage.setItem(key, data).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => { _backgroundRefreshInFlight.delete(key); });
};

// Public helper — pre-warm the cache for a list of chapter keys when the user
// is about to need them (e.g., when they open a subject, prefetch the first
// few chapters). Runs entirely in the background, never blocks.
export const prefetchChapterData = (keys: string[]) => {
    for (const k of keys) {
        if (!k || CHAPTER_MEM_CACHE.has(k)) continue;
        // Use storage as the warmer first, then network refresh.
        storage.getItem(k).then(stored => {
            if (stored) _memCachePut(k, stored);
            _backgroundRefreshChapter(k);
        }).catch(() => {
            _backgroundRefreshChapter(k);
        });
    }
};

// Used by client to listen for realtime changes to a specific chapter
export const subscribeToChapterData = (key: string, callback: (data: any) => void) => {
    const rtdbRef = ref(rtdb, `content_data/${key}`);
    return onValue(rtdbRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            // RTDB empty — fall back to Firestore with error handling.
            // Errors are logged but never silently swallowed so the caller
            // can detect failures (previously: blank page with no clue why).
            getDoc(doc(db, "content_data", key))
                .then(docSnap => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        // Write back to RTDB so next read is fast and offline-safe
                        set(ref(rtdb, `content_data/${key}`), data).catch(() => {});
                        callback(data);
                    }
                    // else: document truly doesn't exist yet — leave content blank (correct)
                })
                .catch(e => {
                    console.error(`[IIC] subscribeToChapterData Firestore fallback failed for "${key}":`, e);
                    // Re-try once with anonymous auth in case the session expired
                    import('firebase/auth').then(({ signInAnonymously: _signIn }) =>
                        _signIn(auth)
                            .then(() => getDoc(doc(db, "content_data", key)))
                            .then(docSnap => { if (docSnap.exists()) callback(docSnap.data()); })
                            .catch(e2 => console.error('[IIC] Auth retry also failed:', e2))
                    );
                });
        }
    }, (error) => {
        console.error(`[IIC] subscribeToChapterData RTDB error for "${key}":`, error);
    });
};

export const getApiUsage = async () => {
    try {
        const date = new Date().toISOString().split('T')[0];
        const docSnap = await getDoc(doc(db, "admin_stats", `api_usage_${date}`));
        return docSnap.exists() ? docSnap.data() : null;
    } catch (e) {
        return null;
    }
};

export const subscribeToDrafts = (callback: (drafts: any[]) => void) => {
    const q = query(collection(db, "content_data"), where("isDraft", "==", true));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), key: doc.id }));
        callback(items);
    });
};

export const saveTestResult = async (userId: string, attempt: any) => {
    try {
        const docId = `${attempt.testId}_${Date.now()}`;
        const sanitizedAttempt = sanitizeForFirestore(attempt);
        await setDoc(doc(db, "users", userId, "test_results", docId), sanitizedAttempt);
    } catch(e) { console.error(e); }
};

export const saveUserHistory = async (userId: string, historyItem: any) => {
    try {
        const docId = `history_${historyItem.id || Date.now()}`;
        const sanitized = sanitizeForFirestore(historyItem);
        // Save to subcollection "history" under the user
        await setDoc(doc(db, "users", userId, "history", docId), sanitized);
    } catch(e) { console.error("Error saving history:", e); }
};

export const getUserSavedNotes = async (userId: string) => {
    try {
        const q = query(collection(db, "users", userId, "history"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs.map(doc => doc.data());
        }
        return [];
    } catch(e) {
        console.error("Error fetching user saved notes history:", e);
        return [];
    }
};

export const updateUserStatus = async (userId: string, time: number) => {
     try {
        const today = new Date().toISOString().split('T')[0];
        const userRef = ref(rtdb, `users/${userId}`);

        // Use a transaction or simple read-update to handle streak
        // Since Firebase transactions can be tricky with partial data, we'll try a simpler approach first
        // Ideally this should be server-side, but for now client-side logic in App.tsx handles streak display.
        // Here we primarily update active time for "Online" status.

        // HOWEVER, user reported streak not working.
        // Streak is calculated in `App.tsx` (useEffect) -> `checkStreak`.
        // `updateUserStatus` is called every 10 seconds.
        // We should ensure we are NOT overwriting `streak` here accidentally if we were doing so.
        // We are ONLY updating `lastActiveTime`.

        await update(userRef, { lastActiveTime: new Date().toISOString() });
    } catch (error) {
        console.error("Error updating user status:", error);
    }
};

// 5. Custom Syllabus Sync
export const saveCustomSyllabus = async (key: string, chapters: any[]) => {
    try {
        const sanitizedData = sanitizeForFirestore(chapters);
        const promises = [
            set(ref(rtdb, `custom_syllabus/${key}`), sanitizedData),
            setDoc(doc(db, "custom_syllabus", key), { chapters: sanitizedData })
        ];

        const results = await Promise.allSettled(promises);
        const anySuccess = results.some(r => r.status === 'fulfilled');
        const errors = results.filter(r => r.status === 'rejected').map((r: any) => r.reason);

        if (!anySuccess) {
            throw new Error(errors.map(e => e.message).join(' | ') || "All syllabus saves failed");
        } else if (errors.length > 0) {
            console.warn("Partial Syllabus Save Warning:", errors);
        }
    } catch (error) {
        console.error("Error saving syllabus:", error);
        throw error;
    }
};

export const deleteCustomSyllabus = async (key: string) => {
    try {
        const promises = [
            remove(ref(rtdb, `custom_syllabus/${key}`)),
            deleteDoc(doc(db, "custom_syllabus", key))
        ];

        const results = await Promise.allSettled(promises);
        const anySuccess = results.some(r => r.status === 'fulfilled');
        const errors = results.filter(r => r.status === 'rejected').map((r: any) => r.reason);

        if (!anySuccess) {
            throw new Error(errors.map(e => e.message).join(' | ') || "All syllabus deletes failed");
        } else if (errors.length > 0) {
            console.warn("Partial Syllabus Delete Warning:", errors);
        }
    } catch(e) {
        console.error("Error deleting syllabus", e);
        throw e;
    }
};

export const getCustomSyllabus = async (key: string) => {
    try {
        // Try RTDB
        const snap = await get(ref(rtdb, `custom_syllabus/${key}`));
        if (snap.exists()) return snap.val();
    } catch(e) { console.warn("RTDB getCustomSyllabus failed:", e); }

    try {
        // Try Firestore
        const docSnap = await getDoc(doc(db, "custom_syllabus", key));
        if (docSnap.exists()) return docSnap.data().chapters;
    } catch(e) { console.error("Firestore getCustomSyllabus failed:", e); }

    return null;
};

// 6. Public Activity Feed (Live Results)
export const savePublicActivity = async (activity: any) => {
    try {
        const sanitized = sanitizeForFirestore(activity);
        const docId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // RTDB (Limit to last 100 via logic if possible, but simple push here)
        // We'll just set it. For a real feed, we might want 'push'.
        // But let's use a fixed path structure for simplicity in list retrieval
        await set(ref(rtdb, `public_activity/${docId}`), sanitized);
        
        // Firestore (Auto-delete old via index policy if needed, or just keep)
        await setDoc(doc(db, "public_activity", docId), sanitized);
    } catch (e) { console.error("Error saving public activity:", e); }
};

export const subscribeToPublicActivity = (callback: (activities: any[]) => void) => {
    // Switch to RTDB for true realtime performance
    const q = rtdbQuery(ref(rtdb, "public_activity"), rtdbLimitToLast(50));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.values(data);
            // Sort by timestamp desc
            items.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

// 7. Universal Analysis Logs
export const saveUniversalAnalysis = async (log: any) => {
    try {
        const sanitized = sanitizeForFirestore(log);
        await set(ref(rtdb, `universal_analysis_logs/${log.id}`), sanitized);
        await setDoc(doc(db, "universal_analysis_logs", log.id), sanitized);
    } catch (e) { console.error("Error saving analysis log:", e); }
};

export const subscribeToUniversalAnalysis = (callback: (logs: any[]) => void) => {
    const q = rtdbQuery(ref(rtdb, "universal_analysis_logs"), rtdbLimitToLast(100));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.values(data);
            items.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

// 8b. Compare Analytics — tracks which topics students compare most
export const saveCompareAnalytic = async (query: string, hitCount: number) => {
    if (!query?.trim()) return;
    try {
        const docId = `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const entry = {
            id: docId,
            query: query.trim().toLowerCase(),
            displayQuery: query.trim(),
            hitCount,
            timestamp: new Date().toISOString(),
            ts: Date.now(),
        };
        await set(ref(rtdb, `compare_analytics/${docId}`), entry);
    } catch (e) { console.error("Error saving compare analytic:", e); }
};

export const subscribeToCompareAnalytics = (callback: (entries: any[]) => void) => {
    const q = rtdbQuery(ref(rtdb, "compare_analytics"), rtdbLimitToLast(200));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            callback(Object.values(data));
        } else {
            callback([]);
        }
    });
};

export const deleteCompareAnalyticsByQuery = async (queryKey: string) => {
    try {
        const snapshot = await get(ref(rtdb, 'compare_analytics'));
        if (!snapshot.exists()) return;
        const data = snapshot.val() as Record<string, any>;
        const deleteOps = Object.entries(data)
            .filter(([, entry]) => (entry.query || '').trim().toLowerCase() === queryKey)
            .map(([key]) => remove(ref(rtdb, `compare_analytics/${key}`)));
        await Promise.all(deleteOps);
    } catch (e) { console.error('Error deleting compare analytics:', e); }
};

// 8. AI Interactions Log (New)
export const saveAiInteraction = async (data: any) => {
    try {
        const sanitized = sanitizeForFirestore(data);
        const path = `ai_interactions/${data.userId}/${data.id}`;
        // RTDB for realtime user history
        await set(ref(rtdb, path), sanitized);
        // Firestore for Admin Global View
        await setDoc(doc(db, "ai_interactions", data.id), sanitized);
    } catch (e) { console.error("Error saving AI interaction:", e); }
};

export const subscribeToAiHistory = (userId: string, callback: (data: any[]) => void) => {
    const q = rtdbQuery(ref(rtdb, `ai_interactions/${userId}`), rtdbLimitToLast(100));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.values(data);
            items.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

export const subscribeToAllAiInteractions = (callback: (data: any[]) => void) => {
    // For Admin: Listen to Firestore
    const q = query(collection(db, "ai_interactions"), orderBy("timestamp", "desc"), limitToLast(50));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => doc.data());
        callback(items);
    });
};

// 9. Secure Key Management
export const saveSecureKeys = async (keys: string[]) => {
    try {
        const sanitized = sanitizeForFirestore({ keys });
        // Firestore only (Secure)
        await setDoc(doc(db, "admin_secure", "apiKeys"), sanitized);
    } catch (e) { console.error("Error saving secure keys:", e); }
};

export const getSecureKeys = async () => {
    try {
        const docSnap = await getDoc(doc(db, "admin_secure", "apiKeys"));
        if (docSnap.exists()) {
            return docSnap.data().keys || [];
        }
        return [];
    } catch (e) {
        console.error("Error fetching secure keys:", e);
        return [];
    }
};

export const incrementApiUsage = async (keyIndex: number, type: 'PILOT' | 'STUDENT') => {
    try {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const docRef = doc(db, "admin_stats", `api_usage_${date}`);
        
        const updates: any = {
            [`key_${keyIndex}`]: increment(1),
            total: increment(1)
        };
        
        if (type === 'PILOT') {
            updates.pilotCount = increment(1);
        } else {
            updates.studentCount = increment(1);
        }
        
        await setDoc(docRef, updates, { merge: true });
    } catch (e) {
        console.error("Error tracking API usage:", e);
    }
};

export const subscribeToApiUsage = (callback: (data: any) => void) => {
    const date = new Date().toISOString().split('T')[0];
    return onSnapshot(doc(db, "admin_stats", `api_usage_${date}`), (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data());
        } else {
            callback(null);
        }
    });
};

// 10. Demand Requests
export const saveDemand = async (userId: string, details: string) => {
    try {
        const id = `dem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const request = {
            id,
            userId,
            details,
            timestamp: new Date().toISOString(),
            status: 'PENDING'
        };
        const sanitized = sanitizeForFirestore(request);
        await set(ref(rtdb, `demand_requests/${id}`), sanitized);
    } catch (e) { console.error("Error saving demand:", e); }
};

export const saveDemandRequest = async (request: any) => {
    try {
        const sanitized = sanitizeForFirestore(request);
        await set(ref(rtdb, `demand_requests/${request.id}`), sanitized);
        await setDoc(doc(db, "demand_requests", request.id), sanitized);
    } catch (e) { console.error("Error saving demand:", e); }
};

export const updateDemandStatus = async (demandId: string, status: string) => {
    try {
        await update(ref(rtdb, `demand_requests/${demandId}`), { status });
        await setDoc(doc(db, "demand_requests", demandId), { status }, { merge: true });
    } catch (e) { console.error("Error updating demand status:", e); }
};

// Check how many demands a user has submitted today
export const getUserTodayDemandCount = async (userId: string): Promise<number> => {
    try {
        const snapshot = await get(ref(rtdb, "demand_requests"));
        if (!snapshot.exists()) return 0;
        const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        let count = 0;
        snapshot.forEach((child) => {
            const d = child.val();
            if (d.userId === userId && d.timestamp && d.timestamp.startsWith(todayStr)) {
                count++;
            }
        });
        return count;
    } catch (e) { console.error("Error counting demands:", e); return 0; }
};

// Find an existing PENDING demand with same subject+chapter (case-insensitive)
export const findDuplicateDemand = async (subjectName: string, chapterName: string): Promise<any | null> => {
    try {
        const snapshot = await get(ref(rtdb, "demand_requests"));
        if (!snapshot.exists()) return null;
        const subjectLower = subjectName.trim().toLowerCase();
        const chapterLower = chapterName.trim().toLowerCase();
        let match: any = null;
        snapshot.forEach((child) => {
            const d = child.val();
            if (
                (!d.status || d.status === 'PENDING') &&
                d.subjectName?.trim().toLowerCase() === subjectLower &&
                d.chapterName?.trim().toLowerCase() === chapterLower
            ) {
                match = d;
            }
        });
        return match;
    } catch (e) { console.error("Error finding duplicate demand:", e); return null; }
};

// Increment the report count on an existing duplicate demand
export const incrementDemandReportCount = async (demandId: string): Promise<void> => {
    try {
        await update(ref(rtdb, `demand_requests/${demandId}`), {
            reportCount: increment(1),
            lastReportedAt: new Date().toISOString(),
        });
        await setDoc(doc(db, "demand_requests", demandId), {
            reportCount: increment(1),
            lastReportedAt: new Date().toISOString(),
        }, { merge: true });
    } catch (e) { console.error("Error incrementing demand count:", e); }
};

export const subscribeToDemands = (callback: (requests: any[]) => void) => {
    const q = rtdbQuery(ref(rtdb, "demand_requests"), rtdbLimitToLast(200));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.values(data);
            items.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

// 11. Support Chat (per-user private)
export const sendSupportMessage = async (msg: any) => {
    try {
        const sanitized = sanitizeForFirestore(msg);
        await set(ref(rtdb, `chat/dm/${msg.userId}/${msg.id}`), sanitized);
    } catch (e) { console.error("Error sending support message:", e); }
};

export const subscribeSupportChat = (userId: string, callback: (msgs: any[]) => void) => {
    const q = rtdbQuery(ref(rtdb, `chat/dm/${userId}`), rtdbLimitToLast(100));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.entries(data).map(([k, v]: any) => ({ id: k, ...v }));
            items.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

// 12. Global Chat
export const sendGlobalMessage = async (msg: any) => {
    try {
        const sanitized = sanitizeForFirestore(msg);
        await set(ref(rtdb, `chat/universal/${msg.id}`), sanitized);
    } catch (e) { console.error("Error sending global message:", e); }
};

export const subscribeGlobalChat = (callback: (msgs: any[]) => void) => {
    const q = rtdbQuery(ref(rtdb, "chat/universal"), rtdbLimitToLast(100));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.entries(data).map(([k, v]: any) => ({ id: k, ...v }));
            items.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

export const deleteGlobalMessage = async (msgId: string) => {
    try {
        await remove(ref(rtdb, `chat/universal/${msgId}`));
    } catch (e) { console.error("Error deleting global message:", e); }
};

export const deleteSupportMessage = async (userId: string, msgId: string) => {
    try {
        await remove(ref(rtdb, `chat/dm/${userId}/${msgId}`));
    } catch (e) { console.error("Error deleting support message:", e); }
};

// Admin: get all support threads (list of user IDs who have DMs)
export const subscribeAllSupportThreads = (callback: (threads: any[]) => void) => {
    return onValue(ref(rtdb, "chat/dm"), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const threads = Object.entries(data).map(([userId, msgs]: any) => {
                const msgList = Object.values(msgs || {}) as any[];
                msgList.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                const last = msgList[0];
                return { userId, lastMessage: last, unreadCount: msgList.filter((m: any) => !m.readByAdmin).length };
            });
            threads.sort((a, b) => new Date((b.lastMessage?.timestamp) || 0).getTime() - new Date((a.lastMessage?.timestamp) || 0).getTime());
            callback(threads);
        } else {
            callback([]);
        }
    });
};

// ── THEME & ANIMATION BUILDER ────────────────────────────────────────────────

export const saveUserTheme = async (userId: string, theme: any) => {
    try {
        await setDoc(doc(db, 'user_themes', userId), sanitizeForFirestore({ ...theme, userId, updatedAt: new Date().toISOString() }), { merge: true });
    } catch (e) { console.error('saveUserTheme error:', e); }
};

export const saveUserAnimation = async (userId: string, anim: any) => {
    try {
        await setDoc(doc(db, 'user_animations', userId), sanitizeForFirestore({ ...anim, userId, updatedAt: new Date().toISOString() }), { merge: true });
    } catch (e) { console.error('saveUserAnimation error:', e); }
};

export const publishTheme = async (theme: any) => {
    try {
        await setDoc(doc(db, 'published_themes', theme.id), sanitizeForFirestore({ ...theme, publishedAt: new Date().toISOString() }), { merge: true });
    } catch (e) { console.error('publishTheme error:', e); }
};

export const publishAnimation = async (anim: any) => {
    try {
        await setDoc(doc(db, 'published_animations', anim.id), sanitizeForFirestore({ ...anim, publishedAt: new Date().toISOString() }), { merge: true });
    } catch (e) { console.error('publishAnimation error:', e); }
};

export const subscribePublishedThemes = (callback: (items: any[]) => void) => {
    return onSnapshot(collection(db, 'published_themes'), (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
        callback(items);
    });
};

export const subscribePublishedAnimations = (callback: (items: any[]) => void) => {
    return onSnapshot(collection(db, 'published_animations'), (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
        callback(items);
    });
};

export const likePublishedTheme = async (themeId: string, userId: string) => {
    try {
        const ref2 = doc(db, 'published_themes', themeId);
        const snap = await getDoc(ref2);
        if (!snap.exists()) return;
        const data = snap.data();
        const likedBy: string[] = data.likedBy || [];
        if (likedBy.includes(userId)) return;
        await updateDoc(ref2, { likes: (data.likes || 0) + 1, likedBy: [...likedBy, userId] });
    } catch (e) { console.error('likePublishedTheme error:', e); }
};

export const likePublishedAnimation = async (animId: string, userId: string) => {
    try {
        const ref2 = doc(db, 'published_animations', animId);
        const snap = await getDoc(ref2);
        if (!snap.exists()) return;
        const data = snap.data();
        const likedBy: string[] = data.likedBy || [];
        if (likedBy.includes(userId)) return;
        await updateDoc(ref2, { likes: (data.likes || 0) + 1, likedBy: [...likedBy, userId] });
    } catch (e) { console.error('likePublishedAnimation error:', e); }
};

// ─────────────────────────────────────────────────────────────────
// COMPRE BOOK NOTES  (separate Firestore docs per book, auto-chunks
// when a document approaches the 1 MB Firestore limit)
// ─────────────────────────────────────────────────────────────────
const COMPRE_NOTES_MAX_BYTES = 900 * 1024; // 900 KB safety margin

export interface CompreNote {
  id: string;
  pageNumber: string;
  notes: string;
  chunkNotes?: string;
  htmlNotes?: string;
  topicName?: string;
  groupId?: string;
  subject?: string;
  mcqs?: { question: string; options: string[]; answer: number }[];
  videoUrl?: string;
  audioUrl?: string;
  createdAt: string;
}

interface CompreBookNotesDoc {
  bookId: string;
  bookName: string;
  notes: CompreNote[];
  chunkCount: number;
  updatedAt: string;
}

function makeBookDocId(bookId: string, chunk: number): string {
  return chunk <= 1 ? bookId : `${bookId}_${chunk}`;
}

export const getCompreBookNotes = async (bookId: string): Promise<CompreNote[]> => {
  try {
    const baseSnap = await getDoc(doc(db, 'compre_notes', bookId));
    if (baseSnap.exists()) {
      const base = baseSnap.data() as CompreBookNotesDoc;
      const all: CompreNote[] = [...(base.notes || [])];
      const chunks = base.chunkCount || 1;
      for (let i = 2; i <= chunks; i++) {
        const chSnap = await getDoc(doc(db, 'compre_notes', makeBookDocId(bookId, i)));
        if (chSnap.exists()) all.push(...((chSnap.data() as CompreBookNotesDoc).notes || []));
      }
      return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
  } catch (e) { console.warn('[getCompreBookNotes] Firestore failed, trying RTDB:', e); }
  try {
    const snap = await get(ref(rtdb, `compre_notes/${bookId}`));
    if (snap.exists()) {
      const data = snap.val();
      return ((data.notes || []) as CompreNote[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
  } catch (e) { console.error('[getCompreBookNotes] RTDB also failed:', e); }
  return [];
};

export const addCompreBookNote = async (bookId: string, bookName: string, note: CompreNote): Promise<void> => {
  const now = new Date().toISOString();
  let firestoreOk = false;
  try {
    const baseRef = doc(db, 'compre_notes', bookId);
    const baseSnap = await getDoc(baseRef);
    let base: CompreBookNotesDoc = baseSnap.exists()
      ? (baseSnap.data() as CompreBookNotesDoc)
      : { bookId, bookName, notes: [], chunkCount: 1, updatedAt: '' };

    const chunks = base.chunkCount || 1;
    const lastChunkId = makeBookDocId(bookId, chunks);
    const lastRef = chunks === 1 ? baseRef : doc(db, 'compre_notes', lastChunkId);
    const lastSnap = chunks === 1 ? baseSnap : await getDoc(lastRef);
    const lastData: CompreBookNotesDoc = (lastSnap.exists() ? lastSnap.data() : { bookId, bookName, notes: [], chunkCount: chunks, updatedAt: '' }) as CompreBookNotesDoc;

    const testNotes = [...(lastData.notes || []), note];
    const estimatedSize = new Blob([JSON.stringify({ ...lastData, notes: testNotes })]).size;

    if (estimatedSize > COMPRE_NOTES_MAX_BYTES) {
      const newChunk = chunks + 1;
      const newRef = doc(db, 'compre_notes', makeBookDocId(bookId, newChunk));
      await setDoc(newRef, sanitizeForFirestore({ bookId, bookName, notes: [note], chunkCount: newChunk, updatedAt: now }));
      await setDoc(baseRef, sanitizeForFirestore({ ...base, chunkCount: newChunk, updatedAt: now }));
    } else {
      await setDoc(lastRef, sanitizeForFirestore({ ...lastData, notes: testNotes, updatedAt: now }));
      if (chunks > 1) await setDoc(baseRef, sanitizeForFirestore({ ...base, updatedAt: now }), { merge: true });
    }
    firestoreOk = true;
  } catch (e: any) {
    console.warn('[addCompreBookNote] Firestore failed, trying RTDB fallback:', e?.message || e?.code || e);
  }
  try {
    const snap = await get(ref(rtdb, `compre_notes/${bookId}`));
    const existing = snap.exists() ? (snap.val() as { bookId: string; bookName: string; notes: CompreNote[]; updatedAt: string }) : { bookId, bookName, notes: [], updatedAt: '' };
    const updatedNotes = [...(existing.notes || []).filter((n: CompreNote) => n.id !== note.id), note];
    await set(ref(rtdb, `compre_notes/${bookId}`), { bookId, bookName, notes: updatedNotes, updatedAt: now });
  } catch (rtdbErr: any) {
    console.error('[addCompreBookNote] RTDB also failed:', rtdbErr?.message || rtdbErr?.code);
    if (!firestoreOk) throw new Error(rtdbErr?.message || rtdbErr?.code || 'Save failed on all backends');
  }
};

export const deleteCompreBookNote = async (bookId: string, noteId: string): Promise<void> => {
  const now = new Date().toISOString();
  let firestoreOk = false;
  try {
    const baseRef = doc(db, 'compre_notes', bookId);
    const baseSnap = await getDoc(baseRef);
    if (baseSnap.exists()) {
      const base = baseSnap.data() as CompreBookNotesDoc;
      const chunks = base.chunkCount || 1;
      const baseNotes = base.notes || [];
      if (baseNotes.some((n: CompreNote) => n.id === noteId)) {
        await setDoc(baseRef, sanitizeForFirestore({ ...base, notes: baseNotes.filter((n: CompreNote) => n.id !== noteId), updatedAt: now }));
        firestoreOk = true;
      } else {
        for (let i = 2; i <= chunks; i++) {
          const cRef = doc(db, 'compre_notes', makeBookDocId(bookId, i));
          const cSnap = await getDoc(cRef);
          if (cSnap.exists()) {
            const cData = cSnap.data() as CompreBookNotesDoc;
            if ((cData.notes || []).some((n: CompreNote) => n.id === noteId)) {
              await setDoc(cRef, sanitizeForFirestore({ ...cData, notes: (cData.notes || []).filter((n: CompreNote) => n.id !== noteId), updatedAt: now }));
              firestoreOk = true;
              break;
            }
          }
        }
      }
    }
  } catch (e) { console.warn('[deleteCompreBookNote] Firestore failed, trying RTDB:', e); }
  try {
    const snap = await get(ref(rtdb, `compre_notes/${bookId}`));
    if (snap.exists()) {
      const data = snap.val();
      const updatedNotes = (data.notes || []).filter((n: CompreNote) => n.id !== noteId);
      await set(ref(rtdb, `compre_notes/${bookId}`), { ...data, notes: updatedNotes, updatedAt: now });
    }
  } catch (rtdbErr) {
    console.error('[deleteCompreBookNote] RTDB also failed:', rtdbErr);
    if (!firestoreOk) throw rtdbErr;
  }
};

export const updateCompreBookNote = async (bookId: string, noteId: string, updatedNote: CompreNote): Promise<void> => {
  const now = new Date().toISOString();
  let firestoreOk = false;
  try {
    const baseRef = doc(db, 'compre_notes', bookId);
    const baseSnap = await getDoc(baseRef);
    if (baseSnap.exists()) {
      const base = baseSnap.data() as CompreBookNotesDoc;
      const chunks = base.chunkCount || 1;
      const baseNotes = base.notes || [];
      if (baseNotes.some((n: CompreNote) => n.id === noteId)) {
        await setDoc(baseRef, sanitizeForFirestore({ ...base, notes: baseNotes.map((n: CompreNote) => n.id === noteId ? updatedNote : n), updatedAt: now }));
        firestoreOk = true;
      } else {
        for (let i = 2; i <= chunks; i++) {
          const cRef = doc(db, 'compre_notes', makeBookDocId(bookId, i));
          const cSnap = await getDoc(cRef);
          if (cSnap.exists()) {
            const cData = cSnap.data() as CompreBookNotesDoc;
            if ((cData.notes || []).some((n: CompreNote) => n.id === noteId)) {
              await setDoc(cRef, sanitizeForFirestore({ ...cData, notes: (cData.notes || []).map((n: CompreNote) => n.id === noteId ? updatedNote : n), updatedAt: now }));
              firestoreOk = true;
              break;
            }
          }
        }
      }
    }
  } catch (e) { console.warn('[updateCompreBookNote] Firestore failed, trying RTDB:', e); }
  try {
    const snap = await get(ref(rtdb, `compre_notes/${bookId}`));
    if (snap.exists()) {
      const data = snap.val();
      const updatedNotes = (data.notes || []).map((n: CompreNote) => n.id === noteId ? updatedNote : n);
      await set(ref(rtdb, `compre_notes/${bookId}`), { ...data, notes: updatedNotes, updatedAt: now });
    } else if (!firestoreOk) {
      throw new Error('Note not found in any backend');
    }
  } catch (rtdbErr: any) {
    console.error('[updateCompreBookNote] RTDB also failed:', rtdbErr);
    if (!firestoreOk) throw new Error(rtdbErr?.message || 'Update failed on all backends');
  }
};

// ── APP FEEDBACK ──────────────────────────────────────────────────────────
import type { AppFeedbackEntry } from './types';

export const saveAppFeedback = async (entry: AppFeedbackEntry): Promise<void> => {
  try {
    await setDoc(doc(db, 'app_feedback', entry.id), entry);
  } catch (e) {
    console.error('[saveAppFeedback] Firestore failed:', e);
    throw e;
  }
};

export const getAppFeedbacks = async (): Promise<AppFeedbackEntry[]> => {
  try {
    const q = query(collection(db, 'app_feedback'), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AppFeedbackEntry);
  } catch (e) {
    console.error('[getAppFeedbacks] failed:', e);
    return [];
  }
};

export { app, db, rtdb, auth };

export const updateUserUID = async (oldUid: string, newUid: string, userData: any) => {
    try {
        // 1. Copy core to new UID in Firestore
        await setDoc(doc(db, "users", newUid), { ...userData, id: newUid }, { merge: true });

        // 2. Fetch bulky data from old UID
        const bulkySnap = await getDoc(doc(db, "user_data", oldUid)).catch(() => null);
        if (bulkySnap && bulkySnap.exists()) {
            // Copy to new UID
            await setDoc(doc(db, "user_data", newUid), bulkySnap.data(), { merge: true });
            // Delete old bulky data
            await deleteDoc(doc(db, "user_data", oldUid)).catch(() => {});
        }

        // 3. Delete old core
        await deleteDoc(doc(db, "users", oldUid)).catch(() => {});
        await set(ref(rtdb, `users/${oldUid}`), null).catch(() => {});

        // 4. Save to RTDB
        await set(ref(rtdb, `users/${newUid}`), { ...userData, id: newUid }).catch(() => {});

        return true;
    } catch (e) {
        console.error("Error migrating UID:", e);
        return false;
    }
};

// ── Admin Important Highlights — shared, visible to ALL users ────────────────
// Admin stars a topic → saved in Realtime Database (RTDB) → all users see
// an orange background on those points in ChunkedNotesReader in real-time.
// RTDB path: admin_highlights/{noteKey}/topics  (string[])
// Using RTDB instead of Firestore so regular users can read without
// needing special Firestore security-rule grants.

export const saveAdminMark2Topics = async (noteKey: string, topics: string[]): Promise<void> => {
    if (!noteKey) return;
    try {
        const safeKey = noteKey.replace(/[.#$[\]]/g, '_');
        await set(ref(rtdb, `admin_highlights/${safeKey}`), { topics, updatedAt: new Date().toISOString() });
    } catch (e) {
        console.error('[AdminHighlight] Error saving:', e);
    }
};

export const subscribeAdminMark2Topics = (
    noteKey: string,
    callback: (topics: string[]) => void
): (() => void) => {
    if (!noteKey) { callback([]); return () => {}; }
    const safeKey = noteKey.replace(/[.#$[\]]/g, '_');
    const unsubFn = onValue(
        ref(rtdb, `admin_highlights/${safeKey}`),
        (snap) => {
            if (snap.exists()) {
                callback((snap.val()?.topics as string[]) || []);
            } else {
                callback([]);
            }
        },
        () => callback([])
    );
    return unsubFn;
};

// ── Admin control: lock/unlock user Important Mark button ────────────────────
// When userMarkLocked = true, regular users cannot star/mark notes.
// Stored globally in Firestore so all users are affected in real-time.
// Collection: admin_settings / Document: important_mark / Field: userMarkLocked

// ── 12. Global Suggestions & Corrections ──────────────────────────────────

export const saveSuggestion = async (s: { id: string; text: string; uid: string; userName: string; userBoard?: string; createdAt: string; lessonTitle?: string; pageNo?: string; mode?: 'reading' | 'writing' | 'mcq'; subject?: string; classLevel?: string; chapterKey?: string; pointsData?: { index: number; originalText: string }[]; mcqId?: string; mcqQuestion?: string; mcqOptions?: string[]; mcqCurrentAnswer?: number; }): Promise<void> => {
    try {
        const payload: Record<string, unknown> = { ...s, likes: 0, dislikes: 0, likedBy: {}, dislikedBy: {}, status: 'open', adminReply: '', adminReplyAt: '' };
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
        await set(ref(rtdb, `suggestions/${s.id}`), payload);
    } catch (e) {
        console.error('[Suggestions] saveSuggestion error:', e);
        throw e;
    }
};

// Apply admin-approved corrections directly to the note content in chapter data.
// corrections: array of { originalText, correctedText } — each original line in the
// notes string is found and replaced with correctedText.
// Returns the total number of lines that were actually replaced.
export const applyNoteCorrection = async (
    chapterKey: string,
    corrections: { originalText: string; correctedText: string }[]
): Promise<number> => {
    // Guard: reject empty/invalid key
    if (!chapterKey || typeof chapterKey !== 'string' || chapterKey.trim() === '') {
        throw new Error('[applyNoteCorrection] chapterKey is empty or invalid');
    }
    // Guard: reject empty corrections list
    const validCorrections = corrections.filter(c => c.originalText.trim() && c.correctedText.trim());
    if (validCorrections.length === 0) {
        throw new Error('[applyNoteCorrection] No valid corrections provided');
    }

    // Normalize a raw note line for comparison:
    // strips leading bullets (-, •, *, ·), numbered markers (1. / 1) / (1)), and whitespace.
    // Mirrors the cleaning splitIntoTopics does before displaying topic text:
    //   1. Strip markdown bold markers (**...**)
    //   2. Strip one leading bullet / numbered prefix
    //   3. Collapse whitespace
    const normalizeLine = (s: string): string =>
        s.replace(/\*\*([^*]+)\*\*/g, '$1')                       // strip **bold**
         .replace(/^\s*(\d+[.)]\s*|\(\d+\)\s*|[-•*·]\s*)/, '')   // strip leading bullet/number
         .trim()
         .replace(/\s+/g, ' ');

    let totalReplaced = 0;

    // Helper: replace matching lines in a multi-line notes string; returns [newString, replacedCount]
    const applyToString = (raw: string): [string, number] => {
        let replaced = 0;

        // ── Pass 1: line-by-line exact match (preserves leading prefix) ──────
        const lines = raw.split('\n');
        const updatedLines = lines.map(line => {
            for (const { originalText, correctedText } of validCorrections) {
                const orig = normalizeLine(originalText);
                const lineNorm = normalizeLine(line);
                if (lineNorm === orig && orig.length > 0) {
                    // Preserve any leading prefix (bullets, numbers, whitespace)
                    const prefix = line.match(/^(\s*(?:\*\*)?(?:\d+[.)]\s*|\(\d+\)\s*|[-•*·]\s*)(?:\*\*)?)/)?.[1] ?? '';
                    replaced++;
                    return prefix + correctedText.trim();
                }
            }
            return line;
        });

        if (replaced > 0) return [updatedLines.join('\n'), replaced];

        // ── Pass 2: fuzzy substring search (handles multi-line joins, bold etc.) ──
        // Normalize the full raw string to a flat single-space version for searching,
        // then locate and replace each correction as a substring.
        let result = raw;
        for (const { originalText, correctedText } of validCorrections) {
            const origNorm = normalizeLine(originalText);
            if (!origNorm) continue;
            // Build a regex that matches the normalized text with flexible whitespace
            // between words (handles stored newlines between words).
            const escaped = origNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flexPattern = new RegExp(escaped.replace(/\s+/g, '[\\s\\S]{0,10}'), 'u');
            const match = flexPattern.exec(result.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\s+/g, ' '));
            if (match) {
                // Find the actual span in the original (un-normalized) result
                // by doing a simpler indexOf on a word-collapsed version.
                const flatResult = result.replace(/\s+/g, ' ');
                const flatOrig = origNorm;
                const idx = flatResult.indexOf(flatOrig);
                if (idx !== -1) {
                    result = flatResult.slice(0, idx) + correctedText.trim() + flatResult.slice(idx + flatOrig.length);
                    replaced++;
                }
            }
        }
        return [result, replaced];
    };

    // ── Lucent entry path: key = "lucent_{entryId}_p{pageIndex}"
    //    e.g. "lucent_1781671903663_p0"  →  entryId="1781671903663", pageIndex=0
    //    e.g. "lucent_lucent-1781671903663_p2" → entryId="lucent-1781671903663", pageIndex=2
    //    The suffix is always "_p" followed by digits at the END.
    const lucentMatch = chapterKey.match(/^lucent_(.+)_p(\d+)$/);
    if (lucentMatch) {
        const entryId = lucentMatch[1];         // raw entry.id as stored in Firebase
        const pageIndex = parseInt(lucentMatch[2], 10);  // index into entry.pages[]

        // Fetch entry from RTDB first, fall back to Firestore
        let entryData: any = null;
        try {
            const snap = await get(ref(rtdb, `lucent_entries/${entryId}`));
            if (snap.exists()) entryData = snap.val();
        } catch (e) {
            console.warn('[applyNoteCorrection] RTDB fetch failed for lucent entry:', e);
        }
        if (!entryData) {
            try {
                const snap = await getDoc(doc(db, 'lucent_entries', entryId));
                if (snap.exists()) entryData = snap.data();
            } catch (e) {
                console.warn('[applyNoteCorrection] Firestore fetch failed for lucent entry:', e);
            }
        }
        if (!entryData) throw new Error(`[applyNoteCorrection] Lucent entry not found: ${entryId}`);

        const pages: any[] = Array.isArray(entryData.pages) ? entryData.pages : [];
        if (pageIndex < 0 || pageIndex >= pages.length) {
            throw new Error(`[applyNoteCorrection] Page index ${pageIndex} out of range (entry has ${pages.length} pages)`);
        }

        // Apply corrections to all text fields of the target page
        const page = { ...pages[pageIndex] };
        for (const field of ['content', 'chunkNotes', 'htmlNotes'] as const) {
            if (typeof page[field] === 'string') {
                const [newVal, cnt] = applyToString(page[field]);
                page[field] = newVal;
                totalReplaced += cnt;
            }
        }

        if (totalReplaced === 0) return 0;

        const updatedPages = [...pages];
        updatedPages[pageIndex] = page;
        const updatedEntry = { ...entryData, pages: updatedPages };

        await Promise.allSettled([
            set(ref(rtdb, `lucent_entries/${entryId}`), updatedEntry),
            setDoc(doc(db, 'lucent_entries', entryId), updatedEntry),
        ]);
        return totalReplaced;
    }

    // ── Homework/Competition entry path: key = "hw_{entryId}" ─────────────────
    //    e.g. "hw_abc123" → fetch from homework_entries/abc123
    if (chapterKey.startsWith('hw_')) {
        const entryId = chapterKey.slice(3); // strip "hw_"
        if (!entryId) throw new Error('[applyNoteCorrection] hw_ key has no entryId');

        let entryData: any = null;
        try {
            const snap = await get(ref(rtdb, `homework_entries/${entryId}`));
            if (snap.exists()) entryData = snap.val();
        } catch (e) {
            console.warn('[applyNoteCorrection] RTDB fetch failed for hw entry:', e);
        }
        if (!entryData) {
            try {
                const snap = await getDoc(doc(db, 'homework_entries', entryId));
                if (snap.exists()) entryData = snap.data();
            } catch (e) {
                console.warn('[applyNoteCorrection] Firestore fetch failed for hw entry:', e);
            }
        }
        if (!entryData) throw new Error(`[applyNoteCorrection] Homework entry not found: ${entryId}`);

        const updated = { ...entryData };
        for (const field of ['notes', 'chunkNotes', 'htmlNotes'] as const) {
            if (typeof updated[field] === 'string') {
                const [newVal, cnt] = applyToString(updated[field]);
                updated[field] = newVal;
                totalReplaced += cnt;
            }
        }

        if (totalReplaced === 0) return 0;

        await Promise.allSettled([
            set(ref(rtdb, `homework_entries/${entryId}`), updated),
            setDoc(doc(db, 'homework_entries', entryId), updated),
        ]);
        return totalReplaced;
    }

    // ── Standard chapter key path ──────────────────────────────────────────────
    const data = await getChapterData(chapterKey);
    if (!data) throw new Error(`[applyNoteCorrection] Chapter data not found for key: ${chapterKey}`);

    const updated = { ...data };
    const noteFields = ['freeNotes', 'premiumNotes', 'chunkNotes', 'teachingStrategyNotes', 'content'] as const;
    for (const field of noteFields) {
        if (typeof (updated as any)[field] === 'string') {
            const [newVal, cnt] = applyToString((updated as any)[field]);
            (updated as any)[field] = newVal;
            totalReplaced += cnt;
        }
    }
    // Also handle topicNotes array (array of { notes: string, ... })
    if (Array.isArray(updated.topicNotes)) {
        updated.topicNotes = updated.topicNotes.map((tn: any) => {
            if (tn && typeof tn.notes === 'string') {
                const [newNotes, cnt] = applyToString(tn.notes);
                totalReplaced += cnt;
                return { ...tn, notes: newNotes };
            }
            return tn;
        });
    }

    if (totalReplaced === 0) {
        // Don't save if nothing changed — avoid a no-op write
        return 0;
    }
    await saveChapterData(chapterKey, updated);
    return totalReplaced;
};

// Apply admin-approved MCQ answer correction directly to Lucent or Homework entry in Firebase.
// chapterKey: "lucent_ENTRYID_pPAGEINDEX" or "hw_ENTRYID"
// mcqId: the MCQ's id field (used to find the exact MCQ in the page/entry)
// newCorrectAnswer: 0-based index of the correct option
export const applyMcqCorrection = async (
    chapterKey: string,
    mcqId: string,
    newCorrectAnswer: number,
    mcqQuestion?: string,
): Promise<boolean> => {
    if (!chapterKey || typeof chapterKey !== 'string' || chapterKey.trim() === '') {
        throw new Error('[applyMcqCorrection] chapterKey is empty or invalid');
    }
    if (newCorrectAnswer < 0) {
        throw new Error('[applyMcqCorrection] newCorrectAnswer must be >= 0');
    }

    // ── Lucent entry ──────────────────────────────────────────────────────────
    const lucentMatch = chapterKey.match(/^lucent_(.+)_p(\d+)$/);
    if (lucentMatch) {
        const entryId = lucentMatch[1];
        const pageIndex = parseInt(lucentMatch[2], 10);

        let entryData: any = null;
        try {
            const snap = await get(ref(rtdb, `lucent_entries/${entryId}`));
            if (snap.exists()) entryData = snap.val();
        } catch (e) {
            console.warn('[applyMcqCorrection] RTDB fetch failed for lucent entry:', e);
        }
        if (!entryData) {
            try {
                const d = await getDoc(doc(db, 'lucent_entries', entryId));
                if (d.exists()) entryData = d.data();
            } catch (e) {
                console.warn('[applyMcqCorrection] Firestore fetch failed for lucent entry:', e);
            }
        }
        if (!entryData) throw new Error(`[applyMcqCorrection] Lucent entry not found: ${entryId}`);

        const pages: any[] = Array.isArray(entryData.pages) ? [...entryData.pages] : [];
        if (pageIndex >= pages.length) throw new Error(`[applyMcqCorrection] Page index ${pageIndex} out of bounds`);

        const page = { ...pages[pageIndex] };
        const mcqs: any[] = Array.isArray(page.mcqs) ? [...page.mcqs] : [];
        let mcqIdx = mcqId ? mcqs.findIndex((m: any) => String(m.id) === String(mcqId)) : -1;
        if (mcqIdx === -1 && mcqQuestion) {
            mcqIdx = mcqs.findIndex((m: any) => (m.question || '').trim() === mcqQuestion.trim());
        }
        if (mcqIdx === -1) throw new Error(`[applyMcqCorrection] MCQ not found on page ${pageIndex}`);

        mcqs[mcqIdx] = { ...mcqs[mcqIdx], correctAnswer: newCorrectAnswer };
        pages[pageIndex] = { ...page, mcqs };
        const updated = { ...entryData, pages };

        await set(ref(rtdb, `lucent_entries/${entryId}`), updated);
        try { await setDoc(doc(db, 'lucent_entries', entryId), updated); } catch {}
        return true;
    }

    // ── Homework entry ────────────────────────────────────────────────────────
    const hwMatch = chapterKey.match(/^hw_(.+)$/);
    if (hwMatch) {
        const entryId = hwMatch[1];

        let entryData: any = null;
        try {
            const snap = await get(ref(rtdb, `homework_entries/${entryId}`));
            if (snap.exists()) entryData = snap.val();
        } catch (e) {
            console.warn('[applyMcqCorrection] RTDB fetch failed for hw entry:', e);
        }
        if (!entryData) {
            try {
                const d = await getDoc(doc(db, 'homework_entries', entryId));
                if (d.exists()) entryData = d.data();
            } catch (e) {
                console.warn('[applyMcqCorrection] Firestore fetch failed for hw entry:', e);
            }
        }
        if (!entryData) throw new Error(`[applyMcqCorrection] Homework entry not found: ${entryId}`);

        const mcqs: any[] = Array.isArray(entryData.parsedMcqs) ? [...entryData.parsedMcqs] : [];
        let mcqIdx = mcqId ? mcqs.findIndex((m: any) => String(m.id) === String(mcqId)) : -1;
        if (mcqIdx === -1 && mcqQuestion) {
            mcqIdx = mcqs.findIndex((m: any) => (m.question || '').trim() === mcqQuestion.trim());
        }
        if (mcqIdx === -1) throw new Error(`[applyMcqCorrection] MCQ not found in hw ${entryId}`);

        mcqs[mcqIdx] = { ...mcqs[mcqIdx], correctAnswer: newCorrectAnswer };
        const updated = { ...entryData, parsedMcqs: mcqs };

        await set(ref(rtdb, `homework_entries/${entryId}`), updated);
        try { await setDoc(doc(db, 'homework_entries', entryId), updated); } catch {}
        return true;
    }

    throw new Error(`[applyMcqCorrection] Unrecognized chapterKey format: ${chapterKey}`);
};

export const applyMcqFullEdit = async (
    chapterKey: string,
    mcqId: string,
    newCorrectAnswer: number,
    newQuestion: string,
    newOptions: string[],
    mcqQuestion?: string,
): Promise<boolean> => {
    if (!chapterKey || typeof chapterKey !== 'string' || chapterKey.trim() === '') {
        throw new Error('[applyMcqFullEdit] chapterKey is empty or invalid');
    }

    const lucentMatch = chapterKey.match(/^lucent_(.+)_p(\d+)$/);
    if (lucentMatch) {
        const entryId = lucentMatch[1];
        const pageIndex = parseInt(lucentMatch[2], 10);

        let entryData: any = null;
        try {
            const snap = await get(ref(rtdb, `lucent_entries/${entryId}`));
            if (snap.exists()) entryData = snap.val();
        } catch (e) {
            console.warn('[applyMcqFullEdit] RTDB fetch failed for lucent entry:', e);
        }
        if (!entryData) {
            try {
                const d = await getDoc(doc(db, 'lucent_entries', entryId));
                if (d.exists()) entryData = d.data();
            } catch (e) {
                console.warn('[applyMcqFullEdit] Firestore fetch failed for lucent entry:', e);
            }
        }
        if (!entryData) throw new Error(`[applyMcqFullEdit] Lucent entry not found: ${entryId}`);

        const pages: any[] = Array.isArray(entryData.pages) ? [...entryData.pages] : [];
        if (pageIndex >= pages.length) throw new Error(`[applyMcqFullEdit] Page index ${pageIndex} out of bounds`);

        const page = { ...pages[pageIndex] };
        const mcqs: any[] = Array.isArray(page.mcqs) ? [...page.mcqs] : [];
        let mcqIdx = mcqId ? mcqs.findIndex((m: any) => String(m.id) === String(mcqId)) : -1;
        if (mcqIdx === -1 && mcqQuestion) {
            mcqIdx = mcqs.findIndex((m: any) => (m.question || '').trim() === mcqQuestion.trim());
        }
        if (mcqIdx === -1) throw new Error(`[applyMcqFullEdit] MCQ not found on page ${pageIndex}`);

        const updates: any = { correctAnswer: newCorrectAnswer };
        if (newQuestion.trim()) updates.question = newQuestion.trim();
        if (newOptions.length > 0 && newOptions.some(o => o.trim())) updates.options = newOptions.map(o => o.trim());

        mcqs[mcqIdx] = { ...mcqs[mcqIdx], ...updates };
        pages[pageIndex] = { ...page, mcqs };
        const updated = { ...entryData, pages };

        await set(ref(rtdb, `lucent_entries/${entryId}`), updated);
        try { await setDoc(doc(db, 'lucent_entries', entryId), updated); } catch {}
        return true;
    }

    const hwMatch = chapterKey.match(/^hw_(.+)$/);
    if (hwMatch) {
        const entryId = hwMatch[1];

        let entryData: any = null;
        try {
            const snap = await get(ref(rtdb, `homework_entries/${entryId}`));
            if (snap.exists()) entryData = snap.val();
        } catch (e) {
            console.warn('[applyMcqFullEdit] RTDB fetch failed for hw entry:', e);
        }
        if (!entryData) {
            try {
                const d = await getDoc(doc(db, 'homework_entries', entryId));
                if (d.exists()) entryData = d.data();
            } catch (e) {
                console.warn('[applyMcqFullEdit] Firestore fetch failed for hw entry:', e);
            }
        }
        if (!entryData) throw new Error(`[applyMcqFullEdit] Homework entry not found: ${entryId}`);

        const mcqs: any[] = Array.isArray(entryData.parsedMcqs) ? [...entryData.parsedMcqs] : [];
        let mcqIdx = mcqId ? mcqs.findIndex((m: any) => String(m.id) === String(mcqId)) : -1;
        if (mcqIdx === -1 && mcqQuestion) {
            mcqIdx = mcqs.findIndex((m: any) => (m.question || '').trim() === mcqQuestion.trim());
        }
        if (mcqIdx === -1) throw new Error(`[applyMcqFullEdit] MCQ not found in hw ${entryId}`);

        const updates: any = { correctAnswer: newCorrectAnswer };
        if (newQuestion.trim()) updates.question = newQuestion.trim();
        if (newOptions.length > 0 && newOptions.some(o => o.trim())) updates.options = newOptions.map(o => o.trim());

        mcqs[mcqIdx] = { ...mcqs[mcqIdx], ...updates };
        const updated = { ...entryData, parsedMcqs: mcqs };

        await set(ref(rtdb, `homework_entries/${entryId}`), updated);
        try { await setDoc(doc(db, 'homework_entries', entryId), updated); } catch {}
        return true;
    }

    throw new Error(`[applyMcqFullEdit] Unrecognized chapterKey format: ${chapterKey}`);
};

export const subscribeSuggestions = (callback: (items: any[]) => void): (() => void) => {
    const q = rtdbQuery(ref(rtdb, 'suggestions'), rtdbLimitToLast(100));
    return onValue(q, (snap) => {
        if (!snap.exists()) { callback([]); return; }
        const items: any[] = Object.values(snap.val());
        items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(items);
    }, () => callback([]));
};

export const reactToSuggestion = async (suggestionId: string, uid: string, reaction: 'like' | 'dislike'): Promise<void> => {
    try {
        const r = ref(rtdb, `suggestions/${suggestionId}`);
        const snap = await get(r);
        if (!snap.exists()) return;
        const d = snap.val();
        const likedBy: Record<string, boolean> = { ...(d.likedBy || {}) };
        const dislikedBy: Record<string, boolean> = { ...(d.dislikedBy || {}) };
        if (reaction === 'like') {
            if (likedBy[uid]) { delete likedBy[uid]; } else { likedBy[uid] = true; delete dislikedBy[uid]; }
        } else {
            if (dislikedBy[uid]) { delete dislikedBy[uid]; } else { dislikedBy[uid] = true; delete likedBy[uid]; }
        }
        await update(r, { likedBy, dislikedBy, likes: Object.keys(likedBy).length, dislikes: Object.keys(dislikedBy).length });
    } catch (e) { console.error('[Suggestions] reactToSuggestion error:', e); }
};

/** Atomically claim a reward slot for a suggestion using RTDB transaction.
 *  Returns the suggestion data if the claim succeeded (not already claimed),
 *  null if already claimed or not applicable. */
const claimSuggestionReward = async (
    suggestionId: string,
    rewardKey: 'reply' | 'resolve'
): Promise<{ uid: string; userName: string } | null> => {
    const r = ref(rtdb, `suggestions/${suggestionId}/rewardedFor/${rewardKey}`);
    let claimed = false;
    let ownerUid = '';
    let ownerName = '';
    await runTransaction(r, (current) => {
        if (current === true || current === false && current) return; // already claimed
        if (current) return; // already set
        claimed = true;
        return true; // atomically set to true
    });
    if (!claimed) return null;
    // After claiming the slot, read the owner
    const snap = await get(ref(rtdb, `suggestions/${suggestionId}`));
    if (!snap.exists()) return null;
    const d = snap.val();
    ownerUid = d.uid || '';
    ownerName = d.userName || 'Student';
    if (!ownerUid || ownerUid === 'anonymous') return null;
    return { uid: ownerUid, userName: ownerName };
};

export const adminReplySuggestion = async (suggestionId: string, reply: string, tag?: string, status?: 'open' | 'replied' | 'resolved'): Promise<void> => {
    try {
        const r = ref(rtdb, `suggestions/${suggestionId}`);
        const computedStatus = status ?? (reply.trim() ? 'replied' : 'open');
        await update(r, {
            adminReply: reply,
            adminReplyAt: new Date().toISOString(),
            status: computedStatus,
            ...(tag !== undefined ? { adminTag: tag } : {}),
        });
        // Award 5 coins for reply — atomic claim prevents double-award
        const replyOwner = await claimSuggestionReward(suggestionId, 'reply');
        if (replyOwner) {
            await awardSuggestionCoins(replyOwner.uid, replyOwner.userName, 5, 'admin_replied', suggestionId);
            await updateSuggestionLeaderboard(replyOwner.uid, replyOwner.userName, 'replied');
        }
        // Award 20 coins if marked resolved
        if (computedStatus === 'resolved') {
            const resolveOwner = await claimSuggestionReward(suggestionId, 'resolve');
            if (resolveOwner) {
                await awardSuggestionCoins(resolveOwner.uid, resolveOwner.userName, 20, 'galti_resolved', suggestionId);
                await updateSuggestionLeaderboard(resolveOwner.uid, resolveOwner.userName, 'resolved');
            }
        }
    } catch (e) { console.error('[Suggestions] adminReply error:', e); }
};

export const resolvesuggestion = async (suggestionId: string): Promise<void> => {
    try {
        await update(ref(rtdb, `suggestions/${suggestionId}`), { status: 'resolved' });
        // Award 20 coins — atomic claim prevents double-award
        const owner = await claimSuggestionReward(suggestionId, 'resolve');
        if (owner) {
            await awardSuggestionCoins(owner.uid, owner.userName, 20, 'galti_resolved', suggestionId);
            await updateSuggestionLeaderboard(owner.uid, owner.userName, 'resolved');
        }
    } catch (e) { console.error('[Suggestions] resolve error:', e); }
};

export const deleteSuggestion = async (suggestionId: string): Promise<void> => {
    try { await set(ref(rtdb, `suggestions/${suggestionId}`), null); }
    catch (e) { console.error('[Suggestions] delete error:', e); }
};

// Find an existing OPEN suggestion for the same note point (same chapterKey + pointIndex).
// Returns { id, reportCount } if found, null otherwise.
export const findDuplicateSuggestionByPoint = async (
    chapterKey: string,
    pointIndex: number
): Promise<{ id: string; reportCount: number } | null> => {
    try {
        const snap = await get(ref(rtdb, 'suggestions'));
        if (!snap.exists()) return null;
        let match: { id: string; reportCount: number } | null = null;
        snap.forEach((child) => {
            const d = child.val();
            if (
                d.status === 'open' &&
                d.chapterKey === chapterKey &&
                Array.isArray(d.pointsData) &&
                d.pointsData.length > 0 &&
                d.pointsData[0].index === pointIndex
            ) {
                match = { id: child.key as string, reportCount: d.reportCount ?? 1 };
            }
        });
        return match;
    } catch (e) { console.error('[Suggestions] findDuplicate error:', e); return null; }
};

// Increment the reportCount on an existing suggestion (duplicate detection).
export const incrementSuggestionReportCount = async (suggestionId: string): Promise<void> => {
    try {
        const r = ref(rtdb, `suggestions/${suggestionId}`);
        const snap = await get(r);
        if (!snap.exists()) return;
        const current = snap.val().reportCount ?? 1;
        await update(r, { reportCount: current + 1 });
    } catch (e) { console.error('[Suggestions] incrementReportCount error:', e); }
};

// Admin utility: find all duplicate suggestion groups (same chapterKey+pointIndex OR same text),
// keep the oldest entry per group (with merged reportCount), delete the rest.
// Returns number of duplicates removed.
export const mergeDuplicateSuggestions = async (): Promise<number> => {
    try {
        const snap = await get(ref(rtdb, 'suggestions'));
        if (!snap.exists()) return 0;
        const all: Array<{ id: string; val: Record<string, any> }> = [];
        snap.forEach((child) => { all.push({ id: child.key as string, val: child.val() }); });

        // Group by chapterKey+pointIndex (for inline corrections) OR normalized text (for text-only)
        const groups = new Map<string, typeof all>();
        for (const item of all) {
            const d = item.val;
            let key: string;
            if (d.chapterKey && Array.isArray(d.pointsData) && d.pointsData.length > 0) {
                key = `cp::${d.chapterKey}::${d.pointsData[0].index}`;
            } else {
                // Normalize text: lowercase, collapse whitespace, first 80 chars
                key = `tx::${(d.text || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80)}`;
            }
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(item);
        }

        let removed = 0;
        for (const group of groups.values()) {
            if (group.length < 2) continue;
            // Sort oldest first (by createdAt)
            group.sort((a, b) => (a.val.createdAt || '').localeCompare(b.val.createdAt || ''));
            const [keeper, ...dupes] = group;
            const totalCount = group.reduce((s, i) => s + (i.val.reportCount ?? 1), 0);
            // Update keeper with merged count
            await update(ref(rtdb, `suggestions/${keeper.id}`), { reportCount: totalCount });
            // Delete all duplicates
            for (const dupe of dupes) {
                await set(ref(rtdb, `suggestions/${dupe.id}`), null);
                removed++;
            }
        }
        return removed;
    } catch (e) { console.error('[Suggestions] mergeDuplicates error:', e); return 0; }
};

// ── Mark lock ──────────────────────────────────────────────────────────────
export const saveUserMarkLock = async (locked: boolean): Promise<void> => {
    try {
        await setDoc(doc(db, 'admin_settings', 'important_mark'), { userMarkLocked: locked, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
        console.error('[MarkLock] Error saving:', e);
    }
};

export const subscribeUserMarkLock = (
    callback: (locked: boolean) => void
): (() => void) => {
    const unsub = onSnapshot(
        doc(db, 'admin_settings', 'important_mark'),
        (snap) => callback(snap.exists() ? (snap.data()?.userMarkLocked as boolean) ?? false : false),
        () => callback(false)
    );
    return unsub;
};

// ── 13. Suggestion Leaderboard & Coin Rewards ────────────────────────────────
// Firestore: suggestion_leaderboard/{uid}  — permanent record even after RTDB
// suggestion is auto-deleted after 7 days.
// Firestore: user_coins/{uid}              — coin wallet per user.

export interface SuggLeaderboardEntry {
    uid: string;
    userName: string;
    totalReported: number;
    totalResolved: number;
    totalReplied: number;
    totalCoins: number;
    lastActivity: string;
}

/** Increment leaderboard counters when user reports / gets reply / gets resolved. */
export const updateSuggestionLeaderboard = async (
    uid: string,
    userName: string,
    action: 'reported' | 'resolved' | 'replied'
): Promise<void> => {
    if (!uid || uid === 'anonymous') return;
    try {
        const lbRef = doc(db, 'suggestion_leaderboard', uid);
        const updateData: Record<string, any> = {
            uid,
            userName,
            lastActivity: new Date().toISOString(),
        };
        if (action === 'reported') updateData.totalReported = increment(1);
        if (action === 'resolved') updateData.totalResolved = increment(1);
        if (action === 'replied')  updateData.totalReplied  = increment(1);
        await setDoc(lbRef, updateData, { merge: true });
    } catch (e) { console.error('[Leaderboard] update error:', e); }
};

/** Award coins to a user for suggestion activity. Deduplication is handled
 *  in the calling code via RTDB rewardedFor flags. */
export const awardSuggestionCoins = async (
    uid: string,
    userName: string,
    amount: number,
    reason: string,
    suggestionId: string
): Promise<void> => {
    if (!uid || uid === 'anonymous') return;
    try {
        const historyEntry = { amount, reason, date: new Date().toISOString(), suggestionId };
        await setDoc(doc(db, 'user_coins', uid), {
            uid,
            userName,
            coins: increment(amount),
            history: arrayUnion(historyEntry),
        }, { merge: true });
        // Mirror totalCoins into the leaderboard so ranking works
        await setDoc(doc(db, 'suggestion_leaderboard', uid), {
            uid,
            userName,
            totalCoins: increment(amount),
            lastActivity: new Date().toISOString(),
        }, { merge: true });
    } catch (e) {
        console.error('[Coins] award error:', e);
        throw e; // propagate so callers can detect failure
    }
};

/** Real-time top-20 leaderboard sorted by totalCoins desc. */
export const subscribeLeaderboard = (
    callback: (entries: SuggLeaderboardEntry[]) => void
): (() => void) => {
    const q = query(
        collection(db, 'suggestion_leaderboard'),
        orderBy('totalCoins', 'desc'),
        limit(20)
    );
    return onSnapshot(q,
        (snap) => callback(snap.docs.map(d => d.data() as SuggLeaderboardEntry)),
        () => callback([])
    );
};

/** Real-time coin balance + history for a single user. */
export const subscribeUserCoins = (
    uid: string,
    callback: (coins: number, history: Array<{ amount: number; reason: string; date: string; suggestionId: string }>) => void
): (() => void) => {
    if (!uid || uid === 'anonymous') { callback(0, []); return () => {}; }
    return onSnapshot(
        doc(db, 'user_coins', uid),
        (snap) => {
            if (snap.exists()) {
                const d = snap.data();
                callback(d.coins ?? 0, (d.history ?? []).slice(-50).reverse());
            } else {
                callback(0, []);
            }
        },
        () => callback(0, [])
    );
};
