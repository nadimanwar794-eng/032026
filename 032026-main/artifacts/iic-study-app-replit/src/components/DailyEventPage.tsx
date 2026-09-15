// @ts-nocheck
/**
 * DailyEventPage — Unified daily study hub
 * Shows: Routine · Revision Hub · My Mistakes · Lesson Tracker
 */
import { toast } from 'sonner';
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, BrainCircuit, CalendarCheck,
  Clock, Target, ChevronRight, Zap, CheckCircle, Lock, Rocket,
  Search, Filter, X, ChevronDown, ChevronUp, Layers, ListFilter, Sparkles, Check
} from 'lucide-react';
import { loadRoutineData, getUserSubTier, getDailyClaimAmount } from '../utils/routineStorage';
import { getLevelInfo } from '../utils/levelSystem';
import { getDueItems, getAllBuckets, bucketKey, markNotesReviewed, type WeakBucket } from '../utils/revisionTrackerV2';
import { TodayAllNotesModal } from './TodayAllNotesModal';
import { TodayMcqSession } from './TodayMcqSession';
import type { TopicItem } from '../types';
import { getMistakeBankSync } from '../utils/mistakeBank';
import { getAutoTrackSnapshot, getLessonStats, isLessonRewarded, calculatePageRequiredReadingSec } from '../utils/routineAutoTrack';
import { RoutineRevisionBadge } from './RoutineRevisionBadge';
import { getMistakeSessions } from '../utils/mistakeAnalytics';
import { tryEarnScore, getDailyScoreEarned } from '../utils/scoreSystem';
import type { User, SystemSettings, Challenge20 } from '../types';
import type { MistakeEntry } from '../utils/mistakeBank';
import { getChallengeDateKey, isDailyChallenge20 } from '../utils/challengeGenerator';

// ── 3-Tier Hierarchy Data Models for Revision ──────────────────────────────────
export interface ChapterGroup {
  chapterId: string;
  chapterTitle: string;
  subjectId: string;
  subjectName: string;
  buckets: WeakBucket[];
  dueNotes: WeakBucket[];
  dueMcq: WeakBucket[];
  totalTopicsCount: number;
  completedTopicsCount: number;
}

export interface SubjectGroup {
  subjectId: string;
  subjectName: string;
  icon: string;
  chapters: ChapterGroup[];
  totalDue: number;
  notesCount: number;
  mcqCount: number;
  dueNotes: WeakBucket[];
  dueMcq: WeakBucket[];
  weakCount: number;
  avgCount: number;
  routineCount: number;
}

function getSubjectIcon(name: string): string {
  const s = (name || '').toLowerCase();
  if (s.includes('physic') || s.includes('bhautik')) return '⚛️';
  if (s.includes('chem') || s.includes('rasayan')) return '🧪';
  if (s.includes('bio') || s.includes('jeev')) return '🧬';
  if (s.includes('math') || s.includes('ganit')) return '📐';
  if (s.includes('hist') || s.includes('itihaas')) return '📜';
  if (s.includes('geo') || s.includes('bhugol')) return '🌍';
  if (s.includes('pol') || s.includes('civic') || s.includes('rajniti') || s.includes('samvidhan')) return '⚖️';
  if (s.includes('eco') || s.includes('arthashastra')) return '📊';
  if (s.includes('eng')) return '📚';
  if (s.includes('hind')) return '📖';
  return '📘';
}

function groupBySubjectChapter(items: WeakBucket[], allTracked: WeakBucket[] = []): SubjectGroup[] {
  const map: Record<string, SubjectGroup> = {};

  const chapterTotalMap: Record<string, { total: number; done: number }> = {};
  for (const b of allTracked) {
    const k = `${b.subjectId}::${b.chapterId}`;
    if (!chapterTotalMap[k]) chapterTotalMap[k] = { total: 0, done: 0 };
    chapterTotalMap[k].total += 1;
    if (b.lastTier === 'mastered' || b.lastTier === 'strong') {
      chapterTotalMap[k].done += 1;
    }
  }

  for (const b of items) {
    const sid = b.subjectId || 'general';
    const sname = b.subjectName || sid;
    if (!map[sid]) {
      map[sid] = {
        subjectId: sid,
        subjectName: sname,
        icon: getSubjectIcon(sname),
        chapters: [],
        totalDue: 0,
        notesCount: 0,
        mcqCount: 0,
        dueNotes: [],
        dueMcq: [],
        weakCount: 0,
        avgCount: 0,
        routineCount: 0,
      };
    }
    const sg = map[sid];
    sg.totalDue += 1;
    const isNotes = !b.stage || b.stage === 'NOTES';
    if (isNotes) {
      sg.notesCount += 1;
      sg.dueNotes.push(b);
    } else {
      sg.mcqCount += 1;
      sg.dueMcq.push(b);
    }

    const hasWrong = (b.wrongQuestions && b.wrongQuestions.length > 0);
    const isWeak = hasWrong || b.stage === 'RETRY' || (b.score !== undefined && b.score < 50);
    const isAvg = !isWeak && ((b.score !== undefined && b.score < 80) || b.stage === 'STAGE_2');
    if (isWeak) sg.weakCount += 1;
    else if (isAvg) sg.avgCount += 1;
    else sg.routineCount += 1;

    let cg = sg.chapters.find(c => c.chapterId === b.chapterId);
    if (!cg) {
      const stats = chapterTotalMap[`${b.subjectId}::${b.chapterId}`] || { total: 0, done: 0 };
      cg = {
        chapterId: b.chapterId,
        chapterTitle: b.chapterTitle || b.chapterId,
        subjectId: sid,
        subjectName: sname,
        buckets: [],
        dueNotes: [],
        dueMcq: [],
        totalTopicsCount: stats.total,
        completedTopicsCount: stats.done,
      };
      sg.chapters.push(cg);
    }
    cg.buckets.push(b);
    if (isNotes) cg.dueNotes.push(b); else cg.dueMcq.push(b);
  }

  return Object.values(map);
}

interface Props {
  user: User;
  settings?: SystemSettings;
  onBack: () => void;
  onOpenRoutine: () => void;
  onOpenRevisionHub: (lessonId?: string, lessonTitle?: string, autoStartMcq?: boolean) => void;
  onPracticeMistakes: (mistakes: MistakeEntry[]) => void;
  onOpenSubjects?: () => void;
  onOpenTracking?: () => void;
  onOpenLesson?: (lessonId: string) => void;
  onUpdateUser?: (u: User) => void;
  challenge20s?: Challenge20[];
  onStartChallenge20?: (challenge: Challenge20) => void;
  onClaimChallenge20?: (challenge: Challenge20) => void | Promise<void>;
}

// ── Small reusable pieces ─────────────────────────────────────────────────────

const SectionCard: React.FC<{
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ emoji, title, subtitle, accent, children, actionLabel, onAction }) => (
  <div className="bg-[#f5f2eb] rounded-3xl border border-[#e8e4db] shadow-sm overflow-hidden">
    <div className="px-4 pt-4 pb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: `${accent}18` }}
        >
          {emoji}
        </div>
        <div>
          <p className="font-black text-[#20313f] text-sm leading-tight">{title}</p>
          <p className="text-[10px] text-slate-500 font-medium leading-snug">{subtitle}</p>
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black text-white active:scale-95 transition-all shrink-0"
          style={{ background: accent }}
        >
          {actionLabel} <ChevronRight size={11} />
        </button>
      )}
    </div>
    <div className="px-4 py-3">{children}</div>
  </div>
);

const Stat: React.FC<{ label: string; value: number | string; color: string }> = ({ label, value, color }) => (
  <div className="flex flex-col items-center flex-1 bg-slate-50 rounded-xl px-2 py-2">
    <p className="text-xl font-black leading-tight" style={{ color }}>{value}</p>
    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 text-center leading-tight">{label}</p>
  </div>
);

const TaskRow: React.FC<{ emoji: string; title: string; sub: string; done: boolean }> = ({ emoji, title, sub, done }) => (
  <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${done ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
    <span className="text-base shrink-0">{done ? '✅' : emoji}</span>
    <div className="flex-1 min-w-0">
      <p className={`text-[11px] font-black truncate ${done ? 'text-emerald-700' : 'text-slate-800'}`}>{title}</p>
      <p className="text-[9px] text-slate-400 leading-tight">{sub}{done ? ' · Done ✓' : ''}</p>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const DailyEventPage: React.FC<Props> = ({
  user, settings, onBack, onOpenRoutine, onOpenRevisionHub, onPracticeMistakes, onOpenSubjects, onOpenTracking, onOpenLesson,
  onUpdateUser, challenge20s = [], onStartChallenge20, onClaimChallenge20,
}) => {
  const todayStr = getChallengeDateKey();
  const yesterdayStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return getChallengeDateKey(d);
  }, []);
  const lucentNotes = useMemo(() => (settings?.lucentNotes || []) as any[], [settings]);

  // ── Level / coin-per-task ────────────────────────────────────────────────
  const subTier = useMemo(() => getUserSubTier(user as any), [user]);
  const dailyAmount = useMemo(() => getDailyClaimAmount(subTier), [subTier]);
  const levelInfo = useMemo(() => getLevelInfo(user.totalScore || 0), [user.totalScore]);

  // ── Claim Success Overlay ────────────────────────────────────────────────
  const [claimOverlay, setClaimOverlay] = useState<{ ptsAdded: number; todayTotal: number; xpBefore: number; xpAfter: number } | null>(null);
  const [showAllNotesModal, setShowAllNotesModal] = useState(false);
  const [revMcqSessionActive, setRevMcqSessionActive] = useState(false);
  const [revMcqTopics, setRevMcqTopics] = useState<TopicItem[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [challengeTick, setChallengeTick] = useState(0);
  const [claimingChallengeId, setClaimingChallengeId] = useState<string | null>(null);

  // 3-Tier Hierarchy & Subject-Wise state for Revision Hub
  const [selectedRevisionSubjectId, setSelectedRevisionSubjectId] = useState<string>('ALL');
  const [revisionSearchQuery, setRevisionSearchQuery] = useState('');
  const [revisionViewMode, setRevisionViewMode] = useState<'SUBJECT' | 'HIERARCHY' | 'FOCUS' | 'LIST'>('SUBJECT');
  const [expandedRevisionSubs, setExpandedRevisionSubs] = useState<Record<string, boolean>>({});
  const [expandedRevisionChapters, setExpandedRevisionChapters] = useState<Record<string, boolean>>({});
  const [selectedModalNotes, setSelectedModalNotes] = useState<WeakBucket[] | null>(null);

  const reloadRevision = useCallback(() => setRefreshTick(t => t + 1), []);

  useEffect(() => {
    const handler = () => setChallengeTick(t => t + 1);
    window.addEventListener('iic-test-completed', handler);
    return () => window.removeEventListener('iic-test-completed', handler);
  }, []);

  useEffect(() => {
    const onRevisionUpdated = () => setRefreshTick(t => t + 1);
    window.addEventListener('iic-revision-updated', onRevisionUpdated);
    window.addEventListener('iic-revision-tracker-hydrated', onRevisionUpdated);
    return () => {
      window.removeEventListener('iic-revision-updated', onRevisionUpdated);
      window.removeEventListener('iic-revision-tracker-hydrated', onRevisionUpdated);
    };
  }, []);

  const dailyChallengeStatuses = useMemo(() => {
    let attempts: Record<string, any> = {};
    try {
      attempts = JSON.parse(localStorage.getItem(`nst_test_attempts_${user.id}`) || '{}');
    } catch {}

    const statuses = new Map<string, { completed: boolean; claimed: boolean }>();
    challenge20s
      .filter(challenge => isDailyChallenge20(challenge))
      .forEach(challenge => {
        const attempt = attempts[challenge.id];
        const completed = attempt?.isCompleted === true ||
          (Boolean(attempt?.submittedAt) && Boolean(attempt?.answers));
        // The date-based key was used by the old auto-award flow. Treat it as
        // claimed for existing users, while new claims use the challenge id so
        // each published challenge is independently idempotent.
        const legacyClaimKey = `nst_daily_challenge_20_xp_${user.id}_${todayStr}`;
        const claimKey = `nst_daily_challenge_20_xp_claimed_${user.id}_${challenge.id}`;
        const claimed = localStorage.getItem(claimKey) === '1' ||
          localStorage.getItem(legacyClaimKey) === '1';
        statuses.set(challenge.id, { completed, claimed });
      });
    return statuses;
  }, [challenge20s, user.id, challengeTick]);

  const dailyChallenges = useMemo(
    () => challenge20s.filter(challenge => isDailyChallenge20(challenge)),
    [challenge20s],
  );

  const handleChallengeClaim = useCallback(async (challenge: Challenge20) => {
    if (!onClaimChallenge20 || claimingChallengeId) return;
    setClaimingChallengeId(challenge.id);
    try {
      // The claim callback writes the idempotency key before its async save.
      // Refresh immediately so a slow Firebase response cannot make the
      // button look like it did nothing.
      const claimPromise = onClaimChallenge20(challenge);
      setChallengeTick(t => t + 1);
      await claimPromise;
    } finally {
      setClaimingChallengeId(null);
    }
  }, [claimingChallengeId, onClaimChallenge20]);

  const showClaimOverlay = useCallback((ptsAdded: number) => {
    const todayTotal = getDailyScoreEarned(user.id);
    const xpBefore = user.totalScore || 0;
    const xpAfter = xpBefore + ptsAdded;
    setClaimOverlay({ ptsAdded, todayTotal, xpBefore, xpAfter });
    setTimeout(() => setClaimOverlay(null), 2800);
  }, [user.id, user.totalScore]);

  // ── Mistake Milestone (100 pts per 100 mistakes) ─────────────────────────
  const MILESTONE_KEY = `iic_mistake_milestone_claimed_${user.id}`;
  const MILESTONE_PTS = 100; // 100 pts per 100 mistakes milestone
  const MILESTONE_EVERY = 100;

  const [claimedMilestones, setClaimedMilestones] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(MILESTONE_KEY) || '0', 10) || 0; } catch { return 0; }
  });
  const [claimSuccess, setClaimSuccess] = useState(false);

  // ── Task Completion Reward (25 pts per lesson: Notes me bhi aur MCQ me bhi) ──
  const LESSON_NOTES_PTS = 25;
  const LESSON_MCQ_PTS = 25;
  const TASK_PTS = 50; // Total 50 pts per lesson (25 Notes + 25 MCQ)
  const TASK_CLAIMED_KEY = `iic_task_pts_claimed_${user.id}_${todayStr}`;
  const TASK_NOTES_CLAIMED_KEY = `iic_task_notes_pts_claimed_${user.id}_${todayStr}`;
  const TASK_MCQ_CLAIMED_KEY = `iic_task_mcq_pts_claimed_${user.id}_${todayStr}`;

  const [claimedNotesTasks, setClaimedNotesTasks] = useState<Set<string>>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(TASK_NOTES_CLAIMED_KEY) || '[]') as string[];
      const legacy = JSON.parse(localStorage.getItem(TASK_CLAIMED_KEY) || '[]') as string[];
      return new Set([...arr, ...legacy]);
    } catch { return new Set(); }
  });

  const [claimedMcqTasks, setClaimedMcqTasks] = useState<Set<string>>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(TASK_MCQ_CLAIMED_KEY) || '[]') as string[];
      const legacy = JSON.parse(localStorage.getItem(TASK_CLAIMED_KEY) || '[]') as string[];
      return new Set([...arr, ...legacy]);
    } catch { return new Set(); }
  });

  const [lastClaimedNotesTask, setLastClaimedNotesTask] = useState<string | null>(null);
  const [lastClaimedMcqTask, setLastClaimedMcqTask] = useState<string | null>(null);

  const handleClaimNotesPts = useCallback((lessonId: string, lessonTitle?: string) => {
    try {
      const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
      const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
      const earned = tryEarnScore(user.id, LESSON_NOTES_PTS, tier, isPrem, 0, 'DAILY_TASK_NOTES_COMPLETE', undefined, undefined, `Notes Read: ${lessonTitle || lessonId}`);
      const next = new Set(claimedNotesTasks).add(lessonId);
      localStorage.setItem(TASK_NOTES_CLAIMED_KEY, JSON.stringify([...next]));
      setClaimedNotesTasks(next);
      setLastClaimedNotesTask(lessonId);
      setTimeout(() => setLastClaimedNotesTask(null), 2500);
      showClaimOverlay(earned);
    } catch (e) { console.error('Notes pts claim failed', e); }
  }, [user.id, user.subscriptionLevel, user.subscriptionTier, user.isPremium, claimedNotesTasks, TASK_NOTES_CLAIMED_KEY, showClaimOverlay]);

  const handleClaimMcqPts = useCallback((lessonId: string, lessonTitle?: string) => {
    try {
      const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
      const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
      const earned = tryEarnScore(user.id, LESSON_MCQ_PTS, tier, isPrem, 0, 'DAILY_TASK_MCQ_COMPLETE', undefined, undefined, `MCQ Complete: ${lessonTitle || lessonId}`);
      const next = new Set(claimedMcqTasks).add(lessonId);
      localStorage.setItem(TASK_MCQ_CLAIMED_KEY, JSON.stringify([...next]));
      setClaimedMcqTasks(next);
      setLastClaimedMcqTask(lessonId);
      setTimeout(() => setLastClaimedMcqTask(null), 2500);
      showClaimOverlay(earned);
    } catch (e) { console.error('MCQ pts claim failed', e); }
  }, [user.id, user.subscriptionLevel, user.subscriptionTier, user.isPremium, claimedMcqTasks, TASK_MCQ_CLAIMED_KEY, showClaimOverlay]);

  const handleClaimTaskPts = useCallback((lessonId: string, lessonTitle?: string) => {
    if (!claimedNotesTasks.has(lessonId)) handleClaimNotesPts(lessonId, lessonTitle);
    if (!claimedMcqTasks.has(lessonId)) handleClaimMcqPts(lessonId, lessonTitle);
  }, [claimedNotesTasks, claimedMcqTasks, handleClaimNotesPts, handleClaimMcqPts]);

  // ── Routine ───────────────────────────────────────────────────────────────
  const routineData = useMemo(() => {
    try { return loadRoutineData(user.id); } catch { return null; }
  }, [user.id]);

  const routineEnabled = routineData?.enabled ?? false;

  // Build today's lesson list from routineCategories (primary system)
  const todaySlots = useMemo(() => {
    const cats = (routineData?.routineCategories || []) as any[];
    if (!cats.length) return [];
    return cats.map((cat: any) => {
      const subjects: any[] = cat.subjects || [];
      if (!subjects.length) return null;
      const si = (cat.currentSubjectIndex || 0) % subjects.length;
      const sub = subjects[si];
      // Find notes for this subject (same filter as MyRoutine's getNotesForSubject)
      const notes = lucentNotes.filter((n: any) => {
        const nb = (n.bookName || '').trim();
        const nc = n.classLevel || '';
        const ns = (n.subject || 'other').toLowerCase().trim();
        if (sub.bookName && nb !== sub.bookName) return false;
        if (sub.classLevel && nc !== sub.classLevel) return false;
        return ns === sub.subjectId;
      });
      if (!notes.length) return null;
      const li = (sub.currentLessonIndex || 0) % notes.length;
      const lesson = notes[li] as any;
      const pageCount = lesson?.pages?.length || 0;
      const stats = getLessonStats(lesson.id, pageCount);
      const readingDone = pageCount > 0 && stats.pagesRead >= pageCount;
      // MCQ done = har page ka pageMcqDone set ho (same logic as My Routine's per-page green boxes)
      const snap = getAutoTrackSnapshot();
      const mcqDoneCount = pageCount > 0
        ? Array.from({ length: pageCount }, (_, i) => snap.pageMcqDone[`${lesson.id}__${i}`]).filter(Boolean).length
        : 0;
      const mcqDone = pageCount > 0 && mcqDoneCount >= pageCount;
      const done = readingDone && mcqDone;

      // Extract required reading time for the active/next page based on real content
      const nextPageIdx = Math.min(stats.pagesRead, pageCount - 1);
      const activePage = lesson?.pages?.[nextPageIdx];
      const reqSec = calculatePageRequiredReadingSec(activePage);

      // Get elapsed reading time (if any)
      const storedTime = Math.round(Number(localStorage.getItem(`iic_routine_page_time_${lesson.id}_${nextPageIdx}`)) || 0);

      return {
        catName: cat.categoryName || cat.emoji || 'Slot',
        emoji: cat.emoji || '📚',
        lessonId: lesson.id,
        lessonTitle: lesson.lessonTitle || lesson.id,
        subject: lesson.subject || sub.subjectId,
        done,
        readingDone,
        mcqDone,
        mcqDoneCount,
        pct: stats.pct,
        pagesRead: stats.pagesRead,
        totalPages: pageCount,
        reqSec,
        storedTime,
      };
    }).filter(Boolean);
  }, [routineData, lucentNotes]);

  const tasksDone  = todaySlots.filter((s: any) => s.done).length;
  const tasksTotal = todaySlots.length;
  // Coin-per-task: daily claim divided evenly across tasks (shown on reward buttons)
  const coinPerTask = tasksTotal > 0 && routineEnabled && dailyAmount > 0
    ? Math.ceil(dailyAmount / tasksTotal) : 0;

  // ── Daily done slot persistence (save today's done lessons for tomorrow's history) ──
  const DAILY_DONE_KEY = useCallback((date: string) => `iic_routine_daily_${user.id}_${date}`, [user.id]);

  useEffect(() => {
    const done = (todaySlots as any[]).filter((s: any) => s.done).map((s: any) => ({
      lessonId: s.lessonId,
      lessonTitle: s.lessonTitle,
      subject: s.subject,
      catName: s.catName,
      emoji: s.emoji,
    }));
    if (done.length > 0) {
      try { localStorage.setItem(DAILY_DONE_KEY(todayStr), JSON.stringify(done)); } catch {}
    }
  }, [todaySlots, todayStr, DAILY_DONE_KEY]);

  // ── Yesterday's completed routine lessons (for History + Revision Hub) ────
  const yesterdayDoneSlots = useMemo<Array<{ lessonId: string; lessonTitle: string; subject: string; catName: string; emoji: string }>>(() => {
    try { return JSON.parse(localStorage.getItem(DAILY_DONE_KEY(yesterdayStr)) || '[]'); } catch { return []; }
  }, [yesterdayStr, DAILY_DONE_KEY]);

  // ── Next Today Task — next lesson preview for each category ───────────────
  const nextSlots = useMemo(() => {
    const cats = (routineData?.routineCategories || []) as any[];
    if (!cats.length) return [];
    return cats.map((cat: any) => {
      const subjects: any[] = cat.subjects || [];
      if (!subjects.length) return null;
      const si = (cat.currentSubjectIndex || 0) % subjects.length;
      const sub = subjects[si];
      const notes = lucentNotes.filter((n: any) => {
        const nb = (n.bookName || '').trim();
        const nc = n.classLevel || '';
        const ns = (n.subject || 'other').toLowerCase().trim();
        if (sub.bookName && nb !== sub.bookName) return false;
        if (sub.classLevel && nc !== sub.classLevel) return false;
        return ns === sub.subjectId;
      });
      if (notes.length <= 1) return null;
      const currentLi = (sub.currentLessonIndex || 0) % notes.length;
      const nextLi = (currentLi + 1) % notes.length;
      if (nextLi === currentLi) return null;
      const nextLesson = notes[nextLi] as any;
      return {
        catName: cat.categoryName || cat.emoji || 'Slot',
        emoji: cat.emoji || '📚',
        lessonTitle: nextLesson.lessonTitle || nextLesson.id,
        subject: nextLesson.subject || sub.subjectId,
      };
    }).filter(Boolean);
  }, [routineData, lucentNotes]);

  // ── Revision Hub ─────────────────────────────────────────────────────────
  const dueItems = useMemo(() => {
    try { return getDueItems(); } catch { return []; }
  }, [refreshTick]);
  const dueNotes = dueItems.filter((b: any) => !b.stage || b.stage === 'NOTES');
  const dueMcq   = dueItems.filter((b: any) => b.stage === 'MCQ');

  const allTrackedBuckets = useMemo(() => {
    try { return getAllBuckets(); } catch { return []; }
  }, [refreshTick]);

  const subjectGroups = useMemo(() => {
    return groupBySubjectChapter(dueItems, allTrackedBuckets);
  }, [dueItems, allTrackedBuckets]);

  const filteredSubjectGroups = useMemo(() => {
    let list = subjectGroups;
    if (selectedRevisionSubjectId !== 'ALL') {
      list = list.filter(sg => sg.subjectId === selectedRevisionSubjectId);
    }
    const q = revisionSearchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.map(sg => {
      const filteredChapters = sg.chapters.map(cg => {
        const chapterMatches = (cg.chapterTitle || '').toLowerCase().includes(q) || (cg.subjectName || '').toLowerCase().includes(q);
        const filteredBuckets = cg.buckets.filter(b => 
          (b.topic || '').toLowerCase().includes(q) || 
          (b.chapterTitle || '').toLowerCase().includes(q) || 
          (b.subjectName || '').toLowerCase().includes(q)
        );
        if (chapterMatches) return cg;
        if (filteredBuckets.length > 0) {
          return {
            ...cg,
            buckets: filteredBuckets,
            dueNotes: filteredBuckets.filter(b => !b.stage || b.stage === 'NOTES'),
            dueMcq: filteredBuckets.filter(b => b.stage === 'MCQ'),
          };
        }
        return null;
      }).filter(Boolean) as ChapterGroup[];

      if (filteredChapters.length === 0) return null;
      return {
        ...sg,
        chapters: filteredChapters,
        totalDue: filteredChapters.reduce((acc, c) => acc + c.buckets.length, 0),
        notesCount: filteredChapters.reduce((acc, c) => acc + c.dueNotes.length, 0),
        mcqCount: filteredChapters.reduce((acc, c) => acc + c.dueMcq.length, 0),
      };
    }).filter(Boolean) as SubjectGroup[];
  }, [subjectGroups, selectedRevisionSubjectId, revisionSearchQuery]);

  const focus15Items = useMemo(() => {
    return [...dueItems]
      .sort((a, b) => {
        const wA = a.wrongQuestions?.length || 0;
        const wB = b.wrongQuestions?.length || 0;
        if (wA !== wB) return wB - wA;
        return (a.cycleCount || 0) - (b.cycleCount || 0);
      })
      .slice(0, 15);
  }, [dueItems]);

  const handleStartPractice = useCallback((topicsToPractice?: WeakBucket[]) => {
    const list = topicsToPractice || dueMcq;
    if (!list || list.length === 0) {
      toast.info("Koi MCQ practice questions baki nahi hain!");
      return;
    }
    const topics: TopicItem[] = list.map(b => ({
      id: `${b.chapterId}_${b.topic}`,
      chapterId: b.chapterId,
      chapterName: b.chapterTitle || b.chapterId,
      name: b.topic,
      score: 0,
      lastAttempt: '',
      status: 'WEAK' as any,
      nextRevision: null,
      mcqDueDate: null,
      subjectId: b.subjectId,
      subjectName: b.subjectName,
      isSubTopic: true,
    }));
    setRevMcqTopics(topics);
    setRevMcqSessionActive(true);
  }, [dueMcq]);

  const handleOpenNotes = useCallback((notesList?: WeakBucket[]) => {
    setSelectedModalNotes(notesList || dueNotes);
    setShowAllNotesModal(true);
  }, [dueNotes]);

  const handlePracticeSlotMcq = useCallback((slot: any) => {
    const lesson = lucentNotes.find((n: any) => n.id === slot.lessonId);
    const pages = lesson?.pages || [];
    if (pages.length > 0) {
      const topics: TopicItem[] = pages.map((p: any, idx: number) => ({
        id: `${slot.lessonId}_p${idx}`,
        chapterId: slot.lessonId,
        chapterName: slot.lessonTitle || slot.lessonId,
        name: p.topic || `Topic ${idx + 1}`,
        score: 0,
        lastAttempt: '',
        status: 'WEAK' as any,
        nextRevision: null,
        mcqDueDate: null,
        subjectId: slot.subject,
        subjectName: slot.subject,
        isSubTopic: true,
      }));
      setRevMcqTopics(topics);
      setRevMcqSessionActive(true);
    } else {
      onOpenLesson?.(slot.lessonId);
    }
  }, [lucentNotes, onOpenLesson]);

  // Detect how many Notes/MCQ were completed today using updatedAt timestamp
  const { notesReviewedToday, mcqDoneToday } = useMemo(() => {
    try {
      const midnight = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
      const all = getAllBuckets();
      // Notes reviewed today: stage moved to MCQ (notes were read → waiting for MCQ), updated today
      const notesReviewedToday = all.filter(
        (b) => b.stage === 'MCQ' && (b.updatedAt || 0) >= midnight
      ).length;
      // MCQ done today: stage moved back to NOTES (MCQ done → next cycle scheduled), cycleCount>0, updated today
      const mcqDoneToday = all.filter(
        (b) => b.stage === 'NOTES' && (b.cycleCount || 0) > 0 &&
          (b.updatedAt || 0) >= midnight && (b.nextDueAt || 0) > Date.now()
      ).length;
      return { notesReviewedToday, mcqDoneToday };
    } catch { return { notesReviewedToday: 0, mcqDoneToday: 0 }; }
  }, [refreshTick]);

  // Skipped / low-time pages from routine lesson progress
  const skippedPages = useMemo(() => {
    if (!routineData?.lessonProgress) return [];
    const pages: Array<{ lessonTitle: string; pageNum: number; timeSpent: number; isSkipped: boolean }> = [];
    for (const [lessonId, progress] of Object.entries(routineData.lessonProgress)) {
      const lesson = lucentNotes.find((n: any) => n.id === lessonId);
      const lessonTitle = (lesson as any)?.lessonTitle || lessonId;
      for (const [idxStr, pp] of Object.entries((progress as any).pages || {})) {
        const p = pp as any;
        if (!p.pageRead) {
          pages.push({ lessonTitle, pageNum: Number(idxStr) + 1, timeSpent: 0, isSkipped: true });
        } else if (typeof p.timeSpentSeconds === 'number' && p.timeSpentSeconds < 30) {
          pages.push({ lessonTitle, pageNum: Number(idxStr) + 1, timeSpent: p.timeSpentSeconds, isSkipped: false });
        }
      }
    }
    return pages.slice(0, 10);
  }, [routineData, lucentNotes]);

  // ── My Mistakes ───────────────────────────────────────────────────────────
  const allMistakes = useMemo(() => {
    try { return getMistakeBankSync(); } catch { return []; }
  }, []);
  const todayMistakes = useMemo(() => allMistakes.slice(0, 100), [allMistakes]);

  // Track how many mistakes were practiced today using session history
  const todayPracticed = useMemo(() => {
    try {
      const midnight = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
      const sessions = getMistakeSessions();
      return sessions
        .filter((s) => s.date >= midnight)
        .reduce((sum, s) => sum + (s.correct || 0), 0); // count only FIXED (correct) ones
    } catch { return 0; }
  }, []);

  // Total ever CREATED = high-water mark (only grows, never shrinks)
  // Fixes double-count: allMistakes.length is "remaining", not total ever made
  const TOTAL_EVER_KEY = `iic_mistake_total_ever_${user.id}`;
  const totalEver = useMemo(() => {
    try {
      const stored = parseInt(localStorage.getItem(TOTAL_EVER_KEY) || '0', 10) || 0;
      // High-water mark: if bank currently has more than stored, update
      const hwm = Math.max(stored, allMistakes.length);
      if (hwm > stored) {
        try { localStorage.setItem(TOTAL_EVER_KEY, String(hwm)); } catch {}
      }
      return hwm;
    } catch { return allMistakes.length; }
  }, [allMistakes.length, TOTAL_EVER_KEY]);

  const remainingMistakes = allMistakes.length;

  // Milestone based on total ever created (not just current remaining)
  const availableMilestones = Math.floor(totalEver / MILESTONE_EVERY);
  const unclaimedMilestones = Math.max(0, availableMilestones - claimedMilestones);

  // ── Mistake Session Reward (claim once per day when todayPracticed > 0) ──
  const MISTAKE_SESSION_CLAIMED_KEY = `iic_mistake_session_pts_claimed_${user.id}_${new Date().toISOString().split('T')[0]}`;
  const MISTAKE_SESSION_PTS = 100;
  const [mistakeSessionClaimed, setMistakeSessionClaimed] = useState<boolean>(() => {
    try { return localStorage.getItem(MISTAKE_SESSION_CLAIMED_KEY) === '1'; } catch { return false; }
  });
  const handleClaimMistakeSession = useCallback(() => {
    try {
      const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
      const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
      const earned = tryEarnScore(user.id, MISTAKE_SESSION_PTS, tier, isPrem, 0, 'MISTAKE_SESSION_COMPLETE', undefined, undefined, 'Mistake Practice Session Complete');
      localStorage.setItem(MISTAKE_SESSION_CLAIMED_KEY, '1');
      setMistakeSessionClaimed(true);
      showClaimOverlay(earned);
    } catch (e) { console.error('Mistake session pts claim failed', e); }
  }, [user.id, user.subscriptionLevel, user.subscriptionTier, user.isPremium, MISTAKE_SESSION_CLAIMED_KEY, showClaimOverlay]);

  // ── Lesson Tracker 1hr Reward ─────────────────────────────────────────────
  const LESSON_1HR_CLAIMED_KEY = `iic_lesson_1hr_pts_claimed_${user.id}_${new Date().toISOString().split('T')[0]}`;
  const LESSON_1HR_PTS = 100;
  const [claimed1hrLessons, setClaimed1hrLessons] = useState<Set<string>>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(LESSON_1HR_CLAIMED_KEY) || '[]') as string[];
      return new Set(arr);
    } catch { return new Set(); }
  });
  const handleClaim1hrLesson = useCallback((lessonTitle: string) => {
    try {
      const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
      const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
      const earned = tryEarnScore(user.id, LESSON_1HR_PTS, tier, isPrem, 0, 'LESSON_1HR_COMPLETE', undefined, undefined, `1 Hour Study: ${lessonTitle}`);
      const next = new Set(claimed1hrLessons).add(lessonTitle);
      localStorage.setItem(LESSON_1HR_CLAIMED_KEY, JSON.stringify([...next]));
      setClaimed1hrLessons(next);
      showClaimOverlay(earned);
    } catch (e) { console.error('1hr lesson pts claim failed', e); }
  }, [user.id, user.subscriptionLevel, user.subscriptionTier, user.isPremium, LESSON_1HR_CLAIMED_KEY, claimed1hrLessons, showClaimOverlay]);

  const handleClaimMilestone = useCallback(() => {
    try {
      const totalPts = MILESTONE_PTS * unclaimedMilestones;
      const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
      const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
      const earned = tryEarnScore(user.id, totalPts, tier, isPrem, 0, 'MISTAKE_MILESTONE', undefined, undefined, `Mistake Bank ${claimedMilestones + 1}×100 milestone`);
      const newClaimed = claimedMilestones + unclaimedMilestones;
      localStorage.setItem(MILESTONE_KEY, String(newClaimed));
      setClaimedMilestones(newClaimed);
      setClaimSuccess(true);
      setTimeout(() => setClaimSuccess(false), 3000);
      showClaimOverlay(earned);
    } catch (e) { console.error('Milestone claim failed', e); }
  }, [user.id, user.subscriptionLevel, user.subscriptionTier, user.isPremium, claimedMilestones, unclaimedMilestones, MILESTONE_KEY, showClaimOverlay]);

  // ── Revision Hub 25 pts Claim per lesson ──────────────────────────────────
  const REV_NOTES_CLAIMED_KEY = `iic_rev_notes_pts_claimed_cnt_${user.id}_${todayStr}`;
  const REV_MCQ_CLAIMED_KEY   = `iic_rev_mcq_pts_claimed_cnt_${user.id}_${todayStr}`;
  const REV_PTS = 25; // 25 pts har lesson ke liye (Notes me bhi aur MCQ me bhi)

  const [claimedRevNotesCount, setClaimedRevNotesCount] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(REV_NOTES_CLAIMED_KEY) || '0', 10) || 0; } catch { return 0; }
  });
  const [claimedRevMcqCount, setClaimedRevMcqCount] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(REV_MCQ_CLAIMED_KEY) || '0', 10) || 0; } catch { return 0; }
  });

  const unclaimedRevNotes = Math.max(0, notesReviewedToday - claimedRevNotesCount);
  const unclaimedRevMcq = Math.max(0, mcqDoneToday - claimedRevMcqCount);

  const handleClaimRevisionPts = useCallback((type: 'notes' | 'mcq') => {
    try {
      const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
      const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
      const countToClaim = type === 'notes' ? Math.max(1, unclaimedRevNotes) : Math.max(1, unclaimedRevMcq);
      const ptsToEarn = countToClaim * REV_PTS;
      const label = type === 'notes'
        ? `Revision Hub Notes (${countToClaim} lesson${countToClaim > 1 ? 's' : ''} complete)`
        : `Revision Hub MCQ (${countToClaim} lesson${countToClaim > 1 ? 's' : ''} complete)`;
      const activity = type === 'notes' ? 'REVISION_NOTES_COMPLETE' : 'REVISION_MCQ_COMPLETE';
      const earned = tryEarnScore(user.id, ptsToEarn, tier, isPrem, 0, activity, undefined, undefined, label);
      if (type === 'notes') {
        const nextCnt = Math.max(notesReviewedToday, claimedRevNotesCount + countToClaim);
        localStorage.setItem(REV_NOTES_CLAIMED_KEY, String(nextCnt));
        setClaimedRevNotesCount(nextCnt);
      } else {
        const nextCnt = Math.max(mcqDoneToday, claimedRevMcqCount + countToClaim);
        localStorage.setItem(REV_MCQ_CLAIMED_KEY, String(nextCnt));
        setClaimedRevMcqCount(nextCnt);
      }
      showClaimOverlay(earned);
    } catch (e) { console.error('Revision pts claim failed', e); }
  }, [user.id, user.subscriptionLevel, user.subscriptionTier, user.isPremium, unclaimedRevNotes, unclaimedRevMcq, notesReviewedToday, mcqDoneToday, claimedRevNotesCount, claimedRevMcqCount, REV_NOTES_CLAIMED_KEY, REV_MCQ_CLAIMED_KEY, showClaimOverlay]);

  // ── Lesson Tracker ────────────────────────────────────────────────────────
  // Primary source: routineAutoTrack timings (what actually tracks reading time)
  // Secondary: trackingHistory for today's lesson list (has date info)
  const todayHistory = useMemo(() => {
    // Collect lessonIds studied today from trackingHistory
    const historyLessons = new Map<string, { subjectId: string; mcqsDone: number }>();
    if (routineData?.trackingHistory) {
      (routineData.trackingHistory as any[])
        .filter((h) => h.date === todayStr)
        .forEach((h) => {
          if (!historyLessons.has(h.lessonId)) {
            historyLessons.set(h.lessonId, { subjectId: h.subjectId, mcqsDone: h.mcqsDone || 0 });
          } else {
            // accumulate mcqsDone if same lesson appears multiple times
            const prev = historyLessons.get(h.lessonId)!;
            historyLessons.set(h.lessonId, { ...prev, mcqsDone: prev.mcqsDone + (h.mcqsDone || 0) });
          }
        });
    }

    // Also scan routineAutoTrack for any lessons that have time recorded but
    // might not be in trackingHistory (e.g. lessons opened without routine)
    try {
      const snap = getAutoTrackSnapshot();
      Object.keys(snap.timings).forEach((key) => {
        const lessonId = key.split('__')[0];
        if (lessonId && !historyLessons.has(lessonId) && (snap.timings[key] || 0) > 0) {
          historyLessons.set(lessonId, { subjectId: '', mcqsDone: 0 });
        }
      });
    } catch { /* ignore */ }

    return Array.from(historyLessons.entries())
      .map(([lessonId, meta]) => {
        const lesson = lucentNotes.find((n: any) => n.id === lessonId);
        const pageCount = (lesson as any)?.pages?.length || 0;
        // Read real time from routineAutoTrack (the source of truth)
        const stats = getLessonStats(lessonId, pageCount);
        return {
          lessonTitle: (lesson as any)?.lessonTitle || lessonId,
          subject: (lesson as any)?.subject || meta.subjectId,
          pagesRead: stats.pagesRead,
          mcqsDone: meta.mcqsDone,
          totalTimeSec: stats.totalTime,
        };
      })
      // Only show lessons with any activity
      .filter((h) => h.pagesRead > 0 || h.totalTimeSec > 0 || h.mcqsDone > 0)
      .sort((a, b) => b.totalTimeSec - a.totalTimeSec);
  }, [routineData, todayStr, lucentNotes]);

  const formatTime = (secs: number) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  return (
    <div>

      <div className="px-4 pt-4 space-y-4 pb-6">

        {/* ── DAILY CHALLENGE 2.0 ─────────────────────────────────────────── */}
        {dailyChallenges.length > 0 && (
          <SectionCard
            emoji="🚀"
            title="Daily Challenge 2.0"
            subtitle="Aaj ka challenge complete karo aur +100 XP pao"
            accent="#7c3aed"
          >
            <div className="space-y-2.5">
              {dailyChallenges.map((challenge) => {
                const status = dailyChallengeStatuses.get(challenge.id) || { completed: false, claimed: false };
                const isClaiming = claimingChallengeId === challenge.id;
                return (
                <div key={challenge.id} className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-3.5">
                  <Rocket size={58} className="absolute -right-3 -top-3 text-violet-200 opacity-70" />
                  <div className="relative z-10">
                    <p className="text-[13px] font-black text-violet-900">{challenge.title}</p>
                    {challenge.description && (
                      <p className="mt-0.5 text-[10px] text-slate-500">{challenge.description}</p>
                    )}
                    <div className="mt-2.5 flex items-center gap-2 text-[10px] font-black text-slate-600">
                      <span className="rounded-full bg-white/80 px-2 py-1">{challenge.questions.length} Questions</span>
                      <span className="rounded-full bg-white/80 px-2 py-1">Max 60 min</span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">+100 XP</span>
                    </div>
                    {status.completed ? (
                      status.claimed ? (
                        <div className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-center text-xs font-black text-emerald-700">
                          ✅ +100 XP Claim Ho Gaya
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void handleChallengeClaim(challenge);
                          }}
                          disabled={!onClaimChallenge20 || isClaiming}
                          className="mt-3 w-full rounded-xl bg-amber-500 py-2.5 text-center text-xs font-black text-white shadow-md shadow-amber-200 transition-colors hover:bg-amber-600 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isClaiming ? 'Claim ho raha hai…' : '🎁 Claim +100 XP'}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => onStartChallenge20?.(challenge)}
                        disabled={!onStartChallenge20}
                        className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-center text-xs font-black text-white shadow-md shadow-violet-200 transition-colors hover:bg-violet-700 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Start Challenge
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* ── 1. ROUTINE ─────────────────────────────────────────────────── */}
        <SectionCard
          emoji="📅"
          title="My Routine"
          subtitle={
            routineEnabled
              ? tasksTotal > 0
                ? `${tasksDone}/${tasksTotal} lesson aaj ke`
                : 'Koi slot set nahi'
              : 'Routine enabled nahi hai'
          }
          accent="#4f46e5"
          actionLabel="Open →"
          onAction={onOpenRoutine}
        >
          {!routineEnabled ? (
            <p className="text-sm text-slate-400 text-center py-2">
              Routine shuru karo → My Routine → Enable
            </p>
          ) : tasksTotal === 0 ? (
            <p className="text-sm text-slate-400 text-center py-2">
              Koi slot set nahi. My Routine mein categories add karo.
            </p>
          ) : (
            <div className="space-y-2">
              {/* ── Next Today Task preview ── */}
              {nextSlots.length > 0 && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 mb-1">
                  <p className="text-[9px] font-black text-sky-600 uppercase tracking-widest mb-1.5">⏭️ Next Today Task</p>
                  <div className="space-y-1">
                    {(nextSlots as any[]).map((ns: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm shrink-0">{ns.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-sky-800 truncate">{ns.lessonTitle}</p>
                          <p className="text-[9px] text-sky-500">{ns.catName} · {ns.subject}</p>
                        </div>
                        <span className="text-[9px] font-black text-sky-400 shrink-0">Agle</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Today's tasks ── */}
              {(todaySlots as any[]).map((slot: any, i: number) => (
                <div
                  key={i}
                  className={`rounded-xl px-3 py-2.5 border ${slot.done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}
                >
                  {/* Title row */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base shrink-0">{slot.done ? '✅' : slot.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black truncate ${slot.done ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {slot.lessonTitle}
                      </p>
                      <p className="text-[9px] text-slate-400 leading-tight">{slot.catName} · {slot.subject}</p>
                    </div>
                  </div>

                  {/* Start Studying / Practice Buttons (Notes & MCQ) */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => onOpenLesson?.(slot.lessonId)}
                      className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow-sm ${
                        slot.readingDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-[#20313f] hover:bg-[#1a2834] text-white'
                      }`}
                    >
                      <BookOpen size={13} />
                      <span>{slot.readingDone ? '✓ Notes Done' : '📖 Notes Padhein'}</span>
                    </button>
                    <button
                      onClick={() => handlePracticeSlotMcq(slot)}
                      className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow-sm ${
                        slot.mcqDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-violet-600 hover:bg-violet-700 text-white'
                      }`}
                    >
                      <Target size={13} />
                      <span>{slot.mcqDone ? '✓ MCQ Done' : '🧠 Practice MCQ'}</span>
                    </button>
                  </div>

                  {/* Reading progress */}
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        📖 Reading
                        {slot.totalPages > 0 && ` ${slot.pagesRead}/${slot.totalPages} pages`}
                      </p>
                      {!slot.readingDone && slot.reqSec > 0 && (
                         <p className="text-[9px] text-slate-400 font-medium ml-1">
                           (~{slot.reqSec < 60 ? `${slot.reqSec}s` : `${Math.floor(slot.reqSec / 60)}m${slot.reqSec % 60 ? ` ${slot.reqSec % 60}s` : ''}`} per page)
                         </p>
                      )}
                      <p className={`text-[9px] font-black ${slot.readingDone ? 'text-emerald-600' : 'text-indigo-600'} ml-auto`}>
                        {slot.readingDone ? 'Done ✓' : `${slot.pct}%`}
                      </p>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full transition-all ${slot.readingDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${slot.pct}%` }}
                      />
                    </div>
                    {!slot.readingDone && slot.reqSec > 0 && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] font-medium text-slate-400">Current page progress</span>
                        <span className="text-[9px] font-bold text-slate-600">{Math.min(100, Math.round((slot.storedTime / slot.reqSec) * 100))}% ({Math.max(0, slot.reqSec - slot.storedTime)}s left)</span>
                      </div>
                    )}
                  </div>

                  {/* MCQ progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        🧠 MCQ
                        {slot.totalPages > 0 && ` ${slot.mcqDoneCount}/${slot.totalPages} pages`}
                      </p>
                      <p className={`text-[9px] font-black ${slot.mcqDone ? 'text-emerald-600' : 'text-orange-500'}`}>
                        {slot.mcqDone ? 'Done ✓' : `${slot.totalPages > 0 ? Math.round((slot.mcqDoneCount / slot.totalPages) * 100) : 0}%`}
                      </p>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${slot.mcqDone ? 'bg-emerald-500' : 'bg-orange-400'}`}
                        style={{ width: `${slot.totalPages > 0 ? Math.round((slot.mcqDoneCount / slot.totalPages) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* ── Per-Lesson Rewards (25 pts Notes + 25 pts MCQ) ── */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 space-y-1.5">
                    {/* Notes Claim Button / Status */}
                    {slot.readingDone ? (
                      claimedNotesTasks.has(slot.lessonId) ? (
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
                          <span className="text-[10px] font-black text-emerald-700 flex items-center gap-1">📖 Notes Completed</span>
                          <span className="text-[10px] font-black text-emerald-700">✅ +{LESSON_NOTES_PTS} pts Claimed</span>
                        </div>
                      ) : lastClaimedNotesTask === slot.lessonId ? (
                        <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300">
                          <span className="text-[11px] font-black text-emerald-700">✅ +{LESSON_NOTES_PTS} pts Notes Mil Gaye!</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaimNotesPts(slot.lessonId, slot.lessonTitle)}
                          className="w-full py-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-2 transition-all active:scale-95 bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-xs"
                        >
                          🎁 Claim +{LESSON_NOTES_PTS} ⭐pts (Notes Done)
                          {coinPerTask > 0 && (
                            <span className="text-[9px] bg-white/30 px-1.5 py-0.5 rounded-full font-black">
                              +{Math.ceil(coinPerTask / 2)} 🪙
                            </span>
                          )}
                        </button>
                      )
                    ) : null}

                    {/* MCQ Claim Button / Status */}
                    {slot.mcqDone ? (
                      claimedMcqTasks.has(slot.lessonId) ? (
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-violet-50 border border-violet-200">
                          <span className="text-[10px] font-black text-violet-700 flex items-center gap-1">🧠 MCQ Completed</span>
                          <span className="text-[10px] font-black text-violet-700">✅ +{LESSON_MCQ_PTS} pts Claimed</span>
                        </div>
                      ) : lastClaimedMcqTask === slot.lessonId ? (
                        <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300">
                          <span className="text-[11px] font-black text-emerald-700">✅ +{LESSON_MCQ_PTS} pts MCQ Mil Gaye!</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaimMcqPts(slot.lessonId, slot.lessonTitle)}
                          className="w-full py-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-2 transition-all active:scale-95 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                        >
                          🎁 Claim +{LESSON_MCQ_PTS} ⭐pts (MCQ Done)
                          {coinPerTask > 0 && (
                            <span className="text-[9px] bg-white/30 px-1.5 py-0.5 rounded-full font-black">
                              +{Math.floor(coinPerTask / 2)} 🪙
                            </span>
                          )}
                        </button>
                      )
                    ) : null}

                    {/* If neither notes nor mcq is done yet, show encouraging badge */}
                    {!slot.readingDone && !slot.mcqDone && (
                      <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-slate-100 text-[10px] text-slate-500 font-bold">
                        <span>🎯 Har Lesson Reward:</span>
                        <span className="text-slate-700 font-black">📖 +{LESSON_NOTES_PTS} pts Notes · 🧠 +{LESSON_MCQ_PTS} pts MCQ</span>
                      </div>
                    )}

                    {/* Motivating hints when one part is done */}
                    {slot.readingDone && !slot.mcqDone && (
                      <p className="text-[9px] text-slate-400 font-bold text-center">
                        🧠 MCQ practice karke +{LESSON_MCQ_PTS} pts aur paayein!
                      </p>
                    )}
                    {!slot.readingDone && slot.mcqDone && (
                      <p className="text-[9px] text-slate-400 font-bold text-center">
                        📖 Notes reading karke +{LESSON_NOTES_PTS} pts aur paayein!
                      </p>
                    )}
                  </div>

                  {/* ── Revision Hub button — locked until lesson is complete ── */}
                  {slot.done || isLessonRewarded(slot.lessonId) ? (
                    <RoutineRevisionBadge
                      lessonId={slot.lessonId}
                      lessonTitle={slot.lessonTitle}
                      onGoToRevision={(lessonId, lessonTitle) => onOpenRevisionHub(lessonId, lessonTitle)}
                    />
                  ) : (
                    <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock size={15} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-black text-slate-700">Revision Hub</p>
                          <Lock size={12} className="text-slate-400" />
                        </div>
                        <p className="text-[10px] font-black text-emerald-600 mt-0.5">
                          Unlock: 100 🪙 coins · Task complete pe 50% OFF → 50 🪙/session
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                          Lesson complete karo → revision unlock hoga
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 self-center" />
                    </div>
                  )}
                </div>
              ))}

              {/* ── History: Kal ke complete lessons ── */}
              {yesterdayDoneSlots.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    📜 Kal Complete Kiye ({yesterdayStr})
                  </p>
                  <div className="space-y-1.5">
                    {yesterdayDoneSlots.map((slot: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
                        <span className="text-base shrink-0">✅</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-indigo-700 truncate">{slot.lessonTitle}</p>
                          <p className="text-[9px] text-indigo-400 leading-tight">{slot.catName} · {slot.subject}</p>
                        </div>
                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-500 px-2 py-0.5 rounded-full shrink-0">Kal</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── 2. REVISION HUB ─────────────────────────────────────────────── */}
        <SectionCard
          emoji="🧠"
          title="Revision Hub"
          subtitle={(() => {
            const totalPending = dueNotes.length + dueMcq.length;
            const totalDone = notesReviewedToday + mcqDoneToday;
            if (totalPending === 0 && totalDone === 0 && skippedPages.length === 0)
              return '🎉 Aaj sab revision complete!';
            const parts = [];
            if (totalPending > 0) parts.push(`${totalPending} pending`);
            if (totalDone > 0) parts.push(`${totalDone} done ✓`);
            return parts.join(' · ') || 'Revision Hub';
          })()}
          accent="#8b5cf6"
          actionLabel="Practice"
          onAction={onOpenRevisionHub}
        >
          <div className="space-y-2">

            {/* ── Routine Revision: kal ke complete lessons, aaj revise karo ── */}
            {yesterdayDoneSlots.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-2">
                  📋 Routine Revision — Kal Se ({yesterdayStr})
                </p>
                <div className="space-y-1.5">
                  {yesterdayDoneSlots.map((slot: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-white border border-blue-100 rounded-xl px-2.5 py-2">
                      <span className="text-base shrink-0">{slot.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-blue-800 truncate">{slot.lessonTitle}</p>
                        <p className="text-[9px] text-blue-400 leading-tight">{slot.catName} · {slot.subject}</p>
                      </div>
                      <span className="text-[9px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full shrink-0">Revise →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* ── Status & Claim Cards (Notes & MCQ) ────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {/* Notes Card */}
              {(() => {
                const total = dueNotes.length + notesReviewedToday;
                const done = notesReviewedToday;
                const pct = total > 0 ? Math.round((done / total) * 100) : 100;
                const isDone = done === total && total > 0;
                return (
                  <div className={`rounded-2xl p-3 border ${isDone ? 'bg-emerald-50/80 border-emerald-200' : 'bg-white border-indigo-200'} shadow-sm flex flex-col justify-between`}>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {isDone ? '✅' : '📖'}
                          </div>
                          <div>
                            <p className="text-[12px] font-black text-slate-800">Reading Revision</p>
                            <p className="text-[9px] text-slate-500">
                              {total === 0 ? 'Aaj koi notes due nahi' : `${dueNotes.length} baki · ${done}/${total} complete`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {total === 0 ? 'Done' : `${pct}%`}
                        </span>
                      </div>
                      {total > 0 && (
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      {unclaimedRevNotes > 0 ? (
                        <button
                          onClick={() => handleClaimRevisionPts('notes')}
                          className="w-full py-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm"
                        >
                          🎁 Claim +{unclaimedRevNotes * REV_PTS}⭐ pts ({unclaimedRevNotes} Lesson{unclaimedRevNotes > 1 ? 's' : ''})
                        </button>
                      ) : claimedRevNotesCount > 0 ? (
                        <div className="flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300">
                          <span className="text-[10px] font-black text-emerald-700">✅ +{claimedRevNotesCount * REV_PTS}⭐ pts Claimed ({claimedRevNotesCount} Lesson{claimedRevNotesCount > 1 ? 's' : ''})</span>
                        </div>
                      ) : (
                        <div className="w-full py-1.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 bg-slate-100 text-slate-500 border border-slate-200">
                          🔒 Har lesson pe +{REV_PTS}⭐ pts unlock
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* MCQ Practice Card */}
              {(() => {
                const total = dueMcq.length + mcqDoneToday;
                const done = mcqDoneToday;
                const pct = total > 0 ? Math.round((done / total) * 100) : 100;
                const isDone = done === total && total > 0;
                return (
                  <div className={`rounded-2xl p-3 border ${isDone ? 'bg-emerald-50/80 border-emerald-200' : 'bg-white border-violet-200'} shadow-sm flex flex-col justify-between`}>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                            {isDone ? '✅' : '🧠'}
                          </div>
                          <div>
                            <p className="text-[12px] font-black text-slate-800">MCQ Practice</p>
                            <p className="text-[9px] text-slate-500">
                              {total === 0 ? 'Aaj koi MCQ due nahi' : `${dueMcq.length} baki · ${done}/${total} complete`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                          {total === 0 ? 'Done' : `${pct}%`}
                        </span>
                      </div>
                      {total > 0 && (
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-violet-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      {unclaimedRevMcq > 0 ? (
                        <button
                          onClick={() => handleClaimRevisionPts('mcq')}
                          className="w-full py-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm"
                        >
                          🎁 Claim +{unclaimedRevMcq * REV_PTS}⭐ pts ({unclaimedRevMcq} Lesson{unclaimedRevMcq > 1 ? 's' : ''})
                        </button>
                      ) : claimedRevMcqCount > 0 ? (
                        <div className="flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300">
                          <span className="text-[10px] font-black text-emerald-700">✅ +{claimedRevMcqCount * REV_PTS}⭐ pts Claimed ({claimedRevMcqCount} Lesson{claimedRevMcqCount > 1 ? 's' : ''})</span>
                        </div>
                      ) : (
                        <div className="w-full py-1.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 bg-slate-100 text-slate-500 border border-slate-200">
                          🔒 Har lesson pe +{REV_PTS}⭐ pts unlock
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── If there are due revision items, show 3-Tier Hierarchy ── */}
            {dueItems.length > 0 ? (
              <div className="space-y-3">
                {/* 1-Tap Global Quick Action Bar */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenNotes()}
                    disabled={dueNotes.length === 0}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-98 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <BookOpen size={14} />
                    <span>Read Notes ({dueNotes.length})</span>
                  </button>
                  <button
                    onClick={() => handleStartPractice()}
                    disabled={dueMcq.length === 0}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-98 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Target size={14} />
                    <span>Practice MCQ ({dueMcq.length})</span>
                  </button>
                </div>

                {/* Search & Mode Bar */}
                <div className="bg-white rounded-2xl border border-slate-200 p-2.5 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={revisionSearchQuery}
                        onChange={(e) => setRevisionSearchQuery(e.target.value)}
                        placeholder="Search in 200+ lessons & topics..."
                        className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                      {revisionSearchQuery && (
                        <button
                          onClick={() => setRevisionSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* View mode switcher */}
                    <div className="flex bg-slate-100 p-0.5 rounded-xl shrink-0 text-[10px] font-black">
                      <button
                        onClick={() => setRevisionViewMode('SUBJECT')}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${revisionViewMode === 'SUBJECT' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        <BookOpen size={11} /> Subject
                      </button>
                      <button
                        onClick={() => setRevisionViewMode('HIERARCHY')}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${revisionViewMode === 'HIERARCHY' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        <Layers size={11} /> 3-Tier
                      </button>
                      <button
                        onClick={() => setRevisionViewMode('FOCUS')}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${revisionViewMode === 'FOCUS' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        <Zap size={11} /> Focus
                      </button>
                      <button
                        onClick={() => setRevisionViewMode('LIST')}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${revisionViewMode === 'LIST' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        <ListFilter size={11} /> List
                      </button>
                    </div>
                  </div>

                  {/* Subject Filter Carousel */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-slate-100">
                    <button
                      onClick={() => setSelectedRevisionSubjectId('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-all shrink-0 ${selectedRevisionSubjectId === 'ALL' ? 'bg-violet-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      🌟 Sabhi ({dueItems.length})
                    </button>
                    {subjectGroups.map(sg => (
                      <button
                        key={sg.subjectId}
                        onClick={() => setSelectedRevisionSubjectId(sg.subjectId)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1 ${selectedRevisionSubjectId === sg.subjectId ? 'bg-violet-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        <span>{sg.icon}</span>
                        <span>{sg.subjectName}</span>
                        <span className="opacity-70">({sg.totalDue})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* No search results */}
                {filteredSubjectGroups.length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
                    <p className="text-xs font-bold text-slate-500 mb-1">Koi topic ya lesson nahi mila</p>
                    <button
                      onClick={() => { setRevisionSearchQuery(''); setSelectedRevisionSubjectId('ALL'); }}
                      className="text-[11px] text-violet-600 font-black hover:underline"
                    >
                      Filter clear karein
                    </button>
                  </div>
                )}

                {/* MODE 0: SUBJECT-WISE SMART CARDS (Primary Consolidated View) */}
                {revisionViewMode === 'SUBJECT' && filteredSubjectGroups.map((sg) => {
                  const isDetailsOpen = !!expandedRevisionSubs[sg.subjectId];
                  return (
                    <div key={sg.subjectId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-3.5 space-y-3">
                      {/* Top Row: Icon + Subject Title + Badges */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs">
                            {sg.icon}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-slate-800 text-sm truncate leading-tight">{sg.subjectName}</h4>
                            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                              {sg.chapters.length} Lessons · {sg.totalDue} Total Due Topics
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full shrink-0">
                          {sg.totalDue} Due
                        </span>
                      </div>

                      {/* Smart 3-Tier Distribution: ⚡ Weak (mistakes/retry) · ⏳ Average · 📅 Routine */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2 text-center">
                          <div className="flex items-center justify-center gap-1 text-rose-700 font-black text-xs">
                            <span>⚡</span> {sg.weakCount}
                          </div>
                          <p className="text-[8px] font-black text-rose-500 uppercase tracking-wider mt-0.5">Weak / Retry</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
                          <div className="flex items-center justify-center gap-1 text-amber-700 font-black text-xs">
                            <span>⏳</span> {sg.avgCount}
                          </div>
                          <p className="text-[8px] font-black text-amber-600 uppercase tracking-wider mt-0.5">Average</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-center">
                          <div className="flex items-center justify-center gap-1 text-emerald-700 font-black text-xs">
                            <span>📅</span> {sg.routineCount}
                          </div>
                          <p className="text-[8px] font-black text-emerald-600 uppercase tracking-wider mt-0.5">Routine</p>
                        </div>
                      </div>

                      {/* 1-Tap Consolidated Revision Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenNotes(sg.dueNotes)}
                          disabled={sg.notesCount === 0}
                          className="py-2.5 px-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-100 shadow-2xs"
                        >
                          <BookOpen size={13} />
                          <span>📖 Notes ({sg.notesCount})</span>
                        </button>
                        <button
                          onClick={() => handleStartPractice(sg.dueMcq)}
                          disabled={sg.mcqCount === 0}
                          className="py-2.5 px-3 rounded-xl bg-violet-600 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-700 shadow-sm"
                        >
                          <Target size={13} />
                          <span>🧠 MCQ ({sg.mcqCount})</span>
                        </button>
                      </div>

                      {/* Optional Chapter Breakdown Toggle */}
                      <div className="border-t border-slate-100 pt-2">
                        <button
                          onClick={() => setExpandedRevisionSubs(prev => ({ ...prev, [sg.subjectId]: !isDetailsOpen }))}
                          className="w-full flex items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-700 py-1"
                        >
                          <span className="flex items-center gap-1">
                            <span>🔍 Chapter Breakdown Dekhein ({sg.chapters.length} Lessons)</span>
                          </span>
                          {isDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {isDetailsOpen && (
                          <div className="mt-2 space-y-2 pt-1 border-t border-slate-100">
                            {sg.chapters.map(cg => (
                              <div key={cg.chapterId} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-xs font-black text-slate-800 truncate flex-1">{cg.chapterTitle}</p>
                                  <span className="text-[10px] font-bold text-slate-500 shrink-0 ml-2">
                                    {cg.buckets.length} due topics
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-[10px]">
                                  <div className="flex items-center gap-2">
                                    {cg.dueNotes.length > 0 && (
                                      <button
                                        onClick={() => handleOpenNotes(cg.dueNotes)}
                                        className="text-indigo-600 font-bold hover:underline flex items-center gap-0.5"
                                      >
                                        <BookOpen size={10} /> {cg.dueNotes.length} Notes
                                      </button>
                                    )}
                                    {cg.dueMcq.length > 0 && (
                                      <button
                                        onClick={() => handleStartPractice(cg.dueMcq)}
                                        className="text-violet-600 font-bold hover:underline flex items-center gap-0.5"
                                      >
                                        <Target size={10} /> {cg.dueMcq.length} MCQ
                                      </button>
                                    )}
                                  </div>
                                  {cg.totalTopicsCount > 0 && (
                                    <span className="text-emerald-600 font-bold">
                                      {cg.completedTopicsCount}/{cg.totalTopicsCount} Mastered
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* MODE 1: 3-TIER HIERARCHY (Subject ➔ Lesson ➔ 30 Topics) */}
                {revisionViewMode === 'HIERARCHY' && filteredSubjectGroups.map((sg) => {
                  const isSubExpanded = expandedRevisionSubs[sg.subjectId] !== false; // Default expanded
                  return (
                    <div key={sg.subjectId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Subject Header */}
                      <div
                        onClick={() => setExpandedRevisionSubs(prev => ({ ...prev, [sg.subjectId]: !isSubExpanded }))}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 cursor-pointer select-none border-b border-slate-100 hover:bg-indigo-50/60 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-base shadow-xs">
                            {sg.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-slate-800 text-xs">{sg.subjectName}</h4>
                              <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2 py-0.2 rounded-full">
                                {sg.chapters.length} Lessons · {sg.totalDue} Due
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-0.5">
                              📖 {sg.notesCount} Notes · 🧠 {sg.mcqCount} MCQ Practice
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {sg.dueNotes.length > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenNotes(sg.dueNotes); }}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[10px] rounded-lg border border-indigo-200 flex items-center gap-1 transition active:scale-95"
                              title="Revise all notes for this subject"
                            >
                              <BookOpen size={11} /> Notes ({sg.dueNotes.length})
                            </button>
                          )}
                          {sg.dueMcq.length > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartPractice(sg.dueMcq); }}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-[10px] rounded-lg border border-emerald-200 flex items-center gap-1 transition active:scale-95"
                              title="Revise all MCQ for this subject"
                            >
                              <Target size={11} /> MCQ ({sg.dueMcq.length})
                            </button>
                          )}
                          <div className="text-slate-400 p-1">
                            {isSubExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </div>

                      {/* Chapters / Lessons inside Subject */}
                      {isSubExpanded && (
                        <div className="p-2.5 space-y-2.5 bg-slate-50/50">
                          {sg.chapters.map((cg) => {
                            const isChapExpanded = expandedRevisionChapters[cg.chapterId] !== false;
                            return (
                              <div key={cg.chapterId} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                {/* Chapter / Lesson Title Row */}
                                <div className="p-2.5 flex items-center justify-between gap-2">
                                  <div
                                    onClick={() => setExpandedRevisionChapters(prev => ({ ...prev, [cg.chapterId]: !isChapExpanded }))}
                                    className="flex-1 min-w-0 cursor-pointer select-none"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <p className="font-black text-slate-800 text-xs truncate">{cg.chapterTitle}</p>
                                      <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md shrink-0">
                                        {cg.buckets.length} Topics
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] text-slate-400 mt-0.5">
                                      <span>📖 {cg.dueNotes.length} Notes</span>
                                      <span>·</span>
                                      <span>🧠 {cg.dueMcq.length} MCQ</span>
                                      {cg.totalTopicsCount > 0 && (
                                        <>
                                          <span>·</span>
                                          <span className="text-emerald-600 font-bold">
                                            {cg.completedTopicsCount}/{cg.totalTopicsCount} Mastered
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Quick Chapter Action Buttons */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {cg.dueNotes.length > 0 && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenNotes(cg.dueNotes); }}
                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[10px] rounded-lg border border-indigo-200 flex items-center gap-1 transition active:scale-95"
                                      >
                                        <BookOpen size={11} /> Read ({cg.dueNotes.length})
                                      </button>
                                    )}
                                    {cg.dueMcq.length > 0 && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleStartPractice(cg.dueMcq); }}
                                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-[10px] rounded-lg border border-emerald-200 flex items-center gap-1 transition active:scale-95"
                                      >
                                        <Target size={11} /> MCQ ({cg.dueMcq.length})
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setExpandedRevisionChapters(prev => ({ ...prev, [cg.chapterId]: !isChapExpanded }))}
                                      className="p-1 text-slate-400 hover:text-slate-600"
                                      title="Toggle topic matrix"
                                    >
                                      {isChapExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  </div>
                                </div>

                                {/* 30-Topic Matrix */}
                                {isChapExpanded && (
                                  <div className="border-t border-slate-100 p-2 bg-slate-50/80">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {cg.buckets.map((b, topicIdx) => {
                                        const isNotes = !b.stage || b.stage === 'NOTES';
                                        const wrongCount = b.wrongQuestions?.length || 0;
                                        return (
                                          <div
                                            key={`${b.chapterId}::${b.topic}::${topicIdx}`}
                                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 hover:border-slate-200 transition text-xs shadow-2xs"
                                          >
                                            <div className="flex items-center gap-2 min-w-0 mr-1.5">
                                              <span className="text-[9px] font-black text-slate-400 w-4 text-center shrink-0">
                                                #{topicIdx + 1}
                                              </span>
                                              <div className="min-w-0">
                                                <p className="font-bold text-slate-800 text-[11px] truncate leading-tight">
                                                  {b.topic}
                                                </p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                  {isNotes ? (
                                                    <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1 py-0.2 rounded">
                                                      📖 Notes Due
                                                    </span>
                                                  ) : wrongCount > 0 ? (
                                                    <span className="text-[8px] font-black bg-rose-50 text-rose-600 px-1 py-0.2 rounded">
                                                      ⚡ {wrongCount}Q Wrong
                                                    </span>
                                                  ) : (
                                                    <span className="text-[8px] font-black bg-violet-50 text-violet-600 px-1 py-0.2 rounded">
                                                      🧠 Routine MCQ
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            <button
                                              onClick={() => isNotes ? handleOpenNotes([b]) : handleStartPractice([b])}
                                              className={`px-2 py-1 rounded-md text-[10px] font-black shrink-0 transition active:scale-95 ${isNotes ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                            >
                                              {isNotes ? 'Padho' : 'Practice'}
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* MODE 2: FOCUS 15 (Top Urgent Topics) */}
                {revisionViewMode === 'FOCUS' && (
                  <div className="bg-white rounded-2xl border border-rose-200 p-3 shadow-sm space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚡</span>
                        <div>
                          <h4 className="text-xs font-black text-rose-900">Focus 15 — Most Urgent Topics</h4>
                          <p className="text-[9px] text-slate-500">Pehle in topics ko complete karein</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                        {focus15Items.length} Topics
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {focus15Items.map((b, idx) => {
                        const isNotes = !b.stage || b.stage === 'NOTES';
                        const wrongCount = b.wrongQuestions?.length || 0;
                        return (
                          <div key={idx} className="py-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-5 h-5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-800 truncate">{b.topic}</p>
                                <p className="text-[9px] text-slate-400 truncate">
                                  {b.subjectName} · {b.chapterTitle || b.chapterId}
                                  {wrongCount > 0 && <span className="text-rose-600 font-bold ml-1">({wrongCount} Qs Wrong)</span>}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => isNotes ? handleOpenNotes([b]) : handleStartPractice([b])}
                              className={`px-3 py-1 rounded-lg text-[10px] font-black shrink-0 transition active:scale-95 ${isNotes ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}
                            >
                              {isNotes ? '📖 Padho' : '⚡ Practice'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MODE 3: COMPACT LIST */}
                {revisionViewMode === 'LIST' && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-black text-slate-600">
                      <span>Topic & Lesson</span>
                      <span>Action</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                      {dueItems
                        .filter(b => {
                          if (selectedRevisionSubjectId !== 'ALL' && b.subjectId !== selectedRevisionSubjectId) return false;
                          if (revisionSearchQuery) {
                            const q = revisionSearchQuery.toLowerCase();
                            return (b.topic || '').toLowerCase().includes(q) || (b.chapterTitle || '').toLowerCase().includes(q) || (b.subjectName || '').toLowerCase().includes(q);
                          }
                          return true;
                        })
                        .map((b, idx) => {
                          const isNotes = !b.stage || b.stage === 'NOTES';
                          return (
                            <div key={idx} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 truncate">{b.topic}</p>
                                <p className="text-[9px] text-slate-400 truncate">
                                  {b.subjectName} · {b.chapterTitle || b.chapterId}
                                </p>
                              </div>
                              <button
                                onClick={() => isNotes ? handleOpenNotes([b]) : handleStartPractice([b])}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 ${isNotes ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}
                              >
                                {isNotes ? '📖 Read' : '⚡ Practice'}
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-emerald-200 p-4 text-center shadow-xs">
                <span className="text-2xl mb-1 block">🎉</span>
                <p className="text-xs font-black text-emerald-800">Aaj ka Revision 100% Up-to-Date Hai!</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Koi bhi pending notes ya MCQ questions baki nahi hain. Shabash!
                </p>
              </div>
            )}


            {/* ── Skipped pages ── */}
            {skippedPages.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1.5">
                  ⚡ Skipped / Low Time Pages
                </p>
                <div className="space-y-1">
                  {skippedPages.slice(0, 5).map((sp, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px]">{sp.isSkipped ? '⏭️' : '⚡'}</span>
                      <p className="text-[10px] text-amber-800 font-semibold flex-1 truncate">
                        {sp.lessonTitle} — Page {sp.pageNum}
                        {!sp.isSkipped && <span className="text-amber-500 ml-1">({sp.timeSpent}s)</span>}
                      </p>
                    </div>
                  ))}
                  {skippedPages.length > 5 && (
                    <p className="text-[10px] text-amber-500 font-semibold">+{skippedPages.length - 5} more</p>
                  )}
                </div>
              </div>
            )}

          </div>
        </SectionCard>

        {/* ── 3. MY MISTAKE PAGE ──────────────────────────────────────────── */}
        <SectionCard
          emoji="❌"
          title="My Mistake Page"
          subtitle={
            totalEver === 0
              ? 'Abhi koi mistakes saved nahi'
              : `${totalEver} banaya · ${remainingMistakes} bacha · Aaj ${todayPracticed} practice kiya`
          }
          accent="#ef4444"
          actionLabel={remainingMistakes > 0 ? `${Math.min(100, remainingMistakes)}Q Practice` : undefined}
          onAction={remainingMistakes > 0 ? () => onPracticeMistakes(todayMistakes) : undefined}
        >
          {totalEver === 0 ? (
            <p className="text-sm text-slate-400 text-center py-2">
              MCQ galat karoge → automatic yahan save hoga!
            </p>
          ) : (
            <div className="space-y-3">

              {/* MCQ progress: banaya vs bacha */}
              {(() => {
                const pct = totalEver > 0 ? Math.round((todayPracticed / totalEver) * 100) : 0;
                return (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{remainingMistakes === 0 ? '✅' : '🧠'}</span>
                        <div>
                          <p className={`text-[11px] font-black ${remainingMistakes === 0 ? 'text-emerald-700' : 'text-rose-800'}`}>
                            Mistake MCQ
                          </p>
                          <p className="text-[9px] text-slate-500">
                            {todayPracticed} practiced · {remainingMistakes} bacha
                          </p>
                        </div>
                      </div>
                      <p className={`text-[10px] font-black ${remainingMistakes === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {totalEver > 0 ? `${pct}%` : '—'}
                      </p>
                    </div>
                    <div className="h-1.5 bg-rose-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${remainingMistakes === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {/* Quick stat pills */}
                    <div className="flex gap-2 mt-2">
                      <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                        🗂️ Total Banaya: {totalEver}
                      </span>
                      <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        📌 Bacha: {remainingMistakes}
                      </span>
                      {todayPracticed > 0 && (
                        <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          ✓ Aaj: {todayPracticed}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Stats row */}
              <div className="flex gap-2">
                <Stat label="Total Banaya" value={totalEver} color="#ef4444" />
                <Stat label="Bacha" value={remainingMistakes} color="#f59e0b" />
                <Stat label="Milestones" value={`${claimedMilestones}/${availableMilestones}`} color="#8b5cf6" />
              </div>

              {/* Milestone progress bar */}
              {(() => {
                const progress = totalEver % MILESTONE_EVERY;
                const pct = Math.round((progress / MILESTONE_EVERY) * 100);
                const nextTarget = (claimedMilestones + 1) * MILESTONE_EVERY;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        🎯 Next Milestone: {nextTarget} mistakes → +{MILESTONE_PTS}⭐ pts
                      </p>
                      <p className="text-[9px] font-black text-rose-500">{progress}/{MILESTONE_EVERY}</p>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all"
                        style={{ width: `${unclaimedMilestones > 0 ? 100 : pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Claim button for completing a practice session (once per day) */}
              {todayPracticed > 0 && (
                mistakeSessionClaimed ? (
                  <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-100 border border-emerald-300">
                    <span className="text-[11px] font-black text-emerald-700">✅ +{MISTAKE_SESSION_PTS} pts Practice Reward Claimed!</span>
                  </div>
                ) : (
                  <button
                    onClick={handleClaimMistakeSession}
                    className="w-full py-2 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 transition-all active:scale-95 bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm shadow-rose-200"
                  >
                    🎁 Claim +{MISTAKE_SESSION_PTS} ⭐pts
                    <span className="text-[10px] bg-white/30 px-2 py-0.5 rounded-full">Practice Session</span>
                  </button>
                )
              )}

              {/* Milestone claim button — appears when milestone(s) available */}
              {unclaimedMilestones > 0 && (
                <button
                  onClick={handleClaimMilestone}
                  disabled={claimSuccess}
                  className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    claimSuccess
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200'
                  }`}
                >
                  {claimSuccess
                    ? `✅ +${MILESTONE_PTS * unclaimedMilestones}⭐ pts Mil Gaye!`
                    : `🎉 Claim +${MILESTONE_PTS * unclaimedMilestones}⭐ pts Reward`}
                  {!claimSuccess && (
                    <span className="text-[10px] bg-white/30 px-2 py-0.5 rounded-full">
                      {unclaimedMilestones} milestone{unclaimedMilestones > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── 4. LESSON TRACKER ───────────────────────────────────────────── */}
        {(() => {
          const ONE_HOUR = 3600;
          const needsMore = todayHistory.filter((h) => h.totalTimeSec < ONE_HOUR);
          const sufficient = todayHistory.filter((h) => h.totalTimeSec >= ONE_HOUR);
          const formatRemaining = (secs: number) => {
            const rem = ONE_HOUR - secs;
            const m = Math.ceil(rem / 60);
            return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m aur` : `${m}m aur`;
          };
          return (
            <SectionCard
              emoji="📚"
              title="Lesson Tracker"
              subtitle={
                todayHistory.length === 0
                  ? 'Aaj ki padhai yahan track hogi'
                  : needsMore.length > 0
                  ? `${needsMore.length} lesson 1 hour se kam · ${sufficient.length} complete`
                  : `${todayHistory.length} lesson — sab 1 hour+ ✅`
              }
              accent="#0ea5e9"
            >
              {todayHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-2">
                  Padhai shuru karo — yahan time aur progress track hoga
                </p>
              ) : (
                <div className="space-y-3">

                  {/* ── Aur padhna hai (< 1 hr) ── */}
                  {needsMore.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest">
                          ⏳ Aur Padhna Hai (1 hour target)
                        </p>
                        <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                          1hr = +{LESSON_1HR_PTS} ⭐pts
                        </span>
                      </div>
                      <div className="space-y-2">
                        {needsMore.map((h, i) => {
                          const pct = Math.min(100, Math.round((h.totalTimeSec / ONE_HOUR) * 100));
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="text-[11px] font-black text-orange-900 truncate">{h.lessonTitle}</p>
                                  <p className="text-[9px] text-orange-500 truncate">{h.subject}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[10px] font-black text-orange-700">{formatTime(h.totalTimeSec)}</p>
                                  <p className="text-[8px] text-orange-400">{formatRemaining(h.totalTimeSec)}</p>
                                </div>
                              </div>
                              {/* Progress bar toward 1 hour */}
                              <div className="h-1.5 bg-orange-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-orange-500 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── 1 hour+ complete ── */}
                  {sufficient.length > 0 && (
                    <div className="space-y-1.5">
                      {sufficient.map((h, i) => (
                        <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-emerald-800 truncate">✅ {h.lessonTitle}</p>
                              <p className="text-[9px] text-emerald-500 truncate">{h.subject} · {h.pagesRead} pages</p>
                            </div>
                            <p className="text-[10px] font-black text-emerald-700 shrink-0">{formatTime(h.totalTimeSec)}</p>
                          </div>
                          {/* 1hr reward claim button */}
                          {claimed1hrLessons.has(h.lessonTitle) ? (
                            <div className="flex items-center justify-center gap-1 py-1 rounded-lg bg-emerald-100 border border-emerald-300">
                              <span className="text-[10px] font-black text-emerald-700">✅ +{LESSON_1HR_PTS} pts Claimed!</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleClaim1hrLesson(h.lessonTitle)}
                              className="w-full py-1.5 rounded-lg font-black text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                            >
                              🎁 Claim +{LESSON_1HR_PTS} ⭐pts
                              <span className="text-[9px] bg-white/30 px-1.5 py-0.5 rounded-full">1 Hour Bonus</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}
            </SectionCard>
          );
        })()}

      </div>


      {/* ── Modals from Revision Hub ────────────────────────────────────── */}
      {showAllNotesModal && (
        <TodayAllNotesModal
          dueNotes={selectedModalNotes || dueNotes}
          user={user}
          onClose={() => {
            setShowAllNotesModal(false);
            setSelectedModalNotes(null);
          }}
          onTopicsMarked={(markedBuckets) => {
            try {
              markedBuckets.forEach(b => {
                const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
                markNotesReviewed(k, settings?.revisionConfig);
              });
              if (onUpdateUser && markedBuckets.length > 0) {
                const notesPts = markedBuckets.length * 5;
                const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };
                onUpdateUser(updated);
                const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
                const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
                const earned = tryEarnScore(user.id, notesPts, tier, isPrem, 0, 'REVISION_NOTES_READ', undefined, undefined, `${markedBuckets.length} Revision Note(s) Read`);
                showClaimOverlay(earned);
                setTimeout(() => {
                  toast.success("Reading Task Completed!", {
                    description: `${markedBuckets.length} topics marked as read.`
                  });
                }, 500);
              }
            } catch (err) {
              console.error("Error marking topics as read:", err);
            } finally {
              setShowAllNotesModal(false);
              setSelectedModalNotes(null);
              reloadRevision();
            }
          }}
        />
      )}

      {revMcqSessionActive && (
        <TodayMcqSession
          user={user}
          topics={revMcqTopics}
          settings={settings}
          onUpdateUser={onUpdateUser}
          onClose={() => setRevMcqSessionActive(false)}
          onComplete={(results) => {
            // Keep the Today MCQ result in the live user snapshot too.
            // saveTestResult writes the per-session Firestore record, but the
            // dashboard Performance tab reads mcqHistory.
            if (onUpdateUser && Array.isArray(results) && results.length > 0) {
              const latestUser = (window as any).__dashUserRef?.current ?? user;
              const existingHistory = Array.isArray(latestUser.mcqHistory)
                ? latestUser.mcqHistory
                : [];
              const existingIds = new Set(existingHistory.map((entry: any) => entry?.id).filter(Boolean));
              const newResults = results.filter((result: any) => result?.id && !existingIds.has(result.id));
              if (newResults.length > 0) {
                onUpdateUser({
                  ...latestUser,
                  mcqHistory: [...newResults, ...existingHistory],
                });
              }
            }
            setRevMcqSessionActive(false);
            reloadRevision();
          }}
        />
      )}

      {/* ── Claim Success Overlay ─────────────────────────────────────────── */}
      {claimOverlay && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setClaimOverlay(null)}
        >
          <div className="mx-6 bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-xs animate-[pop_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
            {/* Gold top banner */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-5 text-center">
              <p className="text-4xl mb-1">🎉</p>
              <p className="text-white font-black text-xl">Badhaai Ho!</p>
              <p className="text-white/90 text-[11px] font-bold mt-0.5">Points Mil Gaye!</p>
            </div>

            {/* Stats */}
            <div className="px-5 py-5 space-y-3">

              {/* Pts added (big) */}
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3 flex items-center justify-between">
                <p className="text-[12px] font-black text-amber-700">Abhi Mila</p>
                <p className="text-2xl font-black text-amber-600">+{claimOverlay.ptsAdded} ⭐</p>
              </div>

              {/* Aaj ka total */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center justify-between">
                <p className="text-[12px] font-black text-indigo-700">Aaj Ke Total Pts</p>
                <p className="text-xl font-black text-indigo-600">{claimOverlay.todayTotal} ⭐</p>
              </div>

              {/* XP before → after */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total XP</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 font-bold mb-0.5">Pehle</p>
                    <p className="text-[13px] font-black text-slate-500">{claimOverlay.xpBefore.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="flex-1 flex items-center gap-1 justify-center">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">+{claimOverlay.ptsAdded}</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-emerald-600 font-bold mb-0.5">Ab</p>
                    <p className="text-[13px] font-black text-emerald-600">{claimOverlay.xpAfter.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Daily Progress</p>
                  <p className="text-[9px] font-black text-slate-500">Aaj Kamaye</p>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                    style={{ width: `${Math.min(100, Math.round((claimOverlay.todayTotal / 5000) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={() => setClaimOverlay(null)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black text-sm active:scale-95 transition-all"
              >
                🚀 Aage Badhte Hain!
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
