// @ts-nocheck
/**
 * DailyEventPage — Unified daily study hub
 * Shows: Routine · Revision Hub · My Mistakes · Lesson Tracker
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, BrainCircuit, CalendarCheck,
  Clock, Target, ChevronRight, Zap, CheckCircle, Lock,
} from 'lucide-react';
import { loadRoutineData, getUserSubTier, getDailyClaimAmount } from '../utils/routineStorage';
import { getLevelInfo } from '../utils/levelSystem';
import { getDueItems, getAllBuckets } from '../utils/revisionTrackerV2';
import { getMistakeBankSync } from '../utils/mistakeBank';
import { getAutoTrackSnapshot, getLessonStats, isLessonRewarded } from '../utils/routineAutoTrack';
import { RoutineRevisionBadge } from './RoutineRevisionBadge';
import { getMistakeSessions } from '../utils/mistakeAnalytics';
import { tryEarnScore, getDailyScoreEarned } from '../utils/scoreSystem';
import type { User, SystemSettings } from '../types';
import type { MistakeEntry } from '../utils/mistakeBank';

interface Props {
  user: User;
  settings?: SystemSettings;
  onBack: () => void;
  onOpenRoutine: () => void;
  onOpenRevisionHub: (lessonId?: string, lessonTitle?: string) => void;
  onPracticeMistakes: (mistakes: MistakeEntry[]) => void;
  onOpenSubjects?: () => void;
  onOpenTracking?: () => void;
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
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: `${accent}18` }}
        >
          {emoji}
        </div>
        <div>
          <p className="font-black text-slate-900 text-sm leading-tight">{title}</p>
          <p className="text-[10px] text-slate-400 font-medium leading-snug">{subtitle}</p>
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
  user, settings, onBack, onOpenRoutine, onOpenRevisionHub, onPracticeMistakes, onOpenSubjects, onOpenTracking,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);
  const lucentNotes = useMemo(() => (settings?.lucentNotes || []) as any[], [settings]);

  // ── Level / coin-per-task ────────────────────────────────────────────────
  const subTier = useMemo(() => getUserSubTier(user as any), [user]);
  const dailyAmount = useMemo(() => getDailyClaimAmount(subTier), [subTier]);
  const levelInfo = useMemo(() => getLevelInfo(user.totalScore || 0), [user.totalScore]);

  // ── Claim Success Overlay ────────────────────────────────────────────────
  const [claimOverlay, setClaimOverlay] = useState<{ ptsAdded: number; todayTotal: number; xpBefore: number; xpAfter: number } | null>(null);

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

  // ── Task Completion Reward (100 pts per completed task, claim once per day) ──
  const TASK_PTS = 100;
  const TASK_CLAIMED_KEY = `iic_task_pts_claimed_${user.id}_${todayStr}`;

  const [claimedTasks, setClaimedTasks] = useState<Set<string>>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(TASK_CLAIMED_KEY) || '[]') as string[];
      return new Set(arr);
    } catch { return new Set(); }
  });
  const [lastClaimedTask, setLastClaimedTask] = useState<string | null>(null);

  const handleClaimTaskPts = useCallback((lessonId: string) => {
    try {
      const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
      const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
      const earned = tryEarnScore(user.id, TASK_PTS, tier, isPrem, 0, 'DAILY_TASK_COMPLETE', undefined, undefined, `Daily Task Complete`);
      const next = new Set(claimedTasks).add(lessonId);
      localStorage.setItem(TASK_CLAIMED_KEY, JSON.stringify([...next]));
      setClaimedTasks(next);
      setLastClaimedTask(lessonId);
      setTimeout(() => setLastClaimedTask(null), 2500);
      showClaimOverlay(earned);
    } catch (e) { console.error('Task pts claim failed', e); }
  }, [user.id, user.subscriptionLevel, user.subscriptionTier, user.isPremium, claimedTasks, TASK_CLAIMED_KEY, showClaimOverlay]);

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
  }, []);
  const dueNotes = dueItems.filter((b: any) => !b.stage || b.stage === 'NOTES');
  const dueMcq   = dueItems.filter((b: any) => b.stage === 'MCQ');

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
  }, []);

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

  // ── Revision Hub 100 pts Claim ────────────────────────────────────────────
  const REV_NOTES_CLAIMED_KEY = `iic_rev_notes_pts_claimed_${user.id}_${todayStr}`;
  const REV_MCQ_CLAIMED_KEY   = `iic_rev_mcq_pts_claimed_${user.id}_${todayStr}`;
  const REV_PTS = 100;

  const [revNotesClaimed, setRevNotesClaimed] = useState<boolean>(() => {
    try { return localStorage.getItem(REV_NOTES_CLAIMED_KEY) === '1'; } catch { return false; }
  });
  const [revMcqClaimed, setRevMcqClaimed] = useState<boolean>(() => {
    try { return localStorage.getItem(REV_MCQ_CLAIMED_KEY) === '1'; } catch { return false; }
  });

  const handleClaimRevisionPts = useCallback((type: 'notes' | 'mcq') => {
    try {
      const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
      const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
      const label = type === 'notes' ? 'Revision Hub Notes Complete' : 'Revision Hub MCQ Complete';
      const activity = type === 'notes' ? 'REVISION_NOTES_COMPLETE' : 'REVISION_MCQ_COMPLETE';
      const earned = tryEarnScore(user.id, REV_PTS, tier, isPrem, 0, activity, undefined, undefined, label);
      if (type === 'notes') {
        localStorage.setItem(REV_NOTES_CLAIMED_KEY, '1');
        setRevNotesClaimed(true);
      } else {
        localStorage.setItem(REV_MCQ_CLAIMED_KEY, '1');
        setRevMcqClaimed(true);
      }
      showClaimOverlay(earned);
    } catch (e) { console.error('Revision pts claim failed', e); }
  }, [user.id, user.subscriptionLevel, user.subscriptionTier, user.isPremium, REV_NOTES_CLAIMED_KEY, REV_MCQ_CLAIMED_KEY, showClaimOverlay]);

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

                  {/* Reading progress */}
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        📖 Reading
                        {slot.totalPages > 0 && ` ${slot.pagesRead}/${slot.totalPages} pages`}
                      </p>
                      <p className={`text-[9px] font-black ${slot.readingDone ? 'text-emerald-600' : 'text-indigo-600'}`}>
                        {slot.readingDone ? 'Done ✓' : `${slot.pct}%`}
                      </p>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${slot.readingDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${slot.pct}%` }}
                      />
                    </div>
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

                  {/* ── 100 pts + coin Claim button ── */}
                  <div className="mt-2">
                    {claimedTasks.has(slot.lessonId) ? (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300">
                        <span className="text-[11px] font-black text-emerald-700">✅ +{TASK_PTS} pts{coinPerTask > 0 ? ` + ${coinPerTask} 🪙` : ''} Claim Ho Gaye!</span>
                      </div>
                    ) : lastClaimedTask === slot.lessonId ? (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300">
                        <span className="text-[11px] font-black text-emerald-700">✅ +{TASK_PTS} pts{coinPerTask > 0 ? ` + ${coinPerTask} 🪙` : ''} Mil Gaye!</span>
                      </div>
                    ) : slot.done ? (
                      <button
                        onClick={() => handleClaimTaskPts(slot.lessonId)}
                        className="w-full py-2 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 transition-all active:scale-95 bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm shadow-orange-200"
                      >
                        🎁 Claim +{TASK_PTS} ⭐pts
                        {coinPerTask > 0 && (
                          <span className="text-[10px] bg-white/30 px-2 py-0.5 rounded-full font-black">
                            +{coinPerTask} 🪙
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="w-full py-2 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed">
                        🔒 +{TASK_PTS} pts{coinPerTask > 0 ? ` + ${coinPerTask} 🪙` : ''} — Task Complete Karo
                      </div>
                    )}
                  </div>

                  {/* ── Revision Hub button — locked until lesson is complete ── */}
                  {isLessonRewarded(slot.lessonId) ? (
                    <RoutineRevisionBadge
                      lessonId={slot.lessonId}
                      lessonTitle={slot.lessonTitle}
                      onGoToRevision={(lessonId, lessonTitle) => onOpenRevisionHub(lessonId, lessonTitle)}
                    />
                  ) : (
                    <div className="mt-2 rounded-xl bg-slate-100 border border-slate-200 p-3 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock size={15} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-slate-500">🔒 Revision Hub</p>
                        <p className="text-[10px] font-black text-rose-500 mt-0.5">
                          Unlock: 100 🪙 coin · Task complete pe 50% OFF → 50 🪙/session
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          Lesson complete karo → <span className="font-bold">"{slot.lessonTitle}"</span> unlock hoga
                        </p>
                      </div>
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

            {/* ── Notes slot ── */}
            {(() => {
              const total = dueNotes.length + notesReviewedToday;
              const done  = notesReviewedToday;
              const pct   = total > 0 ? Math.round((done / total) * 100) : 100;
              const isDone = done === total && total > 0;
              return (
                <div className={`rounded-xl px-3 py-2.5 border ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{isDone ? '✅' : '📖'}</span>
                      <div>
                        <p className={`text-[11px] font-black ${isDone ? 'text-emerald-700' : 'text-indigo-800'}`}>
                          Notes
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {total === 0 ? 'Aaj koi notes due nahi' : `${done}/${total} reviewed`}
                        </p>
                      </div>
                    </div>
                    <p className={`text-[10px] font-black ${isDone ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {total === 0 ? '—' : `${pct}%`}
                    </p>
                  </div>
                  {total > 0 && (
                    <div className="h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  {/* ── Notes 100 pts claim ── */}
                  <div className="mt-2">
                    {revNotesClaimed ? (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300">
                        <span className="text-[11px] font-black text-emerald-700">✅ +{REV_PTS}⭐ pts Claim Ho Gaye!</span>
                      </div>
                    ) : isDone ? (
                      <button
                        onClick={() => handleClaimRevisionPts('notes')}
                        className="w-full py-2 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 transition-all active:scale-95 bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-200"
                      >
                        🎁 Claim +{REV_PTS}⭐ pts — Notes Done!
                      </button>
                    ) : (
                      <div className="w-full py-2 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed">
                        🔒 +{REV_PTS}⭐ pts — Notes 100% Complete Karo
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── MCQ slot ── */}
            {(() => {
              const total = dueMcq.length + mcqDoneToday;
              const done  = mcqDoneToday;
              const pct   = total > 0 ? Math.round((done / total) * 100) : 100;
              const isDone = done === total && total > 0;
              return (
                <div className={`rounded-xl px-3 py-2.5 border ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-violet-50 border-violet-200'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{isDone ? '✅' : '🧠'}</span>
                      <div>
                        <p className={`text-[11px] font-black ${isDone ? 'text-emerald-700' : 'text-violet-800'}`}>
                          MCQ Practice
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {total === 0 ? 'Aaj koi MCQ due nahi' : `${done}/${total} complete`}
                        </p>
                      </div>
                    </div>
                    <p className={`text-[10px] font-black ${isDone ? 'text-emerald-600' : 'text-violet-600'}`}>
                      {total === 0 ? '—' : `${pct}%`}
                    </p>
                  </div>
                  {total > 0 && (
                    <div className="h-1.5 bg-violet-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-violet-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  {/* ── MCQ 100 pts claim ── */}
                  <div className="mt-2">
                    {revMcqClaimed ? (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300">
                        <span className="text-[11px] font-black text-emerald-700">✅ +{REV_PTS}⭐ pts Claim Ho Gaye!</span>
                      </div>
                    ) : isDone ? (
                      <button
                        onClick={() => handleClaimRevisionPts('mcq')}
                        className="w-full py-2 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 transition-all active:scale-95 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm shadow-violet-200"
                      >
                        🎁 Claim +{REV_PTS}⭐ pts — MCQ Done!
                      </button>
                    ) : (
                      <div className="w-full py-2 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed">
                        🔒 +{REV_PTS}⭐ pts — MCQ 100% Complete Karo
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

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
