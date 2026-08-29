// ═══════════════════════════════════════════════════════════════════════════
// Subject Progress Aggregation — Page → Lesson → Subject → Book hierarchy
// ═══════════════════════════════════════════════════════════════════════════
//
// Data sources (all localStorage, no network):
//   nst_recent_lucent_v1  → per-page scrollPct (up to 50 most-recent entries)
//   nst_fully_read_v1     → per-page completion flags (up to 200 entries)
//
// Key format for each page:  `lucent_${lessonId}_${pageIndex}`
//
// Usage:
//   const stats = computeSubjectStats(lessonsForThisSubject);
//   → { totalLessons, completedLessons, inProgressLessons, totalPages,
//       readPages, completedPages, progressPct, coveragePct }
// ═══════════════════════════════════════════════════════════════════════════

import { getRecentLucent, getFullyReadMap, getRecentHomeworks } from './recentReads';
import { getAutoTrackSnapshot } from './routineAutoTrack';
import type { LucentNoteEntry } from '../types';

export interface SubjectLessonStats {
  totalLessons: number;
  completedLessons: number;   // all pages fully read (via TTS "Read All")
  inProgressLessons: number;  // some pages read, not all completed
  notStartedLessons: number;  // zero pages read
  totalPages: number;
  readPages: number;          // pages with scrollPct > 20 OR fully read
  completedPages: number;     // pages in fullyReadMap
  progressPct: number;        // completedLessons / totalLessons × 100
  coveragePct: number;        // readPages / totalPages × 100
  totalTimeSecs: number;      // accumulated reading seconds across all pages
}

const EMPTY: SubjectLessonStats = {
  totalLessons: 0, completedLessons: 0, inProgressLessons: 0,
  notStartedLessons: 0, totalPages: 0, readPages: 0, completedPages: 0,
  progressPct: 0, coveragePct: 0, totalTimeSecs: 0,
};

/**
 * Compute aggregated progress stats for a set of lessons (all belonging to
 * the same subject). Pass lessons pre-filtered by classLevel + subjectId + board.
 */
export const computeSubjectStats = (lessons: LucentNoteEntry[]): SubjectLessonStats => {
  try {
    if (!lessons.length) return { ...EMPTY };

    const recentLucent = getRecentLucent();
    const fullyReadMap = getFullyReadMap();
    const autoData = getAutoTrackSnapshot();

    // Fast lookup: pageId → scrollPct (from recent reads)
    const pageScrollMap: Record<string, number> = {};
    recentLucent.forEach(e => { pageScrollMap[e.id] = e.scrollPct; });

    let totalPages = 0;
    let readPages = 0;
    let completedPages = 0;
    let completedLessons = 0;
    let inProgressLessons = 0;
    let notStartedLessons = 0;
    let totalTimeSecs = 0;

    lessons.forEach(lesson => {
      const pages = lesson.pages || [];
      if (!pages.length) return;
      totalPages += pages.length;

      let lessonReadPages = 0;
      let lessonCompletedPages = 0;

      pages.forEach((_, pageIdx) => {
        const pageId = `lucent_${lesson.id}_${pageIdx}`;
        const isFullyRead = !!fullyReadMap[pageId];
        const scrollPct = pageScrollMap[pageId] || 0;

        if (isFullyRead) {
          completedPages++;
          lessonCompletedPages++;
          readPages++;
          lessonReadPages++;
        } else if (scrollPct > 20) {
          readPages++;
          lessonReadPages++;
        }

        // Accumulate reading time from auto-track timings
        totalTimeSecs += autoData.timings[`${lesson.id}__${pageIdx}`] || 0;
      });

      // A lesson is "completed" when ALL its pages are fully read
      if (lessonCompletedPages >= pages.length) {
        completedLessons++;
      } else if (lessonReadPages > 0) {
        inProgressLessons++;
      } else {
        notStartedLessons++;
      }
    });

    const totalLessons = lessons.length;
    const progressPct = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;
    const coveragePct = totalPages > 0
      ? Math.round((readPages / totalPages) * 100)
      : 0;

    return {
      totalLessons,
      completedLessons,
      inProgressLessons,
      notStartedLessons,
      totalPages,
      readPages,
      completedPages,
      progressPct,
      coveragePct,
      totalTimeSecs,
    };
  } catch {
    return { ...EMPTY };
  }
};

/**
 * Compute progress stats for competition subjects backed by homework items.
 * Uses the recent-HW scroll cache (last 6 entries) + fully-read map (last 200).
 * Each homework item counts as one "lesson".
 */
export const computeHwSubjectStats = (hwItems: { id: string }[]): SubjectLessonStats => {
  try {
    if (!hwItems.length) return { ...EMPTY };

    const recentHw = getRecentHomeworks();
    const fullyReadMap = getFullyReadMap();
    const autoData = getAutoTrackSnapshot();

    // Build per-hw scroll map from recent reads (limited to last 6 entries)
    const hwScrollMap: Record<string, number> = {};
    recentHw.forEach(e => { hwScrollMap[e.id] = e.scrollPct; });

    // Build a set of hw ids for fast timing lookup
    const hwIdSet = new Set(hwItems.map(hw => hw.id));

    const totalLessons = hwItems.length;
    let completedLessons = 0;
    let inProgressLessons = 0;
    let notStartedLessons = 0;
    let totalTimeSecs = 0;

    hwItems.forEach(hw => {
      const fullyReadKey = `hw_${hw.id}`;
      const isFullyRead = !!fullyReadMap[fullyReadKey];
      const scrollPct = hwScrollMap[hw.id] || 0;

      if (isFullyRead) {
        completedLessons++;
      } else if (scrollPct > 20) {
        inProgressLessons++;
      } else {
        notStartedLessons++;
      }
    });

    // Sum timing for all pages of matching hw items
    Object.entries(autoData.timings).forEach(([key, secs]) => {
      const sep = key.indexOf('__');
      if (sep !== -1 && hwIdSet.has(key.slice(0, sep))) totalTimeSecs += secs;
    });

    const progressPct = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;
    const coveragePct = totalLessons > 0
      ? Math.round(((completedLessons + inProgressLessons) / totalLessons) * 100)
      : 0;

    return {
      totalLessons,
      completedLessons,
      inProgressLessons,
      notStartedLessons,
      totalPages: 0,
      readPages: 0,
      completedPages: 0,
      progressPct,
      coveragePct,
      totalTimeSecs,
    };
  } catch {
    return { ...EMPTY };
  }
};

/**
 * Aggregate progress for ALL subjects in a class/board.
 * Returns a map from subjectId → SubjectLessonStats.
 */
export const computeAllSubjectStats = (
  allLucentNotes: LucentNoteEntry[],
  classLevel: string,
  board: string,
): Record<string, SubjectLessonStats> => {
  try {
    // Group filtered lessons by subject
    const bySubject: Record<string, LucentNoteEntry[]> = {};
    allLucentNotes.forEach(n => {
      if (String(n.classLevel) !== String(classLevel)) return;
      if (n.board && n.board !== board) return;
      const sid = (n.subject || 'unknown').toLowerCase().trim();
      if (!bySubject[sid]) bySubject[sid] = [];
      bySubject[sid].push(n);
    });

    const result: Record<string, SubjectLessonStats> = {};
    Object.entries(bySubject).forEach(([sid, lessons]) => {
      result[sid] = computeSubjectStats(lessons);
    });
    return result;
  } catch {
    return {};
  }
};
