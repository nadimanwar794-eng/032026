// My Routine — localStorage-based data layer
// All routine state, coins, rewards persisted here.

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
  selectedClass: string | null;   // school: '6'–'12'
  selectedBook: string | null;    // competition: single book (legacy)
  selectedBooks: string[];        // competition: multiple books (primary)
  // ── Multi-category slot system ───────────────────────────────────────────────
  routineSlots: RoutineSlot[];          // legacy — kept for migration only
  routineCategories: RoutineCategory[]; // primary: one entry per named category
  unlockedTierSlot: boolean;            // paid with coins (tier-price)
  unlockedLevel5Slot: boolean;          // legacy flag — level bonus now computed from level directly
  unlockedLevel8Slot: boolean;          // legacy flag — level bonus now computed from level directly
}

const STORAGE_KEY = 'nst_my_routine_v1';

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
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
      // Migrate old slots to categories if needed
      const cats: RoutineCategory[] =
        parsed.routineCategories?.length
          ? parsed.routineCategories
          : migrateSlotsToCats(slots);
      return {
        ...parsed,
        revisionUnlockedLessons: parsed.revisionUnlockedLessons || {},
        routineMode: parsed.routineMode ?? null,
        selectedClass: parsed.selectedClass ?? null,
        selectedBook: parsed.selectedBook ?? null,
        selectedBooks: parsed.selectedBooks ?? [],
        routineSlots: slots,
        routineCategories: cats,
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
    selectedClass: null,
    selectedBook: null,
    selectedBooks: [],
    routineSlots: [],
    routineCategories: [],
    unlockedTierSlot: false,
    unlockedLevel5Slot: false,
    unlockedLevel8Slot: false,
  };
}

export function saveRoutineData(userId: string, data: RoutineData): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(data));
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

  // Build subject → sorted notes map from real lucentNotes
  const notesBySubject: Record<string, any[]> = {};
  if (lucentNotes && lucentNotes.length > 0) {
    lucentNotes.forEach(n => {
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

/** Reward coins per page read: level÷2 if applied, level÷4 if not */
export function getPageReadReward(level: number, routineApplied: boolean): number {
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
export const DAILY_CLAIM_PRO     = 150;  // BASIC tier (Pro plan)
export const DAILY_CLAIM_MAX_PRO = 250;  // ULTRA tier (Max Pro plan)

export type UserSubTier = 'NONE' | 'PRO' | 'MAX_PRO';

export function getUserSubTier(user: {
  isPremium?: boolean;
  subscriptionLevel?: string;
  subscriptionEndDate?: string;
}): UserSubTier {
  const now = new Date();
  const end = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const isActive = user.isPremium && (!end || end > now);
  if (!isActive) return 'NONE';
  if (user.subscriptionLevel === 'ULTRA' || (user.subscriptionLevel as any) === 'PRO') return 'MAX_PRO';
  if (user.subscriptionLevel === 'BASIC') return 'PRO';
  return 'NONE';
}

export function getDailyClaimAmount(tier: UserSubTier): number {
  if (tier === 'MAX_PRO') return DAILY_CLAIM_MAX_PRO;
  if (tier === 'PRO') return DAILY_CLAIM_PRO;
  return 0;
}

/** Returns total unclaimed coins stacked across all days */
export function getUnclaimedCoins(data: RoutineData, tier: UserSubTier): number {
  if (tier === 'NONE') return 0;
  const today = getTodayStr();
  return Object.values(data.dailyClaims)
    .filter(e => !e.claimed && e.date <= today)
    .reduce((sum, e) => sum + e.amount, 0);
}

/** Generate today's pending claim entry if it doesn't exist (for active subscribers) */
export function ensureTodayClaimEntry(data: RoutineData, tier: UserSubTier): RoutineData {
  if (tier === 'NONE') return data;
  const today = getTodayStr();
  if (data.dailyClaims[today]) return data;
  const amount = getDailyClaimAmount(tier);
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
  if (tier === 'MAX_PRO') return 4;
  if (tier === 'PRO') return 3;
  return 2;
}

export function getTierSlotCost(tier: UserSubTier): number {
  if (tier === 'MAX_PRO') return 500;
  if (tier === 'PRO') return 250;
  return 100;
}

export function getActualMaxSlots(tier: UserSubTier, level: number, data: RoutineData): number {
  let max = getBaseSlotCount(tier);
  if (data.unlockedTierSlot) max++;
  if (level >= 5) max++;   // auto-unlocks at Level 5 achievement
  if (level >= 8) max++;   // auto-unlocks at Level 8 achievement
  return max;
}
