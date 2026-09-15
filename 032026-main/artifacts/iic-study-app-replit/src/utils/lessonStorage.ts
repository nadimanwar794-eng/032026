// ═══════════════════════════════════════════════════════════════════════════════
// IMMORTAL LESSON STORAGE — Har mode ka alag document, data KABHI delete nahi
// ═══════════════════════════════════════════════════════════════════════════════
//
// Collections:
//   lesson_meta/{key}           — lesson metadata
//   lesson_free_notes/{key}     — free reading notes
//   lesson_premium_notes/{key}  — premium reading notes
//   lesson_topic_notes/{key}    — topic-wise notes
//   lesson_html_notes/{key}     — write mode HTML
//   lesson_mcq/{key}            — practice / weekly / challenge / mistake MCQs
//   lesson_video/{key}          — video playlist
//   lesson_audio/{key}          — audio playlist
//   lesson_pdf/{key}            — PDF links
//
// History subcollection (har mode ke andar):
//   lesson_free_notes/{key}/_history/{timestamp}
//     ├── content    — purana data snapshot
//     ├── updatedBy  — admin UID
//     ├── updatedAt  — ISO timestamp
//     ├── version    — incrementing number
//     ├── reason     — optional change reason
//     └── expiresAt  — 30 din baad (cleanup ke liye)
//
// ⚠️ STRICT RULES — KABHI NAHI TOODNA:
//   ❌ Main lesson documents pe KABHI deleteDoc nahi chalega
//   ❌ Bina history save kiye main doc KABHI overwrite nahi hoga
//   ✅ Har update se pehle purana content history mein save hoga
//   ✅ Sirf 30-din purani history delete hogi (content nahi)
// ═══════════════════════════════════════════════════════════════════════════════

import {
  doc, setDoc, getDoc, getDocs, collection, query, where, deleteDoc,
  getFirestore,
} from 'firebase/firestore';
import { storage } from './storage';

// Circular-dependency-free: getFirestore() returns the already-initialized
// Firestore instance (initialized in firebase.ts before any component loads).
const db = getFirestore();

// ── Constants ──────────────────────────────────────────────────────────────────

export const HISTORY_RETENTION_DAYS = 30;

export type LessonMode =
  | 'free_notes'
  | 'premium_notes'
  | 'topic_notes'
  | 'html_notes'
  | 'mcq'
  | 'video'
  | 'audio'
  | 'pdf';

export const LESSON_COLLECTION: Record<LessonMode, string> = {
  free_notes:    'lesson_free_notes',
  premium_notes: 'lesson_premium_notes',
  topic_notes:   'lesson_topic_notes',
  html_notes:    'lesson_html_notes',
  mcq:           'lesson_mcq',
  video:         'lesson_video',
  audio:         'lesson_audio',
  pdf:           'lesson_pdf',
};

export interface LessonHistoryMeta {
  updatedBy?: string; // admin UID
  reason?: string;    // kyun change kiya
}

// ── Sanitize (undefined values remove karo Firestore ke liye) ─────────────────

const sanitize = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(sanitize).filter(v => v !== undefined);
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = sanitize(v);
    }
    return out;
  }
  return obj;
};

// ── Extract mode-specific data from flat chapter object ───────────────────────

export const extractModeData = (data: any, mode: LessonMode): any => {
  switch (mode) {
    case 'free_notes':
      return {
        // Legacy flat fields
        freeNotes:               data.freeNotes               ?? null,
        chunkNotes:              data.chunkNotes              ?? null,
        // School/competition mode-specific lists
        schoolFreeNotesList:     data.schoolFreeNotesList     ?? null,
        competitionFreeNotesList:data.competitionFreeNotesList?? null,
        // Deep-dive / additional notes
        schoolDeepDiveEntries:     data.schoolDeepDiveEntries     ?? null,
        competitionDeepDiveEntries:data.competitionDeepDiveEntries?? null,
        deepDiveEntries:           data.deepDiveEntries           ?? null,
        schoolAdditionalNotes:     data.schoolAdditionalNotes     ?? null,
        competitionAdditionalNotes:data.competitionAdditionalNotes?? null,
        additionalNotes:           data.additionalNotes           ?? null,
      };

    case 'premium_notes':
      return {
        premiumNotes:               data.premiumNotes               ?? null,
        premiumNoteSlots:           data.premiumNoteSlots           ?? null,
        schoolPremiumNotesList:     data.schoolPremiumNotesList     ?? null,
        competitionPremiumNotesList:data.competitionPremiumNotesList?? null,
        schoolPdfPremiumSlots:      data.schoolPdfPremiumSlots      ?? null,
        competitionPdfPremiumSlots: data.competitionPdfPremiumSlots ?? null,
        // Premium content field
        content: data.content ?? null,
      };

    case 'topic_notes':
      return {
        topicNotes:            data.topicNotes            ?? null,
        teachingStrategyNotes: data.teachingStrategyNotes ?? null,
        teachingStrategyHtml:  data.teachingStrategyHtml  ?? null,
      };

    case 'html_notes':
      return {
        htmlNotes:             data.htmlNotes             ?? null,
        schoolHtmlSections:    data.schoolHtmlSections    ?? null,
        competitionHtmlSections:data.competitionHtmlSections?? null,
      };

    case 'mcq':
      return {
        // Practice MCQs
        practice:  data.manualMcqData   ?? data.mcqList ?? null,
        // Weekly test MCQs
        weekly:    data.weeklyTestMcqData ?? null,
        // Challenge / extra MCQs
        challenge: data.challengeMcqData  ?? null,
        // Mistake-practice MCQs
        mistake:   data.mistakeMcqData    ?? null,
      };

    case 'video':
      return {
        // School mode videos
        videoPlaylist:                data.videoPlaylist                ?? null,
        schoolVideoPlaylist:          data.schoolVideoPlaylist          ?? null,
        schoolPremiumVideoPlaylist:   data.schoolPremiumVideoPlaylist   ?? null,
        // Competition mode videos
        competitionVideoPlaylist:     data.competitionVideoPlaylist     ?? null,
        competitionPremiumVideoPlaylist: data.competitionPremiumVideoPlaylist ?? null,
        // Topic-level videos
        topicVideos: data.topicVideos ?? null,
      };

    case 'audio':
      return {
        audioPlaylist:            data.audioPlaylist            ?? null,
        schoolAudioPlaylist:      data.schoolAudioPlaylist      ?? null,
        competitionAudioPlaylist: data.competitionAudioPlaylist ?? null,
      };

    case 'pdf':
      return {
        pdfUrl:  data.pdfUrl  ?? null,
        pdfList: data.pdfList ?? null,
      };

    default:
      return {};
  }
};

// ── Merge all mode data into one flat object (backward compatibility) ─────────

export const mergeModeData = (modes: Partial<Record<LessonMode, any>>): any => {
  const result: any = {};
  const m = modes;

  // Reading Notes (free + deep-dive + additional)
  if (m.free_notes)    Object.assign(result, m.free_notes);
  // Premium Notes + PDF slots
  if (m.premium_notes) Object.assign(result, m.premium_notes);
  // Topic Notes + teaching strategy
  if (m.topic_notes)   Object.assign(result, m.topic_notes);
  // Writing Notes (HTML)
  if (m.html_notes)    Object.assign(result, m.html_notes);
  // Video (school + competition + topic)
  if (m.video)         Object.assign(result, m.video);
  // Audio (school + competition)
  if (m.audio)         Object.assign(result, m.audio);
  // PDF
  if (m.pdf)           Object.assign(result, m.pdf);

  // MCQ — restore legacy field names for backward compat
  if (m.mcq) {
    if (m.mcq.practice)  result.manualMcqData      = m.mcq.practice;
    if (m.mcq.weekly)    result.weeklyTestMcqData   = m.mcq.weekly;
    if (m.mcq.challenge) result.challengeMcqData    = m.mcq.challenge;
    if (m.mcq.mistake)   result.mistakeMcqData      = m.mcq.mistake;
  }

  return result;
};

// ── Has content check ─────────────────────────────────────────────────────────

const modeHasContent = (modeData: any): boolean =>
  Object.values(modeData).some(v => v !== null && v !== undefined);

// ── Core: Save ONE mode — history pehle, phir main doc ───────────────────────

export const saveLessonMode = async (
  key: string,
  mode: LessonMode,
  content: any,
  historyMeta: LessonHistoryMeta = {},
): Promise<void> => {
  const colName  = LESSON_COLLECTION[mode];
  const docRef   = doc(db, colName, key);
  const now      = new Date().toISOString();
  const expires  = new Date(
    Date.now() + HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const cleaned  = sanitize(content);

  try {
    // Step 1: Read existing doc to get current version
    const existing = await getDoc(docRef).catch(() => null);

    if (existing?.exists()) {
      const oldData  = existing.data();
      const version  = (oldData._version ?? 0) + 1;

      // Step 2: Save OLD content to _history BEFORE overwriting
      // ✅ Purana data preserve hoga
      const historyId  = now.replace(/[:.]/g, '-');
      const historyRef = doc(db, colName, key, '_history', historyId);

      await setDoc(historyRef, sanitize({
        content:   oldData,
        updatedBy: historyMeta.updatedBy ?? 'system',
        updatedAt: now,
        version,
        reason:    historyMeta.reason ?? '',
        expiresAt: expires,
      }));

      // Step 3: Update main doc (merge:true so extra fields not lost)
      await setDoc(docRef, sanitize({
        ...cleaned,
        _version:   version,
        _updatedAt: now,
        _key:       key,
      }), { merge: true });

    } else {
      // First time — no history needed yet
      await setDoc(docRef, sanitize({
        ...cleaned,
        _version:   1,
        _createdAt: now,
        _updatedAt: now,
        _key:       key,
      }));
    }

    // Step 4: Update IndexedDB cache (mode-specific key)
    const cacheKey = `nst_v2_${key}_${mode}`;
    await storage.setItem(cacheKey, cleaned).catch(() => {});

  } catch (err) {
    console.error(`[LessonStorage] saveLessonMode ${colName}/${key}:`, err);
    throw err;
  }
};

// ── Save lesson_meta ──────────────────────────────────────────────────────────

export const saveLessonMeta = async (key: string, data: any): Promise<void> => {
  try {
    const now   = new Date().toISOString();
    const parts = key.replace('nst_content_', '').split('_');

    await setDoc(doc(db, 'lesson_meta', key), sanitize({
      key,
      board:      parts[0] ?? '',
      classLevel: parts[1] ?? '',
      subject:    parts.slice(2, -1).join(' '),
      chapterId:  parts[parts.length - 1] ?? '',
      title:      data.title ?? '',
      status:     data.status ?? 'published',
      hasNotes:   !!(data.freeNotes || data.premiumNotes || data.topicNotes?.length),
      hasMcq:     !!(data.manualMcqData?.length || data.weeklyTestMcqData?.length),
      hasVideo:   !!(data.videoPlaylist?.length || data.topicVideos?.length),
      hasAudio:   !!(data.audioPlaylist?.length),
      hasPdf:     !!(data.pdfUrl || data.pdfList?.length),
      _updatedAt: now,
    }), { merge: true });

  } catch (err) {
    // Non-fatal — meta failure should not block content save
    console.warn('[LessonStorage] saveLessonMeta failed (non-fatal):', err);
  }
};

// ── Fetch ONE mode ────────────────────────────────────────────────────────────

export const getLessonMode = async (
  key: string,
  mode: LessonMode,
): Promise<any | null> => {
  const cacheKey = `nst_v2_${key}_${mode}`;

  // 1. IndexedDB cache
  try {
    const cached = await storage.getItem(cacheKey);
    if (cached) return cached;
  } catch {}

  // 2. Firestore
  try {
    const snap = await getDoc(doc(db, LESSON_COLLECTION[mode], key));
    if (snap.exists()) {
      const data = snap.data();
      await storage.setItem(cacheKey, data).catch(() => {});
      return data;
    }
  } catch (err) {
    console.warn(`[LessonStorage] getLessonMode ${LESSON_COLLECTION[mode]}/${key}:`, err);
  }

  return null;
};

// ── Fetch ALL modes in parallel → merge into flat object ──────────────────────

export const getLessonAllModes = async (key: string): Promise<any | null> => {
  const modes = Object.keys(LESSON_COLLECTION) as LessonMode[];

  const results = await Promise.allSettled(
    modes.map(mode => getLessonMode(key, mode))
  );

  const modeData: Partial<Record<LessonMode, any>> = {};
  let hasAny = false;

  results.forEach((result, idx) => {
    if (result.status === 'fulfilled' && result.value) {
      modeData[modes[idx]] = result.value;
      hasAny = true;
    }
  });

  return hasAny ? mergeModeData(modeData) : null;
};

// ── saveChapterDataV2 — flat object ko 9 collections mein split karke save ────
// Yeh saveChapterData ka naya version hai.
// ❌ Kabhi bhi purana data delete nahi karega.

export const saveChapterDataV2 = async (
  key: string,
  data: any,
  historyMeta: LessonHistoryMeta = {},
): Promise<void> => {
  const cleaned = sanitize(data);
  const modes   = Object.keys(LESSON_COLLECTION) as LessonMode[];

  await Promise.allSettled([
    // Har mode ka alag save
    ...modes.map(mode => {
      const modeContent = extractModeData(cleaned, mode);
      if (!modeHasContent(modeContent)) return Promise.resolve();
      return saveLessonMode(key, mode, modeContent, historyMeta);
    }),

    // Lesson meta update
    saveLessonMeta(key, cleaned),
  ]);
};

// ── getChapterDataV2 — naye collections se fetch, purane se fallback ──────────

export const getChapterDataV2 = async (key: string): Promise<any | null> => {
  // 1. Try new collections first
  const newData = await getLessonAllModes(key);
  if (newData) return newData;

  // 2. Fallback to old content_data (for unmigrated chapters)
  try {
    const snap = await getDoc(doc(db, 'content_data', key));
    if (snap.exists()) return snap.data();
  } catch {}

  return null;
};

// ── Migrate one chapter: content_data → new collections ──────────────────────
// ❌ Purana content_data document KABHI delete nahi hoga — sirf copy hoga.

export const migrateChapterToV2 = async (key: string): Promise<boolean> => {
  try {
    // Already migrated check
    const meta = await getDoc(doc(db, 'lesson_meta', key)).catch(() => null);
    if (meta?.exists()) return true;

    // Get from old Firestore structure
    const oldSnap = await getDoc(doc(db, 'content_data', key)).catch(() => null);
    if (!oldSnap?.exists()) return false;

    await saveChapterDataV2(key, oldSnap.data(), {
      reason: 'auto_migration_from_content_data',
    });

    console.log(`[LessonStorage] Migrated: ${key}`);
    return true;

  } catch (err) {
    console.warn(`[LessonStorage] Migration failed for ${key}:`, err);
    return false;
  }
};

// ── 30-din History Cleanup ────────────────────────────────────────────────────
// SIRF _history subcollection ki purani entries delete hogi.
// Main lesson documents pe KABHI deleteDoc nahi chalega.

export const runHistoryCleanup = async (): Promise<void> => {
  const modes = Object.keys(LESSON_COLLECTION) as LessonMode[];
  const now   = new Date().toISOString();
  let   total = 0;

  try {
    for (const mode of modes) {
      const colName  = LESSON_COLLECTION[mode];
      const docsSnap = await getDocs(collection(db, colName)).catch(() => null);
      if (!docsSnap || docsSnap.empty) continue;

      for (const lessonDoc of docsSnap.docs) {
        // Only query _history subcollection — main docs are NEVER touched
        const expiredHistory = await getDocs(
          query(
            collection(db, colName, lessonDoc.id, '_history'),
            where('expiresAt', '<', now),
          )
        ).catch(() => null);

        if (!expiredHistory) continue;

        for (const histDoc of expiredHistory.docs) {
          // ✅ Safe to delete: ye sirf 30-din purani history hai, content nahi
          await deleteDoc(histDoc.ref).catch(() => {});
          total++;
        }
      }
    }

    if (total > 0) {
      console.log(`[LessonStorage] History cleanup: ${total} expired entries removed`);
    }
  } catch (err) {
    // Non-fatal — cleanup failure should not affect app
    console.warn('[LessonStorage] runHistoryCleanup failed (non-fatal):', err);
  }
};

// ── Fetch history of a lesson mode (Admin use) ────────────────────────────────

export interface LessonHistoryEntry {
  id: string;
  content: any;
  updatedBy: string;
  updatedAt: string;
  version: number;
  reason: string;
  expiresAt: string;
}

export const getLessonModeHistory = async (
  key: string,
  mode: LessonMode,
): Promise<LessonHistoryEntry[]> => {
  try {
    const snap = await getDocs(
      collection(db, LESSON_COLLECTION[mode], key, '_history')
    );
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as LessonHistoryEntry))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
};
