import { User, SystemSettings } from '../types';

/**
 * Checks whether sequential page reading rule is strictly enforced for a user.
 * - Free users: ALWAYS ON (must complete 5-step sequence: Reading -> MCQ -> Rev Same Topic -> Rev Today Topic -> My Mistake).
 * - Basic & Ultra users: Configurable (can turn ON/OFF themselves in Profile Settings).
 * - Credit ON mode: NEVER ENFORCED (users can do anything in any order they wish).
 * - Admin / Sub-Admin: Always bypassed.
 */
export const isSequentialReadingEnforced = (
  user?: User | null,
  settings?: SystemSettings | null
): boolean => {
  if (!user) return true;
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUB_ADMIN';
  if (isAdmin) return false;

  // Credit Economy Mode: All pages and steps are unlocked directly and user can study in any order
  if (user.studyMode === 'CREDIT') {
    return false;
  }

  const isVip = Boolean(
    user.isPremium && (user.subscriptionLevel === 'BASIC' || user.subscriptionLevel === 'ULTRA')
  );

  if (isVip) {
    // Basic & Ultra users can toggle it OFF for themselves in Settings
    if (user.sequentialReadingDisabled === true) {
      return false;
    }
    // Default for VIP: Follows admin setting or default ON
    return settings?.enforceSequentialPages !== false;
  }

  // Free users: ALWAYS ON
  return true;
};

/**
 * Rule: Har user ko har subject ka 1st lesson 100% FREE milega (all features unlocked).
 */
export const isFirstLessonOfSubject = (
  entry?: any,
  allNotes?: any[]
): boolean => {
  if (!entry) return false;
  if (entry.isSampleLesson) return true;
  if (entry.chapterIndex === 0 || entry.lessonIndex === 0) return true;

  if (Array.isArray(allNotes) && allNotes.length > 0) {
    const sub = (entry.subject || '').trim().toLowerCase();
    const book = (entry.bookName || '').trim().toLowerCase();
    const classLvl = (entry.classLevel || '').trim().toLowerCase();
    
    const sameSubNotes = allNotes.filter((n: any) => {
      if ((n.subject || '').trim().toLowerCase() !== sub) return false;
      if (book && (n.bookName || '').trim().toLowerCase() !== book) return false;
      if (classLvl && (n.classLevel || '').trim().toLowerCase() !== classLvl) return false;
      return true;
    });

    if (sameSubNotes.length > 0 && sameSubNotes[0].id === entry.id) {
      return true;
    }
  }

  return false;
};

export type SequentialStep = 'READING' | 'MCQ' | 'REV_SAME' | 'REV_TODAY' | 'MISTAKE' | 'COMPLETED';

export const SEQUENTIAL_STEPS: { step: SequentialStep; title: string; short: string; emoji: string }[] = [
  { step: 'READING',   title: 'Reading Mode (Complete Notes Reading)', short: 'Reading',    emoji: '📖' },
  { step: 'MCQ',       title: 'MCQ Practice (Solve Page Questions)',   short: 'MCQ',        emoji: '🧠' },
  { step: 'REV_SAME',  title: 'Revision Hub (Same Topic Revision)',   short: 'Rev Same',   emoji: '🔄' },
  { step: 'REV_TODAY', title: 'Revision Hub (Today Topic Revision)',  short: 'Rev Today',  emoji: '📅' },
  { step: 'MISTAKE',   title: 'My Mistake Review (Wrong Answers)',    short: 'My Mistake', emoji: '⚠️' },
];
