// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CalendarCheck, ChevronLeft, BookOpen, Atom, Globe, Trophy,
  Zap, Target, TrendingUp,
  FlaskConical, Landmark, BarChart3, Plus, Minus,
  Check, ChevronDown, ChevronUp, Sparkles, RefreshCw,
  ListChecks, LayoutGrid, HelpCircle, X, CheckCircle2, XCircle,
  Lock, Trash2, Settings,
} from 'lucide-react';
import {
  loadRoutineData, saveRoutineData, checkAndResetDaily,
  getSkipCost,
  LESSON_COMPLETE_REWARD, SKIP_LESSON_COST_PER_LESSON,
  getUserSubTier, ensureTodayClaimEntry,
  getDailyClaimAmount,
  getBaseSlotCount, getTierSlotCost, getActualMaxSlots,
  type RoutineData, type RoutineSubjectConfig, type UserSubTier, type RoutineSlot,
  type RoutineCategory, type RoutineCategorySubject,
} from '../utils/routineStorage';
import { saveUserToLive } from '../firebase';
import { getLevelInfo } from '../utils/levelSystem';
import { scheduleRoutineSync, syncRoutineNow } from '../utils/routineFirebaseSync';
import {
  isRoutineMcqDone, getAutoTrackSnapshot, getRoutineMcqScore,
  getStarRating, getMistakeCount, getMaskCount, getLessonTotalTime,
  isLessonAutoComplete, isLessonRewarded, markLessonRewarded,
  isRoutinePageMcqDone, getRoutinePageMcqScore, countPageMcqDone,
  getPageMcqPercent, getPageMcqBestPercent,
  getLessonPageAvgPercent, getLessonBestPageAvgPercent,
  getPageTime,
} from '../utils/routineAutoTrack';
import { scheduleRoutineLessonForRevision } from '../utils/revisionTrackerV2';
import { RoutineRevisionBadge } from './RoutineRevisionBadge';
import { tryEarnScore, getActiveBoost } from '../utils/scoreSystem';
import { DailyEventPage } from './DailyEventPage';

const TASK_COMPLETE_PTS = 100; // pts awarded per routine task completion



// ── Types ────────────────────────────────────────────────────────────────────
interface LucentEntry {
  id: string;
  subject: string;
  lessonTitle: string;
  bookName?: string;
  classLevel?: string;
  pages?: any[];
}

type SubjectCategory = 'SCIENCE' | 'SOCIAL_SCIENCE' | 'OTHER';

const SCIENCE_SUBJECTS = new Set(['physics', 'chemistry', 'biology', 'science', 'botany', 'zoology', 'maths', 'mathematics']);
const SOCIAL_SUBJECTS  = new Set(['history', 'polity', 'economics', 'geography', 'civics', 'sociology', 'political_science', 'political science']);

function getCategory(subjectId: string): SubjectCategory {
  const id = subjectId.toLowerCase().replace(/\s+/g, '_');
  if (SCIENCE_SUBJECTS.has(id)) return 'SCIENCE';
  if (SOCIAL_SUBJECTS.has(id))  return 'SOCIAL_SCIENCE';
  return 'OTHER';
}

function getToday() { return new Date().toISOString().split('T')[0]; }

function buildSubjectGroups(notes: LucentEntry[]): Record<string, LucentEntry[]> {
  const groups: Record<string, LucentEntry[]> = {};
  (notes || []).forEach(e => {
    const sid = (e.subject || 'other').toLowerCase().trim();
    if (!groups[sid]) groups[sid] = [];
    groups[sid].push(e);
  });
  return groups;
}

function buildSubjectConfigs(notes: LucentEntry[], existing: RoutineSubjectConfig[]): RoutineSubjectConfig[] {
  const groups = buildSubjectGroups(notes);
  return Object.entries(groups).map(([sid, lessons]) => {
    const prev = existing.find(e => e.id === sid);
    return {
      id: sid,
      name: capitalise(sid.replace(/_/g, ' ')),
      category: getCategory(sid),
      routineApplied: prev?.routineApplied ?? true,
      startLessonIndex: prev?.startLessonIndex ?? 0,
      totalLessons: lessons.length,
      currentLessonIndex: prev?.currentLessonIndex ?? 0,
    };
  });
}

function capitalise(s: string) { return s.replace(/\b\w/g, c => c.toUpperCase()); }

// ── Subject icon & color map ──────────────────────────────────────────────────
const SUBJECT_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  physics:           { icon: <Atom size={18} />,        color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  chemistry:         { icon: <FlaskConical size={18} />, color: 'text-green-600',   bg: 'bg-green-50',   border: 'border-green-200' },
  biology:           { icon: <Sparkles size={18} />,     color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  science:           { icon: <Atom size={18} />,         color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-200' },
  history:           { icon: <Landmark size={18} />,     color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  polity:            { icon: <Globe size={18} />,        color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  'political science':{ icon: <Globe size={18} />,       color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  economics:         { icon: <TrendingUp size={18} />,   color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  geography:         { icon: <BarChart3 size={18} />,    color: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  maths:             { icon: <Zap size={18} />,          color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  mathematics:       { icon: <Zap size={18} />,          color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
};
const DEFAULT_META = { icon: <BookOpen size={18} />, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };

// ── Toggle track color map (explicit hex — avoids Tailwind JIT purge of dynamic class names) ─
const SUBJECT_TOGGLE_COLOR: Record<string, string> = {
  'text-blue-600':    '#3b82f6',
  'text-green-600':   '#22c55e',
  'text-emerald-600': '#10b981',
  'text-cyan-600':    '#06b6d4',
  'text-amber-600':   '#f59e0b',
  'text-indigo-600':  '#6366f1',
  'text-orange-600':  '#f97316',
  'text-teal-600':    '#14b8a6',
  'text-purple-600':  '#a855f7',
  'text-slate-600':   '#64748b',
};

const CAT_LABEL: Record<SubjectCategory, string> = {
  SCIENCE:       '🔬 Science',
  SOCIAL_SCIENCE:'🌏 Social Science',
  OTHER:         '📚 Other',
};

// ── Slot emoji map ────────────────────────────────────────────────────────────
const SLOT_EMOJI: Record<string, string> = {
  physics: '⚛️', chemistry: '⚗️', biology: '🌿', science: '🔬',
  history: '🏛️', polity: '⚖️', 'political science': '⚖️',
  economics: '📈', geography: '🗺️', maths: '📐', mathematics: '📐',
  hindi: '📖', english: '📝', sanskrit: '🕉️', computer: '💻',
  gk: '🌐', environment: '🌱', art: '🎨',
};
function getSlotEmoji(subjectId: string): string {
  return SLOT_EMOJI[subjectId.toLowerCase()] || '📚';
}

// ── Filter notes for a routine slot ──────────────────────────────────────────
function getNotesForSlot(slot: RoutineSlot, allNotes: LucentEntry[]): LucentEntry[] {
  return allNotes.filter(n => {
    const nb = (n as any).bookName?.trim() || '';
    const nc = (n as any).classLevel || '';
    const ns = (n.subject || 'other').toLowerCase().trim();
    if (slot.bookName && nb !== slot.bookName) return false;
    if (slot.classLevel && nc !== slot.classLevel) return false;
    return ns === slot.subjectId;
  });
}

// ── Filter notes for a category subject ──────────────────────────────────────
function getNotesForSubject(sub: RoutineCategorySubject, allNotes: LucentEntry[]): LucentEntry[] {
  return allNotes.filter(n => {
    const nb = (n as any).bookName?.trim() || '';
    const nc = (n as any).classLevel || '';
    const ns = (n.subject || 'other').toLowerCase().trim();
    if (sub.bookName && nb !== sub.bookName) return false;
    if (sub.classLevel && nc !== sub.classLevel) return false;
    return ns === sub.subjectId;
  });
}

// ── Page status box ───────────────────────────────────────────────────────────
function PageDot({ state, num }: { state: 'done' | 'read' | 'none'; num: number }) {
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${
      state === 'done' ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' :
      state === 'read' ? 'bg-orange-400 border-orange-500 text-white shadow-sm' :
      'bg-slate-100 border-slate-200 text-slate-400'
    }`}>
      {state === 'done' ? <Check size={12} /> : num}
    </div>
  );
}

// ── Today task card ───────────────────────────────────────────────────────────
function StarBadge({ lessonId }: { lessonId: string }) {
  const stars = getStarRating(lessonId);
  if (!stars) return null;
  const color = stars >= 4 ? 'text-amber-500' : stars >= 3 ? 'text-blue-500' : 'text-slate-400';
  return (
    <span className={`text-[10px] font-black ${color}`}>
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  );
}

function formatTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const TASK_PTS_CLAIMED_PREFIX = 'iic_task_pts_claimed_';
const isTaskPtsClaimed = (lessonId: string) => {
  try { return !!localStorage.getItem(`${TASK_PTS_CLAIMED_PREFIX}${lessonId}`); } catch { return false; }
};
const markTaskPtsClaimed = (lessonId: string) => {
  try { localStorage.setItem(`${TASK_PTS_CLAIMED_PREFIX}${lessonId}`, '1'); } catch {}
};

function TaskLessonCard({
  label, subjectName, lessonTitle, lessonId, totalPages, meta, mcqHistory, onLessonComplete, onClaimPts, onGoToRevision,
}: {
  label: string; subjectName: string; lessonTitle: string; lessonId: string;
  totalPages: number; meta: typeof DEFAULT_META; mcqHistory: any[];
  onLessonComplete?: (lessonId: string) => void;
  onClaimPts?: (lessonId: string) => void;
  onGoToRevision?: (lessonId: string, lessonTitle?: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [ptsClaimed, setPtsClaimed] = useState(() => isTaskPtsClaimed(lessonId));
  const [claimAnim, setClaimAnim] = useState(false);
  const mcqDone = isRoutineMcqDone(lessonId);
  const snapshot = getAutoTrackSnapshot();
  const pageStates = Array.from({ length: totalPages }, (_, i) => {
    const read    = !!snapshot.pageReads[`${lessonId}__${i}`];
    const pageMcq = !!snapshot.pageMcqDone?.[`${lessonId}__${i}`];
    // Green = read + page MCQ done; orange = read only; gray = unread
    return (read && pageMcq) ? 'done' : read ? 'read' : 'none';
  });
  const readCount  = pageStates.filter(s => s !== 'none').length;
  const doneCount  = pageStates.filter(s => s === 'done').length;
  const allDone    = doneCount === totalPages && totalPages > 0;
  // Per-page MCQ badge counts
  const pagesWithMcqIdx = Array.from({ length: totalPages }, (_, i) => i); // all pages (no server info here)
  const pageMcqDoneCount = pagesWithMcqIdx.filter(i => !!snapshot.pageMcqDone?.[`${lessonId}__${i}`]).length;
  const pct        = totalPages > 0 ? Math.round((readCount / totalPages) * 100) : 0;

  // Fire lesson complete callback once when all pages become green
  const onLessonCompleteRef = useRef(onLessonComplete);
  onLessonCompleteRef.current = onLessonComplete;
  useEffect(() => {
    if (allDone && onLessonCompleteRef.current && !isLessonRewarded(lessonId)) {
      onLessonCompleteRef.current(lessonId);
    }
  // lessonId is stable for a given card; allDone is the reactive trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, lessonId]);

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${allDone ? 'border-emerald-300 bg-emerald-50' : `${meta.border} bg-white`}`}>
      <div className="flex items-center gap-3 p-3.5 cursor-pointer active:bg-slate-50" onClick={() => setExpanded(e => !e)}>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${allDone ? 'bg-emerald-100 text-emerald-600' : `${meta.bg} ${meta.color}`}`}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            {allDone && <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">✓ DONE</span>}
          </div>
          <p className={`font-black text-sm leading-tight truncate ${allDone ? 'text-emerald-700' : 'text-slate-800'}`}>{subjectName}</p>
          <p className="text-xs text-slate-500 font-medium truncate">{lessonTitle}</p>
          {/* Mini progress bar */}
          <div className="flex items-center gap-2 mt-1.5">
            {totalPages > 0 ? (
                <>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${allDone ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{readCount}/{totalPages}p</span>
                </>
            ) : (
                <span className="text-[10px] font-bold text-slate-400 shrink-0">0 pages</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pageMcqDoneCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {pageMcqDoneCount > 0 ? `✅ ${pageMcqDoneCount}/${totalPages} MCQ` : '⏳ MCQ'}
          </span>
          {expanded ? <ChevronUp size={13} className="text-slate-300" /> : <ChevronDown size={13} className="text-slate-300" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-slate-100">
          <div className="flex flex-wrap gap-1.5 pt-3 mb-3">
            {pageStates.map((s, i) => <PageDot key={i} state={s} num={i + 1} />)}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mb-2.5">
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" />Read+MCQ</span>
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-3 h-3 rounded bg-orange-400 inline-block" />Sirf padha</span>
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-3 h-3 rounded bg-slate-200 inline-block" />Nahi padha</span>
          </div>
          {/* Stats row: score, stars, time, mistakes */}
          <div className="flex gap-2 mb-2.5">
            {(() => { const s = getRoutineMcqScore(lessonId); return s ? (
              <div className="flex-1 bg-white rounded-xl border border-slate-100 p-2 text-center">
                <p className="text-[8px] text-slate-400">🎯 Score</p>
                <p className="text-xs font-black text-blue-600">{s.correct}/{s.total}</p>
                <StarBadge lessonId={lessonId} />
              </div>
            ) : null; })()}
            {(() => { const t = getLessonTotalTime(lessonId, totalPages); return t > 0 ? (
              <div className="flex-1 bg-white rounded-xl border border-slate-100 p-2 text-center">
                <p className="text-[8px] text-slate-400">⏱ Time</p>
                <p className="text-xs font-black text-indigo-600">{formatTime(t)}</p>
              </div>
            ) : null; })()}
            {(() => { const m = getMistakeCount(lessonId); return m > 0 ? (
              <div className="flex-1 bg-white rounded-xl border border-slate-100 p-2 text-center">
                <p className="text-[8px] text-slate-400">❌ Galat</p>
                <p className="text-xs font-black text-red-500">{m}</p>
              </div>
            ) : null; })()}
          </div>
          {/* Progress hint */}
          {allDone ? (
            <div className="rounded-xl p-3 text-xs bg-emerald-100 text-emerald-700">
              <p className="font-black">✅ Lesson complete! Daily Event Page mein pts claim karo</p>
            </div>
          ) : (
            <div className="rounded-xl p-3 text-xs font-medium bg-slate-50 text-slate-500">
              {pageMcqDoneCount === 0
                ? <p>🧠 Pages par MCQ karo → page complete hoga (read + MCQ)</p>
                : <p>📖 {totalPages - doneCount} aur pages padho + MCQ karo → auto-track hoga</p>
              }
            </div>
          )}

          {/* Revision Hub button — locked until today's lesson is complete */}
          {isLessonRewarded(lessonId) ? (
            <RoutineRevisionBadge
              lessonId={lessonId}
              lessonTitle={lessonTitle}
              onGoToRevision={onGoToRevision}
            />
          ) : (
            <div className="mt-3 rounded-xl bg-slate-100 border border-slate-200 p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                <Lock size={15} className="text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-slate-500">🔒 Revision Hub</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  Aaj ka lesson complete karo → <span className="font-bold">"{lessonTitle}"</span> unlock hoga
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}




// ── Lesson row for Subjects tab ───────────────────────────────────────────────
function LessonDetailRow({ lesson, idx, isCurrent, mcqHistory }: {
  lesson: LucentEntry; idx: number; isCurrent: boolean; mcqHistory: any[];
}) {
  const [open, setOpen] = useState(isCurrent);
  const snapshot    = getAutoTrackSnapshot();
  const totalPages  = lesson.pages?.length || 0;
  const mcqDone     = isRoutineMcqDone(lesson.id);
  const routineScore = getRoutineMcqScore(lesson.id);

  const pageStates: Array<'done' | 'read' | 'none'> = Array.from({ length: totalPages }, (_, i) => {
    const read    = !!snapshot.pageReads[`${lesson.id}__${i}`];
    const pageMcq = !!snapshot.pageMcqDone?.[`${lesson.id}__${i}`];
    return (read && pageMcq) ? 'done' : read ? 'read' : 'none';
  });
  const readCount     = pageStates.filter(s => s !== 'none').length;
  const doneCount     = pageStates.filter(s => s === 'done').length;
  const complete      = doneCount === totalPages && totalPages > 0;
  const mcqPagesDone  = Array.from({ length: totalPages }, (_, i) => !!snapshot.pageMcqDone?.[`${lesson.id}__${i}`]).filter(Boolean).length;

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isCurrent ? 'border-blue-300 bg-blue-50' : complete ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white'
    }`}>
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer active:bg-slate-50" onClick={() => setOpen(o => !o)}>
        {/* Index / checkmark */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black border ${
          complete ? 'bg-emerald-500 border-emerald-600 text-white' :
          isCurrent ? 'bg-blue-500 border-blue-600 text-white' :
          'bg-slate-100 border-slate-200 text-slate-500'
        }`}>
          {complete ? <Check size={11} /> : idx + 1}
        </div>
        <p className={`flex-1 text-xs font-bold truncate ${isCurrent ? 'text-blue-700' : complete ? 'text-emerald-700' : 'text-slate-700'}`}>
          {lesson.lessonTitle || `Lesson ${idx + 1}`}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] text-slate-400 font-medium">{totalPages}p</span>
          {isCurrent && <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">Today</span>}
          {mcqPagesDone > 0 && !isCurrent && <span className="text-[9px] text-emerald-600">✅{mcqPagesDone}</span>}
          {open ? <ChevronUp size={11} className="text-slate-300" /> : <ChevronDown size={11} className="text-slate-300" />}
        </div>
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-slate-100 pt-2.5 space-y-2">
          {totalPages > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {pageStates.map((s, pi) => <PageDot key={pi} state={s} num={pi + 1} />)}
              </div>
              <div className="flex items-center gap-3 mb-1">
                <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />Read+MCQ</span>
                <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2.5 h-2.5 rounded bg-orange-400 inline-block" />Sirf padha</span>
                <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2.5 h-2.5 rounded bg-slate-200 inline-block" />Nahi padha</span>
              </div>
            </>
          ) : (
            <p className="text-[10px] text-slate-400">No pages data</p>
          )}
          <div className="bg-white rounded-xl border border-slate-100 px-3 py-2 flex gap-4">
            <div className="flex-1">
              <p className="text-[9px] text-slate-400 font-medium">📖 Pages</p>
              <p className={`text-xs font-black ${readCount === totalPages && totalPages > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>{readCount}/{totalPages}</p>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-slate-400 font-medium">🧠 MCQ Pages</p>
              <p className={`text-xs font-black ${mcqPagesDone > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{mcqPagesDone}/{totalPages}</p>
            </div>
            {routineScore && (
              <div className="flex-1">
                <p className="text-[9px] text-slate-400 font-medium">🎯 Score</p>
                <p className="text-xs font-black text-blue-600">{routineScore.correct}/{routineScore.total}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Category Subject Card (Subjects tab) ──────────────────────────────────────
function CatSubjectCard({
  catId, sub, lessons, mcqHistory, coins, onChangeStart, onCoinFlash,
}: {
  catId: string; sub: RoutineCategorySubject; lessons: LucentEntry[]; mcqHistory: any[];
  coins: number; onChangeStart: (catId: string, subjectId: string, idx: number) => void;
  onCoinFlash: (msg: string) => void;
}) {
  const [targetStart, setTargetStart] = useState(sub.currentLessonIndex);

  // Sync if external updates happen
  useEffect(() => { setTargetStart(sub.currentLessonIndex); }, [sub.currentLessonIndex]);

  const meta = SUBJECT_META[sub.subjectId] || DEFAULT_META;
  const skipCost = getSkipCost(sub.currentLessonIndex, targetStart);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all shadow-sm ${meta.border} bg-white`}>
      {/* Header: subject name */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
          {sub.emoji || meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-800 text-sm truncate">{sub.displayName || capitalise(sub.subjectId)}</p>
          <p className="text-[10px] text-slate-500 font-medium">{sub.bookName || (`Class ${sub.classLevel}`)}</p>
        </div>
      </div>

      {/* Lesson navigator */}
      <div className="border-t border-slate-100 px-4 pb-3.5 pt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = Math.max(0, targetStart - 1);
              setTargetStart(next);
            }}
            className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center active:bg-slate-200 transition shrink-0"
          >
            <Minus size={14} className="text-slate-600" />
          </button>

          <div className="flex-1 text-center bg-slate-50 rounded-xl border border-slate-100 py-2 px-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none mb-0.5">Lesson {targetStart + 1}</p>
            <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">
              {lessons[targetStart]?.lessonTitle || `Lesson ${targetStart + 1}`}
            </p>
            {skipCost > 0 && <p className="text-[9px] text-amber-600 font-black mt-0.5">−{skipCost}🪙</p>}
            {skipCost === 0 && targetStart !== sub.currentLessonIndex && <p className="text-[9px] text-emerald-600 font-black mt-0.5">Free!</p>}
          </div>

          <button
            onClick={() => {
              const next = Math.min(lessons.length - 1, targetStart + 1);
              setTargetStart(next);
            }}
            className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center active:bg-slate-200 transition shrink-0"
          >
            <Plus size={14} className="text-slate-600" />
          </button>
        </div>

        {targetStart !== sub.currentLessonIndex && (
          <button
            onClick={() => {
              if (skipCost > coins) { onCoinFlash(`Coins kam hain! Chahiye: ${skipCost}🪙`); return; }
              onChangeStart(catId, sub.subjectId, targetStart);
              onCoinFlash(skipCost > 0 ? `Start changed! −${skipCost}🪙` : 'Start point changed! Free 🎉');
            }}
            className="mt-2.5 w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-black active:scale-95 transition shadow-sm"
          >
            {skipCost > 0 ? `✓ Apply (−${skipCost}🪙 deduct hoga)` : '✓ Apply (Free)'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Subject Card (Subjects tab) — simplified ──────────────────────────────────
function SubjectCard({
  sub, lessons, mcqHistory, coins, onToggleApply, onChangeStart, onCoinFlash,
}: {
  sub: RoutineSubjectConfig; lessons: LucentEntry[]; mcqHistory: any[];
  coins: number; onToggleApply: () => void; onChangeStart: (idx: number) => void;
  onCoinFlash: (msg: string) => void;
}) {
  const [targetStart, setTargetStart] = useState(sub.startLessonIndex);
  const meta     = SUBJECT_META[sub.id] || DEFAULT_META;
  const skipCost = getSkipCost(sub.startLessonIndex, targetStart);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const turningOn = !sub.routineApplied;
    onToggleApply();
    const potential = lessons.length * LESSON_COMPLETE_REWARD;
    onCoinFlash(turningOn
      ? `${sub.name} ON ✅ — ${lessons.length} lessons · ${potential}🪙 potential`
      : `${sub.name} OFF — Routine disabled`
    );
  };

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all shadow-sm ${sub.routineApplied ? meta.border : 'border-slate-200'} bg-white`}>
      {/* Header: subject name + toggle */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sub.routineApplied ? `${meta.bg} ${meta.color}` : 'bg-slate-100 text-slate-400'}`}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-800 text-sm truncate">{sub.name}</p>
          <p className="text-[10px] text-slate-500 font-medium">{CAT_LABEL[sub.category]}</p>
        </div>
        <button
          onClick={handleToggle}
          className="relative rounded-full transition-all duration-300 shrink-0"
          style={{
            minWidth: 44, width: 44, height: 24,
            backgroundColor: sub.routineApplied
              ? (SUBJECT_TOGGLE_COLOR[meta.color] ?? '#6366f1')
              : '#94a3b8', /* slate-400 — clearly visible in both states */
          }}
        >
          <span
            className="absolute top-0.5 bg-white rounded-full shadow-md transition-all duration-300"
            style={{ width: 19, height: 19, left: sub.routineApplied ? 23 : 2 }}
          />
        </button>
      </div>

      {/* Lesson navigator */}
      <div className="border-t border-slate-100 px-4 pb-3.5 pt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = Math.max(0, targetStart - 1);
              setTargetStart(next);
            }}
            className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center active:bg-slate-200 transition shrink-0"
          >
            <Minus size={14} className="text-slate-600" />
          </button>

          <div className="flex-1 text-center bg-slate-50 rounded-xl border border-slate-100 py-2 px-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none mb-0.5">Lesson {targetStart + 1}</p>
            <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">
              {lessons[targetStart]?.lessonTitle || `Lesson ${targetStart + 1}`}
            </p>
            {skipCost > 0 && <p className="text-[9px] text-amber-600 font-black mt-0.5">−{skipCost}🪙</p>}
            {skipCost === 0 && targetStart !== sub.startLessonIndex && <p className="text-[9px] text-emerald-600 font-black mt-0.5">Free!</p>}
          </div>

          <button
            onClick={() => {
              const next = Math.min(lessons.length - 1, targetStart + 1);
              setTargetStart(next);
            }}
            className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center active:bg-slate-200 transition shrink-0"
          >
            <Plus size={14} className="text-slate-600" />
          </button>
        </div>

        {targetStart !== sub.startLessonIndex && (
          <button
            onClick={() => {
              if (skipCost > coins) { onCoinFlash(`Coins kam hain! Chahiye: ${skipCost}🪙`); return; }
              onChangeStart(targetStart);
              onCoinFlash(skipCost > 0 ? `Start changed! −${skipCost}🪙` : 'Start point changed! Free 🎉');
            }}
            className="mt-2.5 w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-black active:scale-95 transition shadow-sm"
          >
            {skipCost > 0 ? `✓ Apply (−${skipCost}🪙 deduct hoga)` : '✓ Apply (Free)'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Full Tracking view: book → subject → lesson → pages ──────────────────────
function TrackingView({ subjectGroups, subjects, mcqHistory }: {
  subjectGroups: Record<string, LucentEntry[]>;
  subjects: RoutineSubjectConfig[];
  mcqHistory: any[];
}) {
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});
  const snapshot = getAutoTrackSnapshot();

  // Sort subjects: SCIENCE first, then SOCIAL_SCIENCE, then OTHER
  const sortedSubs = [...subjects].sort((a, b) => {
    const order = { SCIENCE: 0, SOCIAL_SCIENCE: 1, OTHER: 2 };
    return (order[a.category] ?? 3) - (order[b.category] ?? 3);
  });

  // Overall totals
  const allLessons = Object.values(subjectGroups).flat();
  const totalPages = allLessons.reduce((s, l) => s + (l.pages?.length || 0), 0);
  const totalRead  = allLessons.reduce((s, l) => {
    const tp = l.pages?.length || 0;
    return s + Array.from({ length: tp }, (_, i) => snapshot.pageReads[`${l.id}__${i}`] ? 1 : 0).reduce((a, b) => a + b, 0);
  }, 0);
  // Count pages with MCQ done (per-page tracking, not per-lesson)
  const totalMcqDone = allLessons.reduce((s, l) => {
    const tp = l.pages?.length || 0;
    return s + Array.from({ length: tp }, (_, i) => !!snapshot.pageMcqDone?.[`${l.id}__${i}`] ? 1 : 0).reduce((a, b) => a + b, 0);
  }, 0);
  const overallPct = totalPages > 0 ? Math.round((totalRead / totalPages) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Overall stats card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">📊 Overall Progress</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Subjects', value: subjects.length },
            { label: 'Lessons', value: allLessons.length },
            { label: 'Pages Read', value: totalRead },
            { label: 'MCQ Done', value: totalMcqDone },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-2 text-center">
              <p className="text-base font-black">{s.value}</p>
              <p className="text-[8px] opacity-70 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${overallPct}%` }} />
          </div>
          <span className="text-xs font-black">{overallPct}%</span>
        </div>
        <p className="text-[10px] opacity-60 mt-1 font-medium">{totalRead}/{totalPages} pages padhe hain</p>
      </div>

      {/* Per-subject breakdown */}
      {sortedSubs.map(sub => {
        const lessons = subjectGroups[sub.id] || [];
        if (lessons.length === 0) return null;
        const meta = SUBJECT_META[sub.id] || DEFAULT_META;

        // Subject-level stats
        const subTotalPages = lessons.reduce((s, l) => s + (l.pages?.length || 0), 0);
        const subReadPages  = lessons.reduce((s, l) => {
          const tp = l.pages?.length || 0;
          return s + Array.from({ length: tp }, (_, i) => snapshot.pageReads[`${l.id}__${i}`] ? 1 : 0).reduce((a, b) => a + b, 0);
        }, 0);
        // Per-page MCQ done count for subject
        const subMcqDone    = lessons.reduce((s, l) => {
          const tp = l.pages?.length || 0;
          return s + Array.from({ length: tp }, (_, i) => !!snapshot.pageMcqDone?.[`${l.id}__${i}`] ? 1 : 0).reduce((a, b) => a + b, 0);
        }, 0);
        const subTotalPagesWithAny = lessons.reduce((s, l) => s + (l.pages?.length || 0), 0);
        const subCompletedLessons = lessons.filter(l => {
          const tp = l.pages?.length || 0;
          if (tp === 0) return false;
          return Array.from({ length: tp }, (_, i) => {
            const read = !!snapshot.pageReads[`${l.id}__${i}`];
            const pageMcq = !!snapshot.pageMcqDone?.[`${l.id}__${i}`];
            return read && pageMcq;
          }).every(Boolean);
        }).length;
        const subPct = subTotalPages > 0 ? Math.round((subReadPages / subTotalPages) * 100) : 0;
        const isExpanded = !!expandedSubs[sub.id];

        return (
          <div key={sub.id} className={`rounded-2xl border overflow-hidden ${sub.routineApplied ? meta.border : 'border-slate-200'} bg-white`}>
            {/* Subject header */}
            <div className="flex items-center gap-3 p-3.5 cursor-pointer active:bg-slate-50"
              onClick={() => setExpandedSubs(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-black text-slate-800 text-sm">{sub.name}</p>
                  {sub.routineApplied && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>Routine</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${meta.color.replace('text-', 'bg-')}`}
                      style={{ width: `${subPct}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 shrink-0">{subPct}%</span>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={14} className="text-slate-300 shrink-0" /> : <ChevronDown size={14} className="text-slate-300 shrink-0" />}
            </div>

            {/* Subject stats strip */}
            <div className="flex border-t border-slate-100 divide-x divide-slate-100">
              <div className="flex-1 py-2 text-center">
                <p className="text-[9px] text-slate-400">Lessons</p>
                <p className="text-xs font-black text-slate-700">{lessons.length}</p>
              </div>
              <div className="flex-1 py-2 text-center">
                <p className="text-[9px] text-slate-400">Complete</p>
                <p className="text-xs font-black text-emerald-600">{subCompletedLessons}</p>
              </div>
              <div className="flex-1 py-2 text-center">
                <p className="text-[9px] text-slate-400">Pages</p>
                <p className="text-xs font-black text-blue-600">{subReadPages}/{subTotalPages}</p>
              </div>
              <div className="flex-1 py-2 text-center">
                <p className="text-[9px] text-slate-400">MCQ ✅</p>
                <p className="text-xs font-black text-purple-600">{subMcqDone}/{subTotalPagesWithAny}</p>
              </div>
            </div>

            {/* Lesson list */}
            {isExpanded && (
              <div className="border-t border-slate-100 px-3 pb-3 pt-2.5 space-y-1.5">
                {lessons.map((lesson, lidx) => {
                  const tp      = lesson.pages?.length || 0;
                  const lMcq       = isRoutineMcqDone(lesson.id); // lesson-level (any MCQ done)
                  const lScore     = getRoutineMcqScore(lesson.id);
                  // Per-page MCQ: page is 'done' only if read AND that page's MCQ done
                  const lPages  = Array.from({ length: tp }, (_, i) => {
                    const read    = !!snapshot.pageReads[`${lesson.id}__${i}`];
                    const pageMcq = !!snapshot.pageMcqDone?.[`${lesson.id}__${i}`];
                    return (read && pageMcq) ? 'done' : read ? 'read' : 'none';
                  });
                  const lRead   = lPages.filter(s => s !== 'none').length;
                  const lDone   = lPages.filter(s => s === 'done').length;
                  const lMcqPagesCount = Array.from({ length: tp }, (_, i) => !!snapshot.pageMcqDone?.[`${lesson.id}__${i}`]).filter(Boolean).length;
                  // Pages that actually have MCQ content (use as denominator to avoid "incomplete" illusion)
                  const lPagesWithMcq = (lesson.pages || []).filter(p => (p as any).mcqs?.length > 0).length;
                  const lMcqDenom = lPagesWithMcq > 0 ? lPagesWithMcq : tp; // fallback to totalPages if no mcq metadata
                  const lComplete = lDone === tp && tp > 0;
                  const lExpanded = !!expandedLessons[lesson.id];

                  // ── Lesson % computation ──────────────────────────────────────
                  const pageAvgPct  = getLessonPageAvgPercent(lesson.id, tp);   // current avg
                  const bestAvgPct  = getLessonBestPageAvgPercent(lesson.id, tp); // best avg
                  const lessonPct: number | null = pageAvgPct;

                  const pctColor = (p: number) =>
                    p >= 80 ? 'text-emerald-600' : p >= 50 ? 'text-amber-500' : 'text-red-500';
                  const pctBg = (p: number) =>
                    p >= 80 ? 'bg-emerald-50 border-emerald-200' : p >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

                  return (
                    <div key={lesson.id} className={`rounded-xl border overflow-hidden ${
                      lComplete ? 'border-emerald-200 bg-emerald-50' :
                      lMcq && lRead > 0 ? 'border-orange-200 bg-orange-50' :
                      'border-slate-100 bg-white'
                    }`}>
                      {/* Lesson row */}
                      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                        onClick={() => setExpandedLessons(prev => ({ ...prev, [lesson.id]: !prev[lesson.id] }))}>
                        {/* Lesson number / status */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
                          lComplete ? 'bg-emerald-500 text-white' :
                          lMcq ? 'bg-orange-400 text-white' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {lComplete ? <Check size={11} /> : lidx + 1}
                        </div>

                        {/* Title */}
                        <p className={`flex-1 text-[11px] font-bold truncate ${
                          lComplete ? 'text-emerald-700' : lMcq ? 'text-orange-700' : 'text-slate-700'
                        }`}>
                          {lesson.lessonTitle || `Lesson ${lidx + 1}`}
                        </p>

                        {/* Lesson % badge */}
                        {lessonPct !== null ? (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg border shrink-0 ${pctBg(lessonPct)} ${pctColor(lessonPct)}`}>
                            {lessonPct}%
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${lComplete ? 'bg-emerald-500' : lRead > 0 ? 'bg-orange-400' : 'bg-slate-200'}`}
                                style={{ width: tp > 0 ? `${(lRead / tp) * 100}%` : '0%' }} />
                            </div>
                            <span className="text-[9px] text-slate-400 font-medium">{lRead}/{tp}</span>
                          </div>
                        )}

                        {lExpanded ? <ChevronUp size={11} className="text-slate-300 shrink-0" /> : <ChevronDown size={11} className="text-slate-300 shrink-0" />}
                      </div>

                      {/* Expanded pages */}
                      {lExpanded && (
                        <div className="px-3 pb-3 border-t border-slate-100 pt-2.5 space-y-3">
                          {tp > 0 ? (
                            <>
                              {/* ── Lesson mastery card ── */}
                              {lessonPct !== null && (
                                <div className={`rounded-xl border p-3 ${pctBg(lessonPct)}`}>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">📊 Lesson Mastery</p>
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden border border-white/80">
                                      <div className={`h-full rounded-full transition-all ${lessonPct >= 80 ? 'bg-emerald-500' : lessonPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                        style={{ width: `${lessonPct}%` }} />
                                    </div>
                                    <span className={`text-sm font-black ${pctColor(lessonPct)}`}>{lessonPct}%</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-center">
                                    <div className="bg-white/70 rounded-lg py-1.5 px-1">
                                      <p className="text-[8px] text-slate-400 font-medium">Page MCQ</p>
                                      <p className={`text-xs font-black ${pageAvgPct !== null ? pctColor(pageAvgPct) : 'text-slate-300'}`}>
                                        {pageAvgPct !== null ? `${pageAvgPct}%` : '—'}
                                      </p>
                                    </div>
                                    <div className="bg-white/70 rounded-lg py-1.5 px-1">
                                      <p className="text-[8px] text-slate-400 font-medium">Best</p>
                                      <p className={`text-xs font-black ${bestAvgPct !== null ? pctColor(bestAvgPct) : 'text-slate-300'}`}>
                                        {bestAvgPct !== null ? `${bestAvgPct}%` : '—'}
                                        {bestAvgPct !== null && pageAvgPct !== null && bestAvgPct > pageAvgPct
                                          ? <span className="text-[8px] text-amber-500 ml-0.5">↑</span>
                                          : null}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* ── Per-page grid ── */}
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Pages ({tp} total)</p>
                                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(tp, 6)}, minmax(0, 1fr))` }}>
                                  {Array.from({ length: tp }, (_, pi) => {
                                    const st      = lPages[pi];
                                    const curPct  = getPageMcqPercent(lesson.id, pi);
                                    const bestPct = getPageMcqBestPercent(lesson.id, pi);
                                    const pageSec = getPageTime(lesson.id, pi);
                                    const dotColor = st === 'done' ? 'bg-emerald-500' : st === 'read' ? 'bg-orange-400' : 'bg-slate-200';
                                    return (
                                      <div key={pi} className={`rounded-lg border text-center py-1.5 px-1 ${
                                        st === 'done' ? 'border-emerald-200 bg-emerald-50' :
                                        st === 'read' ? 'border-orange-200 bg-orange-50' :
                                        'border-slate-100 bg-slate-50'
                                      }`}>
                                        <div className={`w-4 h-4 rounded-full mx-auto mb-0.5 flex items-center justify-center text-[8px] font-black text-white ${dotColor}`}>
                                          {pi + 1}
                                        </div>
                                        {curPct !== null ? (
                                          <p className={`text-[9px] font-black ${pctColor(curPct)}`}>{curPct}%</p>
                                        ) : (
                                          <p className="text-[9px] text-slate-300">—</p>
                                        )}
                                        {bestPct !== null && curPct !== null && bestPct > curPct && (
                                          <p className="text-[8px] text-amber-400 font-bold">↑{bestPct}%</p>
                                        )}
                                        {pageSec > 0 && (
                                          <p className="text-[7px] text-slate-400">{formatTime(pageSec)}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Read+MCQ</span>
                                  <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />Sirf padha</span>
                                  <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" />Baaki</span>
                                </div>
                              </div>

                              {/* ── Summary strip ── */}
                              <div className="flex flex-wrap gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2">
                                <div>
                                  <p className="text-[9px] text-slate-400">Pages padhe</p>
                                  <p className="text-xs font-black text-slate-700">{lRead}/{tp}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-400">MCQ Pages</p>
                                  <p className={`text-xs font-black ${lMcqPagesCount > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{lMcqPagesCount}/{lMcqDenom}</p>
                                </div>
                                {lScore && (
                                  <div>
                                    <p className="text-[9px] text-slate-400">🎯 Score</p>
                                    <p className="text-xs font-black text-blue-600">{lScore.correct}/{lScore.total}</p>
                                    <StarBadge lessonId={lesson.id} />
                                  </div>
                                )}
                                {(() => { const t = getLessonTotalTime(lesson.id, tp); return t > 0 ? (
                                  <div>
                                    <p className="text-[9px] text-slate-400">⏱ Time</p>
                                    <p className="text-xs font-black text-indigo-600">{formatTime(t)}</p>
                                  </div>
                                ) : null; })()}
                                {(() => { const m = getMistakeCount(lesson.id); return m > 0 ? (
                                  <div>
                                    <p className="text-[9px] text-slate-400">❌ Galat</p>
                                    <p className="text-xs font-black text-red-500">{m}</p>
                                  </div>
                                ) : null; })()}
                                <div>
                                  <p className="text-[9px] text-slate-400">Status</p>
                                  <p className={`text-xs font-black ${lComplete ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {lComplete ? '🎉 Done' : lRead > 0 ? '📖 Jari' : '○ Shuru nahi'}
                                  </p>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-[10px] text-slate-400">No pages data</p>
                          )}
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
    </div>
  );
}


// ── Available subject/book slots from notes ───────────────────────────────────
// ── Default subject groups always shown in AddCategorySheet ───────────────────
const DEFAULT_SUBJECT_GROUPS: Array<{ group: string; subjects: string[] }> = [
  { group: 'Science',        subjects: ['physics', 'chemistry', 'biology'] },
  { group: 'Social Science', subjects: ['history', 'geography', 'polity', 'economics'] },
];

function getAvailableSubjectSlots(notes: LucentEntry[]): Array<{
  bookName: string; classLevel?: string; subjectId: string;
  displayName: string; emoji: string; count: number; isDefault?: boolean;
}> {
  // Count notes per default subject (no bookName/classLevel filter)
  const defaultCounts: Record<string, number> = {};
  DEFAULT_SUBJECT_GROUPS.forEach(({ subjects }) => subjects.forEach(sj => { defaultCounts[sj] = 0; }));

  // Count notes per book/class/subject
  const seen = new Map<string, any>();
  notes.forEach(n => {
    const bk = (n as any).bookName?.trim() || '';
    const cl = (n as any).classLevel || '';
    const sj = (n.subject || 'other').toLowerCase().trim();
    // count into default bucket
    if (defaultCounts[sj] !== undefined) defaultCounts[sj]++;
    if (!bk && !cl) return;
    const key = `${bk}||${cl}||${sj}`;
    if (!seen.has(key)) {
      const bookLabel = bk || (cl ? `Class ${cl}` : 'Other');
      seen.set(key, { bookName: bk, classLevel: cl || undefined, subjectId: sj, displayName: `${bookLabel} · ${capitalise(sj)}`, emoji: getSlotEmoji(sj), count: 0 });
    }
    seen.get(key).count++;
  });

  // Add default subjects that have actual notes
  const defaults: any[] = [];
  DEFAULT_SUBJECT_GROUPS.forEach(({ subjects }) => {
    subjects.forEach(sj => {
      if (defaultCounts[sj] > 0) {
        defaults.push({ bookName: '', classLevel: undefined, subjectId: sj, displayName: capitalise(sj), emoji: getSlotEmoji(sj), count: defaultCounts[sj], isDefault: true });
      }
    });
  });

  // Default subjects (physics, chemistry, biology, history, geography, polity, economics)
  // already shown under their own group — skip them from book/class groups to avoid duplicates.
  const nonDefaultSeen = Array.from(seen.values()).filter(
    item => defaultCounts[item.subjectId] === undefined
  );
  return [...defaults, ...nonDefaultSeen];
}

// ── Routine Setup Sheet (one-time: School/Competition → Class/Books, saved to data) ──

function RoutineSetupSheet({ allNotes, currentMode, currentBoard, currentClass, currentBooks, onSave, onClose }: {
  allNotes: LucentEntry[];
  currentMode: 'SCHOOL' | 'COMPETITION' | null;
  currentBoard: string | null;
  currentClass: string | null;
  currentBooks: string[];
  onSave: (mode: 'SCHOOL' | 'COMPETITION', board: string | null, classLevel: string | null, books: string[]) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'SCHOOL' | 'COMPETITION' | null>(currentMode);
  const [board, setBoard] = useState<string | null>(currentBoard);
  const [classLevel, setClassLevel] = useState(currentClass || '');
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set(currentBooks));

  const availableClasses = useMemo(() => {
    const s = new Set<string>();
    allNotes.forEach(n => {
      const cl = (n as any).classLevel;
      // School mode mein sirf numeric classes dikhao — COMPETITION etc. exclude karo
      if (cl && !isNaN(Number(cl))) s.add(String(cl));
    });
    return Array.from(s).sort((a, b) => Number(a) - Number(b));
  }, [allNotes]);

  const availableBooks = useMemo(() => {
    const s = new Set<string>();
    allNotes.forEach(n => {
      const bk = (n as any).bookName?.trim();
      if (bk) {
          const bkLower = bk.toLowerCase();
          if (bkLower !== 'speedy science' && bkLower !== 'speedy social science' && bkLower !== 'sar sangrah' && bkLower !== 'mcq practice') {
              s.add(bk);
          }
      } else if ((n as any).classLevel === 'COMPETITION') {
          s.add('Lucent');
      }
    });

    // Ensure Lucent is included if there's any competition note, as fallback
    if (allNotes.some(n => (n as any).classLevel === 'COMPETITION')) {
       s.add('Lucent');
    }

    return Array.from(s).sort();
  }, [allNotes]);

  const selectedBook = Array.from(selectedBooks)[0] || '';
  const canSave = mode === 'SCHOOL' ? !!classLevel : mode === 'COMPETITION' ? selectedBooks.size > 0 : false;

  return (
    <div className="fixed inset-0 z-[600] flex items-end bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-800">⚙️ Routine Setup</h2>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Apna study path chuno</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:scale-90"><X size={16} /></button>
        </div>
        <div className="px-5 py-5 pb-8 space-y-4">
          <div className="block">
            <span className="block text-xs font-black text-slate-600 mb-1.5">Study path</span>
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              {([
                { value: 'SCHOOL', label: 'School', emoji: '🏫' },
                { value: 'COMPETITION', label: 'Competition', emoji: '🏆' },
              ] as { value: 'SCHOOL' | 'COMPETITION'; label: string; emoji: string }[]).map((opt, i, arr) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setMode(opt.value);
                    if (opt.value === 'SCHOOL') setSelectedBooks(new Set());
                    if (opt.value === 'COMPETITION') setClassLevel('');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 transition-colors ${i < arr.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  <span className="text-lg">{opt.emoji}</span>
                  <span className={`flex-1 text-sm font-black ${mode === opt.value ? (opt.value === 'COMPETITION' ? 'text-orange-600' : 'text-blue-700') : 'text-slate-700'}`}>{opt.label}</span>
                  {/* Radio circle */}
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${mode === opt.value ? (opt.value === 'COMPETITION' ? 'border-orange-500' : 'border-blue-500') : 'border-slate-300'}`}>
                    {mode === opt.value && (
                      <span className={`w-2.5 h-2.5 rounded-full ${opt.value === 'COMPETITION' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {mode === 'SCHOOL' && (
            <label className="block">
              <span className="block text-xs font-black text-slate-600 mb-1.5">Class</span>
              <div className="relative">
                <select
                  value={classLevel}
                  onChange={e => setClassLevel(e.target.value)}
                  className="w-full appearance-none rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 pr-10 text-sm font-black text-blue-800 outline-none focus:border-blue-500"
                >
                  <option value="">Class chuno</option>
                  {availableClasses.map(cl => <option key={cl} value={cl}>Class {cl}</option>)}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-blue-400" />
              </div>
              {availableClasses.length === 0 && (
                <span className="block text-xs text-slate-400 font-medium mt-2">Koi class notes nahi mili — pehle notes add karo.</span>
              )}
            </label>
          )}

          {mode === 'COMPETITION' && (
            <div className="block">
              <span className="block text-xs font-black text-slate-600 mb-1.5">Select Books (Multiple possible)</span>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto p-1">
                {availableBooks.map(book => (
                  <label key={book} className="flex items-center gap-3 p-3 rounded-xl border border-orange-100 bg-orange-50/50 cursor-pointer active:bg-orange-100 transition-colors">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${selectedBooks.has(book) ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'}`}>
                      {selectedBooks.has(book) && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <span className="text-sm font-black text-orange-800 flex-1">{book}</span>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedBooks.has(book)}
                      onChange={(e) => {
                        setSelectedBooks(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(book);
                          else next.delete(book);
                          return next;
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
              {availableBooks.length === 0 && (
                <span className="block text-xs text-slate-400 font-medium mt-2">Koi book notes nahi mili — pehle notes add karo.</span>
              )}
            </div>
          )}
        </div>
        <div className="px-5 pb-8 pt-3 border-t border-slate-100 shrink-0 space-y-2.5">
          <button
            onClick={() => {
              if (!canSave) return;
              if (mode === 'SCHOOL') onSave('SCHOOL', board, classLevel, []);
              if (mode === 'COMPETITION') onSave('COMPETITION', null, null, Array.from(selectedBooks));
            }}
            disabled={!canSave}
            className={`w-full py-3.5 rounded-2xl font-black text-sm transition active:scale-[0.98] ${canSave ? mode === 'COMPETITION' ? 'bg-orange-500 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
            {!mode ? 'Pehle option chuno' : !canSave ? mode === 'SCHOOL' ? 'Class chuno' : 'Kam se kam 1 book chuno' : 'Save Karo ✓'}
          </button>
          {/* Destination hint — tells user where they'll land after saving */}
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400">Save ke baad:</span>
            <span className="inline-flex items-center gap-1 bg-slate-100 rounded-full px-2 py-0.5">
              <span className="text-[10px]">📅</span>
              <span className="text-[10px] font-black text-slate-600">Routine</span>
              <span className="text-[10px] text-slate-400">tab</span>
            </span>
            <span className="text-[10px] text-slate-400">mein dikhega</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Category Sheet ────────────────────────────────────────────────────────
function AddCategorySheet({ allNotes, existingCategories, routineMode, selectedClass, selectedBook, selectedBooks, onAdd, onClose }: {
  allNotes: LucentEntry[];
  existingCategories: RoutineCategory[];
  routineMode: 'SCHOOL' | 'COMPETITION' | null;
  selectedClass: string | null;
  selectedBook: string | null;
  selectedBooks?: string[];
  onAdd: (cat: Omit<RoutineCategory, 'id'>) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filter notes by user's chosen mode/class/books
  const modeFilteredNotes = useMemo(() => {
    if (routineMode === 'SCHOOL' && selectedClass) {
      return allNotes.filter(n => String((n as any).classLevel) === String(selectedClass));
    }
    if (routineMode === 'COMPETITION') {
      if (selectedBooks && selectedBooks.length > 0) {
        const bookSet = new Set(selectedBooks);
        return allNotes.filter(n => bookSet.has((n as any).bookName?.trim() || ''));
      }
      if (selectedBook) {
        return allNotes.filter(n => ((n as any).bookName?.trim() || '') === selectedBook);
      }
    }
    return allNotes;
  }, [allNotes, routineMode, selectedClass, selectedBook, selectedBooks]);

  const available = useMemo(() => getAvailableSubjectSlots(modeFilteredNotes), [modeFilteredNotes]);

  // Label shown at top of sheet
  const sourceLabel = routineMode === 'SCHOOL' && selectedClass
    ? `📚 Class ${selectedClass} ke notes`
    : routineMode === 'COMPETITION'
      ? selectedBooks && selectedBooks.length > 0
        ? `📖 ${selectedBooks.length === 1 ? selectedBooks[0] : `${selectedBooks.length} books`} ke notes`
        : selectedBook ? `📖 ${selectedBook} ke notes` : null
      : null;
  const existingSubjectKeys = useMemo(() => {
    const s = new Set<string>();
    existingCategories.forEach(cat => cat.subjects.forEach(sub => s.add(`${sub.bookName}||${sub.classLevel || ''}||${sub.subjectId}`)));
    return s;
  }, [existingCategories]);
  const filtered = available.filter(item => {
    if (existingSubjectKeys.has(`${item.bookName}||${item.classLevel || ''}||${item.subjectId}`)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.subjectId.includes(q) || item.displayName.toLowerCase().includes(q) || item.bookName?.toLowerCase().includes(q);
  });

  // Build ordered groups: default groups first, then note-derived book/class groups
  const defaultGroupMap: Record<string, string> = {};
  DEFAULT_SUBJECT_GROUPS.forEach(({ group, subjects }) => subjects.forEach(sj => { defaultGroupMap[sj] = group; }));

  const orderedGroupKeys: string[] = [];
  DEFAULT_SUBJECT_GROUPS.forEach(({ group }) => orderedGroupKeys.push(group));

  const grouped: Record<string, typeof filtered> = {};
  filtered.forEach(item => {
    let key: string;
    if (item.isDefault) {
      key = defaultGroupMap[item.subjectId] || 'Other';
    } else {
      key = item.bookName || (item.classLevel ? `Class ${item.classLevel}` : 'Other');
    }
    if (!grouped[key]) { grouped[key] = []; if (!orderedGroupKeys.includes(key)) orderedGroupKeys.push(key); }
    grouped[key].push(item);
  });
  const groupEntries = orderedGroupKeys.filter(k => grouped[k]?.length).map(k => [k, grouped[k]] as const);

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    const name = categoryName.trim();
    const selectedItems = available.filter(item => {
      const key = `${item.bookName}||${item.classLevel || ''}||${item.subjectId}`;
      return selected.has(key);
    });
    if (selectedItems.length === 0) return;
    onAdd({
      categoryName: name || capitalise(selectedItems[0].subjectId),
      emoji: selectedItems[0].emoji,
      subjects: selectedItems.map(item => ({
        subjectId: item.subjectId,
        bookName: item.bookName,
        classLevel: item.classLevel,
        displayName: item.displayName,
        emoji: item.emoji,
        currentLessonIndex: 0,
        totalLessons: item.count,
      })),
      currentSubjectIndex: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-end bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-800">📚 Category Add Karo</h2>
            {sourceLabel && (
              <p className="text-[11px] font-bold text-blue-600 mt-0.5">{sourceLabel} dikh rahe hain</p>
            )}
            {!sourceLabel && (
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">Pehle Routine Setup mein class/book chunein</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:scale-90"><X size={16} /></button>
        </div>

        {/* Category Name Input */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Category ka Naam (Optional)</p>
          <input type="text" value={categoryName} onChange={e => setCategoryName(e.target.value)}
            placeholder="e.g. Morning Set, Science Group..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-blue-400" />
        </div>

        <div className="px-4 pt-1 pb-1 shrink-0">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subjects Chuno</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-[72px]">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm font-bold text-slate-400">
                {sourceLabel
                  ? `${sourceLabel.replace(' dikh rahe hain', '')} mein koi notes nahi — pehle notes add karo`
                  : 'Sab subjects already add hain!'}
              </p>
            </div>
          ) : groupEntries.map(([groupLabel, items]) => (
            <div key={groupLabel} className="mb-4 mt-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{groupLabel}</p>
              <div className="space-y-1.5">
                {items.map(item => {
                  const key = `${item.bookName}||${item.classLevel || ''}||${item.subjectId}`;
                  const isSelected = selected.has(key);
                  const subtitle = item.isDefault
                    ? (item.count > 0 ? `${item.count} lessons available` : 'Default subject')
                    : `${item.bookName || (item.classLevel ? `Class ${item.classLevel}` : '')} · ${item.count} lessons`;
                  return (
                    <button key={key}
                      onClick={() => toggleSelect(key)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left ${isSelected ? 'bg-blue-50 border-blue-400' : 'border-slate-200 bg-white'}`}>
                      <span className="text-xl shrink-0">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800">{capitalise(item.subjectId)}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                        {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Rotation Preview + Save */}
        <div className="px-4 pb-28 pt-3 shrink-0 border-t border-slate-100">
          {selected.size > 0 && (() => {
            const selectedItems = available.filter(item =>
              selected.has(`${item.bookName}||${item.classLevel || ''}||${item.subjectId}`)
            );
            return (
              <div className="mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  🔄 Rotation Order — Har lesson complete hone par agla subject aayega
                </p>
                <div className="flex items-center gap-1 flex-wrap bg-blue-50 rounded-xl px-3 py-2.5 border border-blue-100">
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="flex items-center gap-1 bg-white border border-blue-200 rounded-full px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm">
                        <span>{item.emoji}</span>
                        <span>{capitalise(item.subjectId)}</span>
                      </span>
                      {idx < selectedItems.length - 1 && (
                        <span className="text-blue-300 font-black text-xs">→</span>
                      )}
                      {idx === selectedItems.length - 1 && selectedItems.length > 1 && (
                        <span className="text-blue-300 font-black text-xs">↩</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <button onClick={handleSave} disabled={selected.size === 0}
            className={`w-full py-3.5 rounded-2xl font-black text-sm transition active:scale-[0.98] ${selected.size > 0 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
            {selected.size === 0 ? 'Koi subject nahi chuna' : `Add Karo (${selected.size} subject${selected.size > 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Slot row for Category Manager ─────────────────────────────────────────────
function SlotRow({ icon, label, count, unlocked, cost, userCredits, locked, lockHint, onUnlock }: {
  icon: string; label: string; count: number; unlocked: boolean; cost: number;
  userCredits?: number; locked?: boolean; lockHint?: string; onUnlock?: () => void;
}) {
  if (unlocked) return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xl shrink-0">{icon}</span>
      <p className="flex-1 text-[12px] font-bold text-emerald-700">{label}</p>
      <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+{count} ✅</span>
    </div>
  );
  if (locked) return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xl shrink-0 opacity-40">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-slate-400">{label}</p>
        {lockHint && <p className="text-[10px] text-slate-300 font-medium">{lockHint}</p>}
      </div>
      <span className="text-[10px] font-black text-slate-300">+{count} 🔒</span>
    </div>
  );
  const canAfford = (userCredits || 0) >= cost;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-slate-700">{label}</p>
        <p className="text-[10px] text-amber-600 font-medium">{cost}🪙 mein unlock karo</p>
      </div>
      {onUnlock && (
        <button onClick={onUnlock} disabled={!canAfford}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition active:scale-95 shrink-0 ${canAfford ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
          {canAfford ? 'Unlock' : 'Coins kam'}
        </button>
      )}
    </div>
  );
}

// ── Category Edit Sheet ───────────────────────────────────────────────────────
function CategoryEditSheet({ category, allNotes, existingCategories, routineMode, selectedClass, selectedBook, selectedBooks, onUpdateSubjects, onClose }: {
  category: RoutineCategory;
  allNotes: LucentEntry[];
  existingCategories: RoutineCategory[];
  routineMode: 'SCHOOL' | 'COMPETITION' | null;
  selectedClass: string | null;
  selectedBook: string | null;
  selectedBooks?: string[];
  onUpdateSubjects: (catId: string, subjects: RoutineCategorySubject[]) => void;
  onClose: () => void;
}) {
  const [subjects, setSubjects] = useState<RoutineCategorySubject[]>(category.subjects);

  // Available notes filtered by mode
  const modeFilteredNotes = useMemo(() => {
    if (routineMode === 'SCHOOL' && selectedClass) {
      return allNotes.filter(n => String((n as any).classLevel) === String(selectedClass));
    }
    if (routineMode === 'COMPETITION') {
      if (selectedBooks && selectedBooks.length > 0) {
        const bookSet = new Set(selectedBooks);
        return allNotes.filter(n => bookSet.has((n as any).bookName?.trim() || ''));
      }
      if (selectedBook) return allNotes.filter(n => ((n as any).bookName?.trim() || '') === selectedBook);
    }
    return allNotes;
  }, [allNotes, routineMode, selectedClass, selectedBook, selectedBooks]);

  const available = useMemo(() => getAvailableSubjectSlots(modeFilteredNotes), [modeFilteredNotes]);

  // Subjects in OTHER categories (already locked elsewhere)
  const otherCatSubjectKeys = useMemo(() => {
    const s = new Set<string>();
    existingCategories.forEach(cat => {
      if (cat.id === category.id) return;
      cat.subjects.forEach(sub => s.add(`${sub.bookName}||${sub.classLevel || ''}||${sub.subjectId}`));
    });
    return s;
  }, [existingCategories, category.id]);

  // Current subject keys (already in this category)
  const currentKeys = useMemo(() => new Set(subjects.map(s => `${s.bookName}||${s.classLevel || ''}||${s.subjectId}`)), [subjects]);

  // Available to add (not in this category, not in other categories)
  const addable = available.filter(item => {
    const key = `${item.bookName}||${item.classLevel || ''}||${item.subjectId}`;
    return !currentKeys.has(key) && !otherCatSubjectKeys.has(key);
  });

  const removeSubject = (key: string) => {
    if (subjects.length <= 1) return; // can't remove last
    const next = subjects.filter(s => `${s.bookName}||${s.classLevel || ''}||${s.subjectId}` !== key);
    setSubjects(next);
    onUpdateSubjects(category.id, next);
  };

  const addSubject = (item: ReturnType<typeof getAvailableSubjectSlots>[0]) => {
    const newSub: RoutineCategorySubject = {
      subjectId: item.subjectId,
      bookName: item.bookName,
      classLevel: item.classLevel,
      displayName: item.displayName,
      emoji: item.emoji,
      currentLessonIndex: 0,
      totalLessons: item.count,
    };
    const next = [...subjects, newSub];
    setSubjects(next);
    onUpdateSubjects(category.id, next);
  };

  return (
    <div className="fixed inset-0 z-[650] flex items-end bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-800">✏️ Category Edit Karo</h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {category.emoji} {category.categoryName} · {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:scale-90"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[72px] space-y-5">

          {/* Current subjects */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Is Category Ke Subjects</p>
            <div className="bg-[#f5f2eb] rounded-3xl border border-[#e8e4db] overflow-hidden shadow-sm">
              {subjects.map((sub, i) => {
                const key = `${sub.bookName}||${sub.classLevel || ''}||${sub.subjectId}`;
                const canRemove = subjects.length > 1;
                const notes = getNotesForSubject(sub, allNotes);
                return (
                  <div key={key} className={`flex items-center gap-3 px-4 py-3 ${i < subjects.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <span className="text-xl shrink-0">{sub.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800">{capitalise(sub.subjectId)}</p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {sub.bookName || (sub.classLevel ? `Class ${sub.classLevel}` : 'Default')} · {notes.length} lessons
                      </p>
                    </div>
                    <button
                      onClick={() => removeSubject(key)}
                      disabled={!canRemove}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition shrink-0 border ${
                        canRemove
                          ? 'bg-red-50 border-red-200 text-red-500'
                          : 'bg-slate-50 border-slate-100 text-slate-300'
                      }`}
                      title={canRemove ? 'Remove karo' : 'Akela subject nahi hat sakta'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            {subjects.length === 1 && (
              <p className="text-[10px] text-slate-400 font-medium mt-1.5 px-1">
                ⚠️ Kam se kam 1 subject zaroori hai — pehle naya add karo, phir hata sakte ho
              </p>
            )}
          </div>

          {/* Add more subjects */}
          {addable.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Add Karo</p>
              <div className="space-y-1.5">
                {addable.map(item => {
                  const key = `${item.bookName}||${item.classLevel || ''}||${item.subjectId}`;
                  return (
                    <button key={key} onClick={() => addSubject(item)}
                      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-200 bg-white active:bg-blue-50 active:border-blue-300 transition text-left">
                      <span className="text-xl shrink-0">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800">{capitalise(item.subjectId)}</p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {item.bookName || (item.classLevel ? `Class ${item.classLevel}` : 'Default')} · {item.count} lessons
                        </p>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                        <Plus size={14} className="text-white" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {addable.length === 0 && subjects.length > 0 && (
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 text-center">
              <p className="text-sm font-bold text-slate-400">Sabhi available subjects already add hain ✅</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-6 pt-3 shrink-0 border-t border-slate-100">
          <button onClick={onClose}
            className="w-full py-3.5 rounded-2xl font-black text-sm bg-emerald-600 text-white shadow-sm active:scale-[0.98] transition">
            ✅ Done — Changes Save Ho Gaye
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category Manager Sheet ────────────────────────────────────────────────────
function CategoryManagerSheet({ categories, tier, level, userCredits, data, onRemove, onEdit, onUnlockTier, onAddOpen, onClose }: {
  categories: RoutineCategory[]; tier: UserSubTier; level: number; userCredits: number;
  data: RoutineData; onRemove: (id: string) => void; onEdit: (catId: string) => void;
  onUnlockTier: () => void;
  onAddOpen: () => void; onClose: () => void;
}) {
  const base = getBaseSlotCount(tier);
  const actualMax = getActualMaxSlots(tier, level, data);
  const tierCost = getTierSlotCost(tier);
  const usedCount = categories.length;
  const freeBase = 2;
  const exclusiveBase = base - freeBase;

  return (
    <div className="fixed inset-0 z-[500] flex items-end bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-800">⚙️ My Categories</h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{usedCount}/{actualMax} slots · 1 lesson/day per slot</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:scale-90"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[72px] space-y-4">
          {usedCount < actualMax ? (
            <button onClick={onAddOpen}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 text-white font-black text-sm active:scale-[0.98] transition shadow-sm">
              <Plus size={16} /> Category Add Karo
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 text-slate-400 font-black text-sm border border-slate-200">
              <Lock size={14} /> Sab slots bhar gaye ({usedCount}/{actualMax})
            </div>
          )}

          {categories.length > 0 ? (
            <div className="bg-[#f5f2eb] rounded-3xl border border-[#e8e4db] overflow-hidden shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 pt-3 pb-1">Active Categories</p>
              {categories.map((cat, i) => (
                <div key={cat.id} className={`flex items-center gap-3 px-4 py-3 ${i < categories.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <span className="text-xl shrink-0">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{cat.categoryName}</p>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {cat.subjects.map(s => capitalise(s.subjectId)).join(', ')} · {cat.subjects.length} subject{cat.subjects.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <button onClick={() => onEdit(cat.id)}
                    className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center active:scale-90 transition shrink-0 mr-1">
                    <span className="text-[13px]">✏️</span>
                  </button>
                  <button onClick={() => onRemove(cat.id)}
                    className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center active:scale-90 transition shrink-0">
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5 text-center">
              <p className="text-sm font-black text-blue-700 mb-1">Koi category nahi hai abhi</p>
              <p className="text-xs text-blue-600 font-medium">Upar "Category Add Karo" tap karo</p>
            </div>
          )}

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Slot Breakdown</p>
            <SlotRow icon="🔓" label="Free Slots (sabke liye)" count={freeBase} unlocked={true} cost={0} />
            {exclusiveBase > 0 && (
              <SlotRow icon="⭐" label={`${tier === 'MAX_PRO' ? 'Ultra' : 'Basic'} Plan Slots`} count={exclusiveBase} unlocked={true} cost={0} />
            )}
            <SlotRow icon="🪙" label="Extra Slot (Coin Unlock)" count={1}
              unlocked={data.unlockedTierSlot} cost={tierCost} userCredits={userCredits}
              onUnlock={!data.unlockedTierSlot ? onUnlockTier : undefined} />
            <SlotRow icon="🏆" label="Level 5 Bonus Slot" count={1}
              unlocked={level >= 5} cost={0} userCredits={userCredits}
              locked={level < 5} lockHint={level < 5 ? `Level 5 achieve karo — auto unlock hoga! (aap Level ${level} par hain)` : undefined} />
            <SlotRow icon="🏆" label="Level 8 Bonus Slot" count={1}
              unlocked={level >= 8} cost={0} userCredits={userCredits}
              locked={level < 8} lockHint={level < 8 ? `Level 8 achieve karo — auto unlock hoga! (aap Level ${level} par hain)` : undefined} />
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
              <p className="text-xs font-black text-slate-700">Total Available</p>
              <span className="text-sm font-black text-blue-600">{actualMax} slots</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
interface MyRoutineProps {
  user: {
    id: string; totalScore?: number; level?: number;
    isPremium?: boolean; subscriptionLevel?: string; subscriptionEndDate?: string;
    mcqHistory?: any[];
    credits?: number; bonusCredits?: number;
  };
  lucentNotes?: any[];
  onBack: () => void;
  onUserUpdate?: (u: any) => void;
  /** Navigate to Revision Hub tab — receives lessonId so caller can apply 50-coin discount */
  onGoToRevision?: (lessonId: string, lessonTitle?: string) => void;
  settings?: any;
  onOpenRevisionHub?: (lessonId?: string, lessonTitle?: string, autoStartMcq?: boolean) => void;
  onPracticeMistakes?: (mistakes: any[]) => void;
  onOpenLesson?: (lessonId: string) => void;
  onStartChallenge20?: (challenge: any) => void;
  onClaimChallenge20?: (challenge: any) => void | Promise<void>;
  challenge20s?: any[];
}

export const MyRoutine: React.FC<MyRoutineProps> = ({ user, lucentNotes = [], onBack, onUserUpdate, onGoToRevision, settings, onOpenRevisionHub, onPracticeMistakes, onOpenLesson, onStartChallenge20, onClaimChallenge20, challenge20s = [] }) => {
  const userId = user?.id || 'guest';
  const mcqHistory: any[] = user?.mcqHistory || [];
  const subTier: UserSubTier = getUserSubTier(user);
  const userLevel = getLevelInfo(user?.totalScore || 0).level;
  const allNotes: LucentEntry[] = useMemo(() => (lucentNotes || []), [lucentNotes]);

  // data must be declared before routineNotes useMemo — dep array references data.routineMode
  // (declaring after causes TDZ crash in production builds)
  const [data, setDataRaw] = useState<RoutineData>(() => {
    const d = loadRoutineData(userId);
    const reset = checkAndResetDaily(d);
    return ensureTodayClaimEntry(reset, getUserSubTier(user));
  });

  // In SCHOOL mode (class 6–12), exclude Competition-level notes so they never
  // leak into school routine slots — even for "default" subjects that have no
  // classLevel filter of their own.
  const routineNotes = useMemo(() => {
    if (data.routineMode === 'SCHOOL') {
      return allNotes.filter(n => {
        if ((n as any).classLevel === 'COMPETITION') return false;

        // Filter by user's selected board
        if (data.selectedBoard && data.selectedBoard !== 'ALL_BOARDS' && data.selectedBoard !== '') {
           const noteBoard = (n as any).board;
           if (noteBoard && noteBoard !== data.selectedBoard && noteBoard !== 'ALL_BOARDS') return false;
        }
        return true;
      });
    }
    return allNotes;
  }, [allNotes, data.routineMode, data.selectedBoard]);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [showRoutineSetup, setShowRoutineSetup] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [activeView, setActiveView] = useState<'home' | 'subjects' | 'tracking'>('home');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' | 'coin' } | null>(null);
  const [tick, setTick] = useState(0);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'coin' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const setData = useCallback((updater: (prev: RoutineData) => RoutineData) => {
    setDataRaw(prev => {
      const next = updater(prev);
      saveRoutineData(userId, next);
      scheduleRoutineSync(userId, next); // debounced Firebase backup
      return next;
    });
  }, [userId]);

  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  // Firebase hydration — reload state when cloud restore completes on this device
  useEffect(() => {
    const handler = () => {
      const fresh = loadRoutineData(userId);
      const reset = checkAndResetDaily(fresh);
      setDataRaw(reset);
    };
    window.addEventListener('iic-routine-hydrated', handler);
    return () => window.removeEventListener('iic-routine-hydrated', handler);
  }, [userId]);

  // Sync totalLessons for categories when notes load
  useEffect(() => {
    if (!routineNotes.length) return;
    setData(prev => {
      const cats = (prev.routineCategories || []).map(cat => {
        const subjects = cat.subjects.map(sub => {
          const count = getNotesForSubject(sub, routineNotes).length;
          return count !== sub.totalLessons ? { ...sub, totalLessons: count } : sub;
        });
        const changed = subjects.some((s, i) => s !== cat.subjects[i]);
        return changed ? { ...cat, subjects } : cat;
      });
      if (cats.every((c, i) => c === (prev.routineCategories || [])[i])) return prev;
      return { ...prev, routineCategories: cats };
    });
  }, [allNotes.length]);

  // All notes from all category subjects (for Subjects/Tracking tabs)
  const allSlotNotes = useMemo(() => {
    const cats = data.routineCategories || [];
    if (!cats.length) return [];
    const seen = new Set<string>();
    const result: LucentEntry[] = [];
    for (const cat of cats) {
      for (const sub of cat.subjects) {
        for (const n of getNotesForSubject(sub, routineNotes)) {
          if (!seen.has(n.id)) { seen.add(n.id); result.push(n); }
        }
      }
    }
    return result;
  }, [data.routineCategories, routineNotes, tick]);

  const subjectGroups = useMemo(() => buildSubjectGroups(allSlotNotes), [allSlotNotes]);
  const subjects = useMemo(() => buildSubjectConfigs(allSlotNotes, data.subjects), [allSlotNotes, data.subjects]);

  // ── Category management ───────────────────────────────────────────────────────
  const handleAddCategory = useCallback((catData: Omit<RoutineCategory, 'id'>) => {
    const newCat: RoutineCategory = {
      ...catData,
      id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      subjects: catData.subjects.map(sub => ({
        ...sub,
        totalLessons: getNotesForSubject(sub, routineNotes).length,
        currentLessonIndex: 0,
      })),
    };
    setData(prev => ({ ...prev, routineCategories: [...(prev.routineCategories || []), newCat] }));
    showToast(`✅ "${catData.categoryName}" add ho gaya!`, 'success');
  }, [allNotes, showToast]);

  const handleRemoveCategory = useCallback((catId: string) => {
    setData(prev => ({ ...prev, routineCategories: (prev.routineCategories || []).filter(c => c.id !== catId) }));
    showToast('Category remove ho gayi', 'info');
  }, [showToast]);

  const handleUpdateCategorySubjects = useCallback((catId: string, newSubjects: RoutineCategorySubject[]) => {
    setData(prev => ({
      ...prev,
      routineCategories: (prev.routineCategories || []).map(c =>
        c.id === catId
          ? { ...c, subjects: newSubjects, currentSubjectIndex: Math.min(c.currentSubjectIndex, Math.max(0, newSubjects.length - 1)) }
          : c
      ),
    }));
  }, []);

  const SUBJECT_SWITCH_COST = 500;

  const handleSwitchSubject = useCallback((catId: string, newSubjectIndex: number, taskIsLive: boolean) => {
    const cost = taskIsLive ? SUBJECT_SWITCH_COST : 0;
    if (cost > 0) {
      const balance = (user.credits || 0) + (user.bonusCredits || 0);
      if (balance < cost) { showToast(`Coins kam hain! Chahiye: ${cost}🪙 subject switch ke liye`, 'error'); return; }
      if (onUserUpdate) { const u = { ...user, credits: Math.max(0, (user.credits || 0) - cost) }; onUserUpdate(u); try { saveUserToLive(u); } catch (_) {} }
      showToast(`Subject switch! −${cost}🪙`, 'coin');
    }
    setData(prev => {
      const cats = (prev.routineCategories || []).map(c =>
        c.id === catId ? { ...c, currentSubjectIndex: newSubjectIndex } : c
      );
      return { ...prev, routineCategories: cats };
    });
  }, [user, onUserUpdate, showToast]);

  const deductCoins = useCallback((cost: number, onSuccess: () => void) => {
    const balance = (user.credits || 0);
    if (balance < cost) { showToast(`Coins kam hain! Chahiye: ${cost}🪙`, 'error'); return; }
    if (onUserUpdate) { const u = { ...user, credits: balance - cost }; onUserUpdate(u); try { saveUserToLive(u); } catch (_) {} }
    onSuccess();
  }, [user, onUserUpdate, showToast]);

  const handleUnlockTierSlot = useCallback(() => {
    const cost = getTierSlotCost(subTier);
    deductCoins(cost, () => { setData(prev => ({ ...prev, unlockedTierSlot: true })); showToast(`🎉 Extra slot unlock! −${cost}🪙`, 'coin'); });
  }, [subTier, deductCoins, showToast]);

  // ── Category lesson complete: advance lesson within subject, then rotate to next subject ──
  const handleCategoryLessonComplete = useCallback((catId: string, lessonId: string) => {
    if (isLessonRewarded(lessonId)) return;
    markLessonRewarded(lessonId);
    setData(prev => {
      const cats = [...(prev.routineCategories || [])];
      const ci = cats.findIndex(c => c.id === catId);
      if (ci >= 0) {
        const cat = { ...cats[ci] };
        const subjects = [...cat.subjects];
        const si = cat.currentSubjectIndex % subjects.length;
        const sub = { ...subjects[si] };
        // Advance lesson within this subject
        const notes = getNotesForSubject(sub, routineNotes);
        const total = notes.length;
        let nextLesson = sub.currentLessonIndex + 1;
        if (total > 0 && nextLesson >= total) nextLesson = 0;
        subjects[si] = { ...sub, currentLessonIndex: nextLesson, totalLessons: total };
        // Rotate to next subject
        cat.subjects = subjects;
        cat.currentSubjectIndex = (si + 1) % subjects.length;
        cats[ci] = cat;
      }
      let next = { ...prev, coins: prev.coins + LESSON_COMPLETE_REWARD, routineCategories: cats };
      return next;
    });
    const note = allNotes.find(n => n.id === lessonId);

    // ── Schedule completed lesson for Revision Hub review (due tomorrow) ──
    try {
      scheduleRoutineLessonForRevision({
        lessonId,
        subjectId: (note as any)?.subject || 'routine',
        subjectName: (note as any)?.subject,
        lessonTitle: (note as any)?.lessonTitle || lessonId,
      });
    } catch { /* ignore — revision scheduling is non-critical */ }
    import('../utils/sessionNotify').then(({ fireSessionComplete }) => {
      const noteContentType = (note as any)?.contentType as string | undefined;
      const activityType = noteContentType === 'NOTES'
        ? 'Reading'
        : noteContentType === 'MCQ'
          ? 'MCQ'
          : 'Reading';
      fireSessionComplete({
        type: 'LESSON',
        subject: (note as any)?.subject || 'Routine',
        chapter: (note as any)?.lessonTitle || lessonId,
        timeSecs: 0,
        coinsEarned: LESSON_COMPLETE_REWARD,
        activityType,
        sessionScore: ptsEarned,
      });
    }).catch(() => {});
  }, [allNotes]);

  // ── Subjects tab helpers ─────────────────────────────────────────────────────
  const handleToggleApply = (subId: string) => {
    setData(prev => ({ ...prev, subjects: prev.subjects.map(s => s.id === subId ? { ...s, routineApplied: !s.routineApplied } : s) }));
  };
  const handleCatChangeStart = (catId: string, subjectId: string, newIdx: number) => {
    setData(prev => {
      const cats = [...(prev.routineCategories || [])];
      const ci = cats.findIndex(c => c.id === catId);
      if (ci === -1) return prev;

      const cat = { ...cats[ci] };
      const subjects = [...cat.subjects];
      const si = subjects.findIndex(s => s.subjectId === subjectId);
      if (si === -1) return prev;

      const sub = subjects[si];
      const cost = getSkipCost(sub.currentLessonIndex, newIdx);
      const userCredits = (user.credits || 0) + (user.bonusCredits || 0);

      if (cost > userCredits) {
        showToast(`Coins kam hain! Chahiye: ${cost}🪙`, 'error');
        return prev;
      }

      if (cost > 0 && onUserUpdate) {
        const u = { ...user, credits: Math.max(0, (user.credits || 0) - cost) };
        onUserUpdate(u);
        try { saveUserToLive(u); } catch (_) {}
      }

      subjects[si] = { ...sub, currentLessonIndex: newIdx };
      cat.subjects = subjects;
      cats[ci] = cat;

      const next = { ...prev, routineCategories: cats };
      syncRoutineNow(userId, next);
      return next;
    });
  };

  const handleChangeStart = (subId: string, newIdx: number) => {
    const sub = data.subjects.find(s => s.id === subId);
    if (!sub) return;
    const cost = getSkipCost(sub.startLessonIndex, newIdx);
    const userCredits = (user.credits || 0) + (user.bonusCredits || 0);
    if (cost > userCredits) { showToast(`Coins kam hain! Chahiye: ${cost}🪙`, 'error'); return; }
    if (cost > 0 && onUserUpdate) { const u = { ...user, credits: Math.max(0, (user.credits || 0) - cost) }; onUserUpdate(u); try { saveUserToLive(u); } catch (_) {} }
    setData(prev => ({ ...prev, subjects: prev.subjects.map(s => s.id === subId ? { ...s, startLessonIndex: newIdx, currentLessonIndex: newIdx } : s) }));
  };

  const toggleRoutine = () => {
    const on = !data.enabled;
    setData(prev => ({ ...prev, enabled: on }));
    showToast(on ? 'Routine ON! 🎯 Daily tasks active' : 'Routine OFF', on ? 'success' : 'info');
  };


  const dailyAmount = getDailyClaimAmount(subTier);
  const userCredits = (user.credits || 0) + (user.bonusCredits || 0);
  const categories = data.routineCategories || [];
  const actualMaxSlots = getActualMaxSlots(subTier, userLevel, data);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col h-[100dvh] w-screen overflow-hidden">

      {showRoutineSetup && (
        <RoutineSetupSheet
          allNotes={allNotes}
          currentMode={data.routineMode}
          currentBoard={data.selectedBoard ?? null}
          currentClass={data.selectedClass}
          currentBooks={data.selectedBooks || []}
          onSave={(mode, board, classLevel, books) => {
            setData(prev => {
              // Build storage key for the current (old) class/book context
              const oldKey = prev.routineMode === 'SCHOOL' && prev.selectedClass
                ? `SCHOOL_${prev.selectedClass}`
                : prev.routineMode === 'COMPETITION' && (prev.selectedBooks || []).length > 0
                  ? `COMPETITION_${[...(prev.selectedBooks || [])].sort().join('+')}`
                  : null;

              // Build storage key for the new class/book context
              const newKey = mode === 'SCHOOL' && classLevel
                ? `SCHOOL_${classLevel}`
                : mode === 'COMPETITION' && books.length > 0
                  ? `COMPETITION_${[...books].sort().join('+')}`
                  : null;

              // Save current categories under old key (so switching back restores them)
              const byClass: Record<string, any[]> = { ...(prev.routineCategoriesByClass || {}) };
              if (oldKey) {
                byClass[oldKey] = prev.routineCategories || [];
              }

              // Restore saved categories for new key, or start fresh if never used before
              const restoredCats = (newKey && byClass[newKey]) ? byClass[newKey] : [];

              const next = {
                ...prev,
                routineMode: mode,
                selectedBoard: board,
                selectedClass: classLevel,
                selectedBooks: books,
                selectedBook: books[0] || null,
                routineCategories: restoredCats,
                routineCategoriesByClass: byClass,
              };
              // Immediate Firebase sync — config change is important
              syncRoutineNow(userId, next);
              window.dispatchEvent(new CustomEvent('iic-routine-updated'));
              return next;
            });
            setShowRoutineSetup(false);
          }}
          onClose={() => setShowRoutineSetup(false)}
        />
      )}
      {showCatManager && (
        <CategoryManagerSheet categories={categories} tier={subTier} level={userLevel} userCredits={userCredits} data={data}
          onRemove={handleRemoveCategory}
          onEdit={catId => { setShowCatManager(false); setEditingCatId(catId); }}
          onUnlockTier={handleUnlockTierSlot}
          onAddOpen={() => {
            if (!data.routineMode) { setShowCatManager(false); setShowRoutineSetup(true); return; }
            setShowCatManager(false); setShowAddCat(true);
          }}
          onClose={() => setShowCatManager(false)} />
      )}
      {editingCatId && (() => {
        const editCat = categories.find(c => c.id === editingCatId);
        if (!editCat) return null;
        return (
          <CategoryEditSheet
            category={editCat}
            allNotes={allNotes}
            existingCategories={categories}
            routineMode={data.routineMode}
            selectedClass={data.selectedClass}
            selectedBook={data.selectedBook}
            selectedBooks={data.selectedBooks || []}
            onUpdateSubjects={handleUpdateCategorySubjects}
            onClose={() => { setEditingCatId(null); setShowCatManager(true); }}
          />
        );
      })()}
      {showAddCat && (
        <AddCategorySheet
          allNotes={allNotes}
          existingCategories={categories}
          onAdd={handleAddCategory}
          routineMode={data.routineMode}
          selectedClass={data.selectedClass}
          selectedBook={data.selectedBook}
          selectedBooks={data.selectedBooks || []}
          onClose={() => { setShowAddCat(false); setShowCatManager(true); }}
        />
      )}

      {showInfo && (
        <div className="fixed inset-0 z-[500] flex items-end bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowInfo(false)}>
          <div className="w-full bg-white rounded-t-3xl max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-800">Routine se kya fayda?</h2>
              <button onClick={() => setShowInfo(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { title: '✅ Routine ON', color: 'green', items: ['Lesson complete → +10🪙', 'Revision Hub permanently unlock', 'Multiple subjects daily!'] },
                  { title: '❌ Routine OFF', color: 'red', items: ['Koi coin reward nahi', 'Revision Hub unlock nahi', 'Normal access'] },
                ] as const).map(col => (
                  <div key={col.title} className={`rounded-2xl border-2 p-3.5 ${col.color === 'green' ? 'border-green-200 bg-green-50' : 'border-red-100 bg-red-50'}`}>
                    <p className={`text-xs font-black uppercase tracking-wide mb-2.5 ${col.color === 'green' ? 'text-green-700' : 'text-red-600'}`}>{col.title}</p>
                    {col.items.map((pt, i) => (
                      <div key={i} className="flex items-start gap-1.5 mb-1.5">
                        {col.color === 'green'
                          ? <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0" />
                          : <XCircle size={12} className="text-red-400 mt-0.5 shrink-0" />}
                        <p className={`text-[11px] font-medium leading-snug ${col.color === 'green' ? 'text-green-800' : 'text-red-700'}`}>{pt}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-black text-slate-600 mb-2">Slot Types</p>
                {[
                  { icon: '🔓', text: 'Free — sabke liye (2 slots)' },
                  { icon: '⭐', text: 'Basic/Ultra plan exclusive slots' },
                  { icon: '🪙', text: 'Coins se unlock karo (tier ke hisaab se price)' },
                  { icon: '🏆', text: 'Level reward (Level 5 & Level 8 par milega)' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-base">{item.icon}</span>
                    <p className="text-[11px] text-slate-600 font-medium">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 pb-6">
              <button onClick={() => setShowInfo(false)} className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm active:scale-[0.98] transition">Samajh gaya! 👍</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shrink-0">
        {/* Row 1: back · title · actions */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition shrink-0">
            <ChevronLeft size={20} className="text-slate-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-slate-900 text-sm flex items-center gap-1">
              <CalendarCheck size={15} className="text-blue-600 shrink-0" /> My Routine
            </h1>
          </div>
          {/* Routine ON/OFF toggle — compact */}
          <button onClick={toggleRoutine}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 shrink-0 ${data.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
            title={data.enabled ? 'Routine ON' : 'Routine OFF'}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${data.enabled ? 'left-6' : 'left-0.5'}`} />
          </button>
          <button onClick={() => setShowInfo(true)} className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center active:scale-90 shrink-0">
            <HelpCircle size={15} className="text-indigo-500" />
          </button>
          {/* Settings button — Class & Category */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowSettingsMenu(s => !s)}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition"
            >
              <Settings size={15} className="text-slate-600" />
            </button>
            {showSettingsMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSettingsMenu(false)} />
                <div className="absolute right-0 top-10 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 w-52 overflow-hidden">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 pt-3 pb-1">Settings</p>
                  <button
                    onClick={() => { setShowSettingsMenu(false); setShowRoutineSetup(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition text-left"
                  >
                    <span className="text-base">🏫</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-slate-800">Class / Mode</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {data.routineMode === 'SCHOOL' && data.selectedClass
                          ? `Class ${data.selectedClass}`
                          : data.routineMode === 'COMPETITION' && (data.selectedBooks?.length || data.selectedBook)
                          ? `${data.selectedBooks?.length ? `${data.selectedBooks.length} books` : data.selectedBook}`
                          : 'Setup nahi hai'}
                      </p>
                    </div>
                    <span className="text-slate-400 text-xs">✎</span>
                  </button>
                  <div className="h-px bg-slate-100 mx-4" />
                  <button
                    onClick={() => { setShowSettingsMenu(false); setShowCatManager(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition text-left"
                  >
                    <span className="text-base">📂</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-slate-800">Categories</p>
                      <p className="text-[10px] text-slate-400">
                        {categories.length === 0 ? 'Koi category nahi' : `${categories.length} categories`}
                      </p>
                    </div>
                    <span className="text-slate-400 text-xs">✎</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Row 2: tab bar — always visible */}
        <div className="mx-4 mb-2 flex bg-slate-100 rounded-2xl p-1 gap-1">
          <button onClick={() => setActiveView('home')}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-black transition-all ${activeView === 'home' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            🎯 Daily Hub
          </button>
          <button onClick={() => setActiveView('subjects')}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-black transition-all ${activeView === 'subjects' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            📚 Subjects
          </button>
          <button onClick={() => setActiveView('tracking')}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-black transition-all ${activeView === 'tracking' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            📊 Tracking
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed top-16 left-4 right-4 z-[600] py-3 px-4 rounded-2xl font-black text-sm text-center shadow-xl ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
          toast.type === 'coin' ? 'bg-amber-400 text-white' :
          'bg-slate-800 text-white'
        }`}>{toast.msg}</div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain pb-24">

        {/* TODAY */}
        {activeView === 'home' && (
          <div className="mx-4 mt-4 space-y-3">
            {!data.enabled ? (
              <div className="bg-[#f5f2eb] rounded-3xl border border-[#e8e4db] p-8 text-center">
                <CalendarCheck size={44} className="text-slate-200 mx-auto mb-3" />
                <p className="font-black text-slate-700 mb-1">Routine OFF Hai</p>
                <p className="text-sm text-slate-500 mb-4">ON karo daily tasks dekhne ke liye</p>
                <button onClick={toggleRoutine} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-black text-sm active:scale-95 transition">Routine ON Karo</button>
              </div>
            ) : categories.length === 0 ? (
              <>
                <DailyEventPage
                  user={user as any}
                  settings={settings}
                  onBack={onBack}
                  onOpenRoutine={() => setActiveView('subjects')}
                  onOpenRevisionHub={onOpenRevisionHub || (() => {})}
                  onPracticeMistakes={onPracticeMistakes || (() => {})}
                  onOpenSubjects={() => setActiveView('subjects')}
                  onOpenTracking={() => setActiveView('tracking')}
                  onOpenLesson={onOpenLesson}
                   onUpdateUser={onUserUpdate}
                  challenge20s={challenge20s}
                  onStartChallenge20={onStartChallenge20}
                   onClaimChallenge20={onClaimChallenge20}
                />
                <div className="bg-[#f5f2eb] rounded-3xl border border-[#e8e4db] p-8 text-center">
                  <span className="text-5xl mb-3 block">📚</span>
                  <p className="font-black text-slate-700 mb-1">Koi Category Nahi</p>
                  <p className="text-sm text-slate-500 mb-4">Pehle ek category add karo — phir daily task shuru hoga</p>
                  <button onClick={() => setShowCatManager(true)}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-black text-sm active:scale-95 transition">
                    + Category Add Karo
                  </button>
                </div>
              </>
            ) : (
              <DailyEventPage
                user={user as any}
                settings={settings}
                onBack={onBack}
                onOpenRoutine={() => setActiveView('subjects')}
                onOpenRevisionHub={onOpenRevisionHub || (() => {})}
                onPracticeMistakes={onPracticeMistakes || (() => {})}
                onOpenSubjects={() => setActiveView('subjects')}
                onOpenTracking={() => setActiveView('tracking')}
                onOpenLesson={onOpenLesson}
                 onUpdateUser={onUserUpdate}
                challenge20s={challenge20s}
                onStartChallenge20={onStartChallenge20}
                 onClaimChallenge20={onClaimChallenge20}
              />
            )}
          </div>
        )}

        {/* SUBJECTS */}
        {activeView === 'subjects' && (
          <div className="mx-4 mt-4 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{categories.length} Categories</p>
            </div>

            {categories.length === 0 ? (
              <div className="bg-[#f5f2eb] rounded-3xl border border-[#e8e4db] p-6 text-center">
                <p className="text-sm text-slate-400">Daily Hub mein categories add karo pehle</p>
              </div>
            ) : categories.map(cat => (
              <div key={cat.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-3 shadow-sm space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xl">{cat.emoji}</span>
                  <h3 className="font-black text-slate-800 text-sm">{cat.categoryName}</h3>
                </div>
                <div className="space-y-3">
                  {cat.subjects.map(sub => (
                    <CatSubjectCard
                      key={`${cat.id}-${sub.subjectId}`}
                      catId={cat.id}
                      sub={sub}
                      lessons={getNotesForSubject(sub, routineNotes)}
                      mcqHistory={mcqHistory}
                      coins={userCredits}
                      onChangeStart={handleCatChangeStart}
                      onCoinFlash={(msg) => showToast(msg, msg.includes('kam') ? 'error' : msg.includes('−') ? 'coin' : 'success')}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TRACKING */}
        {activeView === 'tracking' && (
          <div className="mx-4 mt-4">
            <TrackingView subjectGroups={subjectGroups} subjects={subjects} mcqHistory={mcqHistory} />
          </div>
        )}

      </div>
    </div>
  );
};
