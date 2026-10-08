// My Routine — localStorage-based data layer
// All routine state, coins, rewards persisted here.

import { isSubscriptionFromCoins } from './subscriptionUtils';
import { CLASS_10_FAKE_LESSONS } from '../constants/class10SeedLessons';

export type SubjectCategory = 'SCIENCE' | 'SOCIAL_SCIENCE' | 'OTHER';

export interface RoutineSubjectConfig {
  id: string;
  name: string;
  category: SubjectCategory;
  routineApplied: boolean;  // does this subject get routine benefits?
  startLessonIndex: number; // 0-based, fixed start point for repetition
  totalLessons: number;
  currentLessonIndex: number; // where we are in the repetition cycle
}

// ── Routine Slot: one daily study track (book+subject, 1 lesson/day) ──────────
export interface RoutineSlot {
  id: string;
  bookName: string;
  classLevel?: string;
  subjectId: string;
  displayName: string;
  emoji: string;
  categoryName?: string;
  currentLessonIndex: number;
  startLessonIndex: number;
  totalLessons: number;
}

// ── New Category model: one slot = one named group of rotating subjects ────────
export interface RoutineCategorySubject {
  subjectId: string;
  bookName: string;
  classLevel?: string;
  board?: string;
  displayName: string;
  emoji: string;
  currentLessonIndex: number;
  totalLessons: number;
}

export interface RoutineCategory {
  id: string;
  categoryName: string;
  emoji: string;                      // emoji of first/primary subject
  subjects: RoutineCategorySubject[]; // all subjects in this category
  currentSubjectIndex: number;        // which subject is active today (rotates on completion)
}

export interface PageProgress {
  pageRead: boolean;
  mcqDone: boolean;
  mcqScore?: number; // 1-5
  timeSpentSeconds?: number;
  lastAttemptScore?: number;
}

export interface LessonProgress {
  lessonId: string;
  subjectId: string;
  totalPages: number;
  pages: Record<number, PageProgress>; // page index → progress
  isComplete: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface DailyTask {
  date: string; // YYYY-MM-DD
  scienceSubjectId?: string;
  scienceLessonId?: string;
  socialScienceSubjectId?: string;
  socialScienceLessonId?: string;
  scienceComplete: boolean;
  socialScienceComplete: boolean;
  otherTasks: Array<{ subjectId: string; lessonId: string; complete: boolean }>;
}

export interface DailyClaimEntry {
  date: string;       // YYYY-MM-DD
  amount: number;     // coins earned this day
  claimed: boolean;   // has user clicked claim for this day?
  claimedAt?: string; // ISO timestamp
}

export interface RoutineData {
  enabled: boolean;
  subjects: RoutineSubjectConfig[];
  lessonProgress: Record<string, LessonProgress>; // lessonId → progress
  dailyTasks: Record<string, DailyTask>; // date → task
  coins: number;
  yesterdayTaskComplete: boolean;
  discountActiveUntil?: string; // ISO timestamp — 24h 50% discount
  lastResetDate: string; // YYYY-MM-DD
  // Subscription daily claim
  dailyClaims: Record<string, DailyClaimEntry>; // date → claim entry
  trackingHistory: Array<{
    date: string;
    lessonId: string;
    subjectId: string;
    pagesRead: number;
    mcqsDone: number;
    coinsEarned: number;
    coinsSpent: number;
  }>;
  // Revision Hub: lessonIds that are permanently unlocked
  revisionUnlockedLessons: Record<string, boolean>; // lessonId → true
  // ── Routine track selection ──────────────────────────────────────────────
  routineMode: 'SCHOOL' | 'COMPETITION' | null;
  selectedBoard: string | null;   // school: 'CBSE' | 'BSEB' | 'UP Board' | etc.
  selectedClass: string | null;   // school: '6'–'12'
  selectedBook: string | null;    // competition: single book (legacy)
  selectedBooks: string[];        // competition: multiple books (primary)
  // ── Multi-category slot system ───────────────────────────────────────────────
  routineSlots: RoutineSlot[];          // legacy — kept for migration only
  routineCategories: RoutineCategory[]; // primary: one entry per named category (active class)
  // Per-class/book category snapshots — keyed by "SCHOOL_<classLevel>" or "COMPETITION_<book1+book2>"
  // Saved automatically when user switches class/books so state is fully restored on switch-back.
  routineCategoriesByClass: Record<string, RoutineCategory[]>;
  // Competition books unlocked by Free/Basic users with the one-time book fee.
  unlockedCompetitionBooks: Record<string, boolean>;
  unlockedTierSlot: boolean;            // paid with coins (tier-price)
  unlockedLevel5Slot: boolean;          // legacy flag — level bonus now computed from level directly
  unlockedLevel8Slot: boolean;          // legacy flag — level bonus now computed from level directly
  studyMode?: 'CREDIT' | 'WITHOUT_CREDIT'; // 'CREDIT' = earn/spend credits; 'WITHOUT_CREDIT' = 0 credits, strict sequential
}

const STORAGE_KEY = 'nst_my_routine_v1';

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Check if a subject / book / title is single-page competition homework or Sar Sangrah / Speedy / One-subject book */
export function isRoutineSubjectNameExcluded(name?: string | null, singleBookNames?: string[]): boolean {
  if (!name) return false;
  const s = String(name).toLowerCase().trim();
  if (
    s.includes('sar sangrah') ||
    s.includes('saar sangrah') ||
    s.includes('sar-sangrah') ||
    s.includes('speedy') ||
    s.includes('spidy') ||
    s.includes('homework') ||
    s.includes('coaching') ||
    s.includes('mcq practice')
  ) {
    return true;
  }
  if (singleBookNames && singleBookNames.length > 0) {
    for (const bName of singleBookNames) {
      if (!bName) continue;
      if (s === bName || s.includes(bName)) return true;
    }
  }
  return false;
}

/** Strict check for whether a note is eligible for Routine (multi-page/multi-subject only, no 1-subject / 1-page books) */
export function isMultiPageRoutineNote(n: any, singleBookNames?: string[]): boolean {
  if (!n) return false;
  const pCount = Array.isArray(n.pages) ? n.pages.length : (n.pageCount || 0);
  // Must have at least 1 page to be eligible for routine
  if (pCount <= 0) return false;

  const title = (n.lessonTitle || n.title || '').toLowerCase();
  const book = ((n as any).bookName || '').toLowerCase();
  const sub = (n.subject || '').toLowerCase();
  const cat = ((n as any).category || '').toLowerCase();
  const cl = String((n as any).classLevel || '').toLowerCase();

  if (
    isRoutineSubjectNameExcluded(title, singleBookNames) ||
    isRoutineSubjectNameExcluded(book, singleBookNames) ||
    isRoutineSubjectNameExcluded(sub, singleBookNames) ||
    isRoutineSubjectNameExcluded(cat, singleBookNames) ||
    isRoutineSubjectNameExcluded(cl, singleBookNames)
  ) {
    return false;
  }
  return true;
}

/** Standard academic school subject names (Class 6-12) */
export const ACADEMIC_SUBJECT_NAMES = new Set([
  'physics', 'chemistry', 'biology', 'science', 'math', 'maths', 'mathematics',
  'history', 'geography', 'polity', 'political science', 'political_science',
  'economics', 'civics', 'sociology', 'hindi', 'english', 'sanskrit', 'urdu',
  'maithili', 'bhojpuri', 'गणित', 'गणित (mathematics)', 'विज्ञान', 'भौतिकी',
  'रसायन विज्ञान', 'जीव विज्ञान', 'इतिहास', 'भूगोल', 'राजनीति शास्त्र',
  'राजनीति विज्ञान', 'अर्थशास्त्र', 'ns', 'sh', 'sn', 'sst', 'sc'
]);

/**
 * Checks whether a note belongs strictly to School / Academic (Class 6-12, BSEB, etc.)
 * rather than Competition (Lucent GK, Railway, SSC, etc.)
 */
export function isAcademicSchoolNote(n: any): boolean {
  if (!n) return false;
  // If explicitly tagged as COMPETITION, it is NOT an academic school note
  if (n.classLevel === 'COMPETITION') return false;

  const cl = String(n.classLevel || '').trim().toLowerCase();
  // Any numeric class 1-12 or starting with class / std / ending with th
  if (cl && (!isNaN(Number(cl)) || cl.startsWith('class') || cl.includes('class') || cl.startsWith('std') || /^\d+(st|nd|rd|th)$/.test(cl))) {
    return true;
  }
  // Any board specified (and classLevel not explicitly COMPETITION)
  if (n.board && n.board !== 'ALL_BOARDS') {
    return true;
  }
  // If bookName or subject is an academic school subject name and not tagged as competition
  const bk = String(n.bookName || '').trim().toLowerCase();
  const sub = String(n.subject || '').trim().toLowerCase();
  if (ACADEMIC_SUBJECT_NAMES.has(bk) || ACADEMIC_SUBJECT_NAMES.has(sub)) {
    return true;
  }
  return false;
}

/** Sanitize routine categories removing any single-page / homework / speedy / sar sangrah subjects */
export function sanitizeRoutineCategories(cats: RoutineCategory[], singleBookNames?: string[]): RoutineCategory[] {
  if (!Array.isArray(cats)) return [];
  return cats
    .filter(cat => !isRoutineSubjectNameExcluded(cat.categoryName, singleBookNames))
    .map(cat => {
      const filteredSubjects = (cat.subjects || []).filter(sub => {
        return (
          !isRoutineSubjectNameExcluded(sub.displayName, singleBookNames) &&
          !isRoutineSubjectNameExcluded(sub.subjectId, singleBookNames) &&
          !isRoutineSubjectNameExcluded(sub.bookName, singleBookNames)
        );
      });
      return {
        ...cat,
        subjects: filteredSubjects,
        currentSubjectIndex: Math.min(
          cat.currentSubjectIndex || 0,
          Math.max(0, filteredSubjects.length - 1)
        ),
      };
    })
    .filter(cat => cat.subjects && cat.subjects.length > 0);
}

/** Migrate old routineSlots (one-slot-per-subject) → routineCategories (one-category-per-name) */
function migrateSlotsToCats(slots: RoutineSlot[]): RoutineCategory[] {
  if (!slots?.length) return [];
  const map = new Map<string, RoutineCategory>();
  for (const slot of slots) {
    const key = slot.categoryName || slot.displayName || slot.subjectId;
    if (!map.has(key)) {
      map.set(key, {
        id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        categoryName: slot.categoryName || key,
        emoji: slot.emoji,
        subjects: [],
        currentSubjectIndex: 0,
      });
    }
    map.get(key)!.subjects.push({
      subjectId: slot.subjectId,
      bookName: slot.bookName,
      classLevel: slot.classLevel,
      displayName: slot.displayName,
      emoji: slot.emoji,
      currentLessonIndex: slot.currentLessonIndex,
      totalLessons: slot.totalLessons,
    });
  }
  return Array.from(map.values());
}

export function loadRoutineData(userId: string): RoutineData {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const slots: RoutineSlot[] = parsed.routineSlots ?? [];
      // Migrate old slots to categories if needed and sanitize
      const rawCats: RoutineCategory[] =
        parsed.routineCategories?.length
          ? parsed.routineCategories
          : migrateSlotsToCats(slots);
      const cats: RoutineCategory[] = sanitizeRoutineCategories(rawCats);
      return {
        ...parsed,
        revisionUnlockedLessons: parsed.revisionUnlockedLessons || {},
        routineMode: parsed.routineMode ?? null,
        selectedBoard: parsed.selectedBoard ?? null,
        selectedClass: parsed.selectedClass ?? null,
        selectedBook: parsed.selectedBook ?? null,
        selectedBooks: parsed.selectedBooks ?? [],
        routineSlots: slots,
        routineCategories: cats,
        routineCategoriesByClass: parsed.routineCategoriesByClass ?? {},
        unlockedCompetitionBooks: parsed.unlockedCompetitionBooks ?? {},
        unlockedTierSlot: parsed.unlockedTierSlot ?? false,
        unlockedLevel5Slot: parsed.unlockedLevel5Slot ?? false,
        unlockedLevel8Slot: parsed.unlockedLevel8Slot ?? false,
      };
    }
  } catch {}
  return {
    enabled: false,
    subjects: getDefaultSubjects(),
    lessonProgress: {},
    dailyTasks: {},
    coins: 100,
    yesterdayTaskComplete: false,
    lastResetDate: getTodayStr(),
    dailyClaims: {},
    trackingHistory: [],
    revisionUnlockedLessons: {},
    routineMode: null,
    selectedBoard: null,
    selectedClass: null,
    selectedBook: null,
    selectedBooks: [],
    routineSlots: [],
    routineCategories: [],
    routineCategoriesByClass: {},
    unlockedCompetitionBooks: {},
    unlockedTierSlot: false,
    unlockedLevel5Slot: false,
    unlockedLevel8Slot: false,
  };
}

export function saveRoutineData(userId: string, data: RoutineData): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(data));
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('iic-routine-updated', { detail: { userId, data } }));
      }, 0);
    }
  } catch {}
}

function getDefaultSubjects(): RoutineSubjectConfig[] {
  return [
    { id: 'physics', name: 'Physics', category: 'SCIENCE', routineApplied: true, startLessonIndex: 0, totalLessons: 15, currentLessonIndex: 0 },
    { id: 'chemistry', name: 'Chemistry', category: 'SCIENCE', routineApplied: true, startLessonIndex: 0, totalLessons: 16, currentLessonIndex: 0 },
    { id: 'biology', name: 'Biology', category: 'SCIENCE', routineApplied: true, startLessonIndex: 0, totalLessons: 12, currentLessonIndex: 0 },
    { id: 'history', name: 'History', category: 'SOCIAL_SCIENCE', routineApplied: true, startLessonIndex: 0, totalLessons: 10, currentLessonIndex: 0 },
    { id: 'polity', name: 'Polity', category: 'SOCIAL_SCIENCE', routineApplied: true, startLessonIndex: 0, totalLessons: 12, currentLessonIndex: 0 },
    { id: 'economics', name: 'Economics', category: 'SOCIAL_SCIENCE', routineApplied: true, startLessonIndex: 0, totalLessons: 10, currentLessonIndex: 0 },
    { id: 'geography', name: 'Geography', category: 'SOCIAL_SCIENCE', routineApplied: true, startLessonIndex: 0, totalLessons: 11, currentLessonIndex: 0 },
  ];
}

export function getTodayTask(data: RoutineData): DailyTask | null {
  return data.dailyTasks[getTodayStr()] || null;
}

export function checkAndResetDaily(data: RoutineData): RoutineData {
  const today = getTodayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (data.lastResetDate === today) return data;

  // Check yesterday's task completion
  const yt = data.dailyTasks[yesterdayStr];
  const yesterdayComplete = yt
    ? (yt.scienceComplete && yt.socialScienceComplete)
    : false;

  // NOTE: coins are no longer auto-granted just for the day passing.
  // Reward (50 coins + Revision Hub unlock/discount) is only granted when a
  // lesson is actually completed — see handleLessonComplete in MyRoutine.tsx.
  // yesterdayTaskComplete is kept purely as a display flag.
  const updated: RoutineData = {
    ...data,
    lastResetDate: today,
    yesterdayTaskComplete: yesterdayComplete,
  };

  return updated;
}

/**
 * Generate today's daily task.
 * Pass lucentNotes so real entry.id values are used instead of synthetic ones.
 */
export function generateDailyTask(data: RoutineData, lucentNotes?: any[]): DailyTask {
  const today = getTodayStr();
  const existing = data.dailyTasks[today];
  if (existing) return existing;

  // If yesterday's lesson wasn't finished, carry it forward as-is instead of
  // rotating to a new subject/lesson — same topic stays until it's complete.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const yTask = data.dailyTasks[yesterdayStr];

  // Build subject → sorted notes map from real lucentNotes + Class 10 mock lessons
  const notesBySubject: Record<string, any[]> = {};
  const rawNotes = Array.isArray(lucentNotes) ? lucentNotes : [];
  const existingIds = new Set(rawNotes.map((n: any) => n.id));
  const effectiveNotes = [...rawNotes, ...CLASS_10_FAKE_LESSONS.filter(l => !existingIds.has(l.id))];

  if (effectiveNotes.length > 0) {
    const targetBoard = data.selectedBoard || 'BSEB';
    effectiveNotes.forEach(n => {
      if (data.routineMode === 'SCHOOL') {
        if (targetBoard && targetBoard !== 'ALL_BOARDS') {
          const nb = (n as any).board;
          if (nb && nb !== targetBoard && nb !== 'ALL_BOARDS') return;
        }
        if (data.selectedClass) {
          const cl = (n as any).classLevel;
          if (cl && String(cl) !== String(data.selectedClass)) return;
        }
      }
      const sid = (n.subject || 'other').toLowerCase().trim();
      if (!notesBySubject[sid]) notesBySubject[sid] = [];
      notesBySubject[sid].push(n);
    });
  }

  const scienceSubjects = data.subjects.filter(s => s.category === 'SCIENCE' && s.routineApplied);
  const socialSubjects  = data.subjects.filter(s => s.category === 'SOCIAL_SCIENCE' && s.routineApplied);

  const pickSubject = (subjects: RoutineSubjectConfig[]) => {
    if (subjects.length === 0) return null;
    const idx = Math.floor(Date.now() / 86400000) % subjects.length;
    return subjects[idx];
  };

  const scienceSub = pickSubject(scienceSubjects);
  const socialSub  = pickSubject(socialSubjects);

  const getRealLessonId = (sub: RoutineSubjectConfig | null) => {
    if (!sub) return undefined;
    const subjectNotes = notesBySubject[sub.id] || [];
    const note = subjectNotes[sub.currentLessonIndex];
    if (note?.id) return note.id; // ← real lucentNote entry.id
    // fallback synthetic id if notes not yet loaded
    return `${sub.id}_lesson_${sub.currentLessonIndex + 1}`;
  };

  const getRealLessonTitle = (sub: RoutineSubjectConfig | null) => {
    if (!sub) return undefined;
    const subjectNotes = notesBySubject[sub.id] || [];
    return subjectNotes[sub.currentLessonIndex]?.lessonTitle;
  };

  const carrySci    = yTask && !yTask.scienceComplete && yTask.scienceLessonId;
  const carrySocial = yTask && !yTask.socialScienceComplete && yTask.socialScienceLessonId;

  const task: DailyTask = {
    date: today,
    scienceSubjectId:        carrySci    ? yTask!.scienceSubjectId       : scienceSub?.id,
    scienceLessonId:         carrySci    ? yTask!.scienceLessonId        : getRealLessonId(scienceSub),
    socialScienceSubjectId:  carrySocial ? yTask!.socialScienceSubjectId : socialSub?.id,
    socialScienceLessonId:   carrySocial ? yTask!.socialScienceLessonId  : getRealLessonId(socialSub),
    scienceComplete:         false,
    socialScienceComplete:   false,
    otherTasks:              [],
  };

  return task;
}

export function getLessonProgress(data: RoutineData, lessonId: string, totalPages: number): LessonProgress {
  if (data.lessonProgress[lessonId]) return data.lessonProgress[lessonId];
  return {
    lessonId,
    subjectId: lessonId.split('_lesson_')[0],
    totalPages,
    pages: {},
    isComplete: false,
  };
}

export function isLessonComplete(progress: LessonProgress): boolean {
  for (let i = 0; i < progress.totalPages; i++) {
    const p = progress.pages[i];
    if (!p || !p.pageRead || !p.mcqDone) return false;
  }
  return progress.totalPages > 0;
}

export function getPageBoxState(progress: LessonProgress, pageIndex: number): 'green' | 'gray' {
  const p = progress.pages[pageIndex];
  if (p && p.pageRead && p.mcqDone) return 'green';
  return 'gray';
}

// Coin operations
export const PAGE_READ_COST           = 20;
export const MCQ_COST                 = 40;
export const LESSON_COMPLETE_REWARD   = 50;
export const SKIP_LESSON_COST_PER_LESSON = 25;

/** Reward coins per page read: for Basic/Ultra, reward is not halved even if routine is off; for Free, level÷2 if applied, level÷4 if not */
export function getPageReadReward(level: number, routineApplied: boolean, isSubscriber?: boolean): number {
  if (isSubscriber) {
    return Math.floor(level / 2);
  }
  return Math.floor(level / (routineApplied ? 2 : 4));
}

export function hasActiveDiscount(data: RoutineData): boolean {
  if (!data.discountActiveUntil) return false;
  return new Date(data.discountActiveUntil) > new Date();
}

/** Returns 0.5 if 50% discount is active, else 1.0 */
export function getDiscountFactor(data: RoutineData): number {
  return hasActiveDiscount(data) ? 0.5 : 1.0;
}

export function getSkipCost(currentStart: number, newStart: number): number {
  if (newStart <= currentStart) return 0;
  return (newStart - currentStart) * SKIP_LESSON_COST_PER_LESSON;
}

/** Unlock a lesson's Revision Hub entry permanently */
export function unlockRevisionLesson(data: RoutineData, lessonId: string): RoutineData {
  if (data.revisionUnlockedLessons[lessonId]) return data;
  return {
    ...data,
    revisionUnlockedLessons: { ...data.revisionUnlockedLessons, [lessonId]: true },
  };
}

/** Is a specific lesson unlocked in Revision Hub? */
export function isRevisionLessonUnlocked(data: RoutineData, lessonId: string): boolean {
  return !!data.revisionUnlockedLessons[lessonId];
}

// ── Daily Subscription Coin Claim ──────────────────────────────────────────
// Note: Standard Pro and Max daily claims removed as requested. Daily diamond drops are exclusive to VIP+ plans.
export const DAILY_CLAIM_PRO     = 0;  // Standard Pro has no daily claim
export const DAILY_CLAIM_MAX_PRO = 0;  // Standard Max has no daily claim

export type UserSubTier = 'NONE' | 'PRO' | 'MAX_PRO';

export function getUserSubTier(user: {
  isPremium?: boolean;
  subscriptionLevel?: string;
  subscriptionEndDate?: string;
  subscriptionSource?: string;
  activeSubscriptions?: any[];
  subscriptionHistory?: any[];
}): UserSubTier {
  const now = new Date();
  const end = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const isActive = user.isPremium && (!end || end > now);
  if (!isActive) return 'NONE';

  // If subscription was purchased using credits/coins, daily subscription coin claim is NOT granted
  // (Prevents infinite credit loop / economy exploit)
  if (isSubscriptionFromCoins(user)) {
    return 'NONE';
  }

  if (user.subscriptionLevel === 'ULTRA' || (user.subscriptionLevel as any) === 'PRO') return 'MAX_PRO';
  if (user.subscriptionLevel === 'BASIC') return 'PRO';
  return 'NONE';
}

export function getDailyClaimAmount(tier: UserSubTier, customAmounts?: { pro?: number; maxPro?: number; dailyClaimPro?: number; dailyClaimMaxPro?: number } | any): number {
  const proAmt = customAmounts?.dailyClaimPro ?? customAmounts?.pro ?? DAILY_CLAIM_PRO;
  const maxProAmt = customAmounts?.dailyClaimMaxPro ?? customAmounts?.maxPro ?? DAILY_CLAIM_MAX_PRO;
  if (tier === 'MAX_PRO') return maxProAmt;
  if (tier === 'PRO') return proAmt;
  return 0;
}

/** Returns total unclaimed coins stacked across all days */
export function getUnclaimedCoins(data: RoutineData, tier: UserSubTier): number {
  if (tier === 'NONE' || data.studyMode === 'WITHOUT_CREDIT') return 0;
  const today = getTodayStr();
  return Object.values(data.dailyClaims)
    .filter(e => !e.claimed && e.date <= today)
    .reduce((sum, e) => sum + e.amount, 0);
}

/** Generate today's pending claim entry if it doesn't exist (for active subscribers) */
export function ensureTodayClaimEntry(data: RoutineData, tier: UserSubTier, customAmounts?: { pro?: number; maxPro?: number; dailyClaimPro?: number; dailyClaimMaxPro?: number } | any): RoutineData {
  if (tier === 'NONE' || data.studyMode === 'WITHOUT_CREDIT') return data;
  const today = getTodayStr();
  if (data.dailyClaims[today]) return data;
  const amount = getDailyClaimAmount(tier, customAmounts);
  return {
    ...data,
    dailyClaims: {
      ...data.dailyClaims,
      [today]: { date: today, amount, claimed: false },
    },
  };
}

/** Claim all pending coins — stacks them all and marks claimed */
export function claimAllPendingCoins(data: RoutineData, tier: UserSubTier): { data: RoutineData; earned: number } {
  if (tier === 'NONE') return { data, earned: 0 };
  const now   = new Date().toISOString();
  const today = getTodayStr();
  let earned = 0;
  const updatedClaims = { ...data.dailyClaims };
  for (const [date, entry] of Object.entries(updatedClaims)) {
    if (!entry.claimed && date <= today) {
      earned += entry.amount;
      updatedClaims[date] = { ...entry, claimed: true, claimedAt: now };
    }
  }
  return {
    data: { ...data, coins: data.coins + earned, dailyClaims: updatedClaims },
    earned,
  };

}

export function advanceLessonInCycle(sub: RoutineSubjectConfig): RoutineSubjectConfig {
  let next = sub.currentLessonIndex + 1;
  if (next >= sub.totalLessons) {
    next = sub.startLessonIndex;
  }
  return { ...sub, currentLessonIndex: next };
}

// ── Slot capacity helpers ─────────────────────────────────────────────────────
export function getBaseSlotCount(tier: UserSubTier): number {
  if (tier === 'MAX_PRO') return 4; // Ultra user = +2 subjects (2 + 2 = 4 base)
  if (tier === 'PRO') return 3;     // Basic user = +1 subject (2 + 1 = 3 base)
  return 2;                         // Free user = 2 base subjects
}

export function getTierSlotCost(_tier?: UserSubTier): number {
  return 100; // 100 credits to unlock 3rd subject for free users
}

export const TIER_SLOT_DIAMOND_COST = 10;

export interface SlotStatus {
  slotNumber: number; // 1 to 5
  isUnlocked: boolean;
  requirementText: string;
  canUnlockWithCredits: boolean;
  creditCost: number;
}

export function getSlotUnlockStatus(slotNumber: number, tier: UserSubTier, level: number, data: RoutineData): SlotStatus {
  if (slotNumber <= 2) {
    return {
      slotNumber,
      isUnlocked: true,
      requirementText: 'Free (Sabhi ke liye)',
      canUnlockWithCredits: false,
      creditCost: 0,
    };
  }

  if (slotNumber === 3) {
    const isUnlocked = tier === 'PRO' || tier === 'MAX_PRO' || !!data.unlockedTierSlot;
    return {
      slotNumber: 3,
      isUnlocked,
      requirementText: isUnlocked
        ? (tier !== 'NONE' ? 'VIP Bonus Unlocked' : '100 Credits Se Unlocked')
        : '100 Credits ya Basic Plan se unlock hoga',
      canUnlockWithCredits: !isUnlocked,
      creditCost: 100,
    };
  }

  if (slotNumber === 4) {
    const isUnlocked = tier === 'MAX_PRO' || level >= 5;
    return {
      slotNumber: 4,
      isUnlocked,
      requirementText: isUnlocked
        ? (tier === 'MAX_PRO' ? 'Ultra VIP Bonus Unlocked' : `Level 5 Achieved (Lv.${level})`)
        : `Level 5 Requirement (Aapka Level: ${level}/5)`,
      canUnlockWithCredits: false,
      creditCost: 0,
    };
  }

  // Slot 5
  const isUnlocked = level >= 8 || (tier === 'MAX_PRO' && level >= 5);
  return {
    slotNumber: 5,
    isUnlocked,
    requirementText: isUnlocked
      ? `Level 8 Master Achieved (Lv.${level})`
      : `Level 8 Requirement (Aapka Level: ${level}/8)`,
    canUnlockWithCredits: false,
    creditCost: 0,
  };
}

export function getActualMaxSlots(tier: UserSubTier, level: number, data: RoutineData): number {
  let count = 2; // Slot 1 & 2 are free
  if (getSlotUnlockStatus(3, tier, level, data).isUnlocked) count = 3;
  if (getSlotUnlockStatus(4, tier, level, data).isUnlocked) count = 4;
  if (getSlotUnlockStatus(5, tier, level, data).isUnlocked) count = 5;
  return count;
}
