// @ts-nocheck
/**
 * Revision Hub V2 — Spaced-Repetition + Pure Local-Search (No AI)
 *
 * Cycle:
 *  MCQ galat → Notes due tomorrow → MCQ due after → good score → longer interval
 *
 * Notes finding: local storage ke sabhi cached chapters mein wrong-question words
 * se match karta hai, jitna zyada match utna pehle dikhega. AI use nahi hota.
 *
 * Tabs:
 *  [Aaj Ka Kaam] — today's notes + MCQ due
 *  [Schedule]    — full upcoming schedule + how it works info
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { VirtualList } from './VirtualList';
import { RevisionSession } from './RevisionSession';
import { TodayAllNotesModal } from './TodayAllNotesModal';
import {
  ArrowLeft, BrainCircuit, BookOpen, Trash2, ChevronRight, Sparkles,
  CheckCircle, ChevronDown, ChevronUp, Zap, Clock,
  RefreshCw, Target, Search, FileText, AlertCircle, ListChecks,
  BarChart3, Eye, Trophy, XCircle, RotateCcw,
} from 'lucide-react';
import type { SystemSettings, User, StudentTab, TopicItem } from '../types';
import { TodayMcqSession } from './TodayMcqSession';
import { setMcqNotifSuppressed } from '../utils/creditNotify';
import {
  getDueItems, getUpcomingItems, markNotesReviewed, markMcqDone,
  clearTracker, getAllBuckets, bucketKey, keywordsForBucket,
  getTopicNote,
  type WeakBucket
} from '../utils/revisionTrackerV2';
import { searchNotesByWords, type NoteSearchResult } from '../utils/noteSearcher';

interface Props {
  user: User;
  settings?: SystemSettings;
  onBack: () => void;
  onOpenChapter?: (subjectId: string, chapterId: string, chapterTitle?: string) => void;
  onOpenMcq?: (subjectId: string, chapterId: string, chapterTitle?: string, topic?: string) => void;
  onTabChange?: (tab: StudentTab) => void;
  onNavigateContent?: (type: 'PDF' | 'MCQ', chapterId: string, topicName?: string, subjectName?: string) => void;
  onUpdateUser?: (u: User) => void;
  hideHeader?: boolean;
  onMcqAnswer?: (isCorrect: boolean) => boolean;
  /** Called before starting a Revision Hub MCQ session; call confirm() to proceed */
  onBeforeMcqOpen?: (confirm: () => void) => void;
}

type ActiveTab = 'daily' | 'results';

function daysUntil(ts: number): string {
  const diff = ts - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600) % 24;
  const d = Math.floor(total / 86400);
  if (d > 0) return `${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/** Day-based countdown for upcoming topics.
 *  Returns "Due Today", "Kal · HH:MM:SS", "2 din", etc.
 *  The live part (HH:MM:SS) is time-to-midnight so it updates every second. */
function formatDayLabel(nextDueAt: number, now: number): { label: string; sub: string | null; isDue: boolean } {
  const todayStart = (() => { const d = new Date(now); d.setHours(0,0,0,0); return d.getTime(); })();
  const dueStart   = (() => { const d = new Date(nextDueAt); d.setHours(0,0,0,0); return d.getTime(); })();
  const dayDiff    = Math.round((dueStart - todayStart) / 86400000);

  if (dayDiff <= 0) return { label: 'Due Today', sub: null, isDue: true };

  const midnight   = todayStart + 86400000;          // tonight 00:00:00
  const msToMidnight = midnight - now;

  if (dayDiff === 1) {
    return { label: 'Kal aayega', sub: formatCountdown(msToMidnight), isDue: false };
  }
  return { label: `${dayDiff} din baad`, sub: null, isDue: false };
}

function accuracyColor(acc: number): string {
  if (acc < 0.3) return 'rose';
  if (acc < 0.5) return 'orange';
  if (acc < 0.7) return 'amber';
  return 'emerald';
}

interface SubjectGroup {
  subjectId: string;
  subjectName: string;
  chapters: ChapterGroup[];
}
interface ChapterGroup {
  chapterId: string;
  chapterTitle: string;
  buckets: WeakBucket[];
}

function groupBySubjectChapter(items: WeakBucket[]): SubjectGroup[] {
  const map: Record<string, SubjectGroup> = {};
  for (const b of items) {
    const sid = b.subjectId;
    const sname = b.subjectName || sid;
    if (!map[sid]) map[sid] = { subjectId: sid, subjectName: sname, chapters: [] };
    const sg = map[sid];
    let cg = sg.chapters.find(c => c.chapterId === b.chapterId);
    if (!cg) {
      cg = { chapterId: b.chapterId, chapterTitle: b.chapterTitle || b.chapterId, buckets: [] };
      sg.chapters.push(cg);
    }
    cg.buckets.push(b);
  }
  return Object.values(map);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export const RevisionHubV2: React.FC<Props> = (props) => {
  const { user, settings, onBack, onOpenChapter, onOpenMcq, onTabChange, onNavigateContent, onUpdateUser, hideHeader = false, onMcqAnswer } = props;
  const revisionConfig = settings?.revisionConfig;

  const [activeTab, setActiveTab] = useState<ActiveTab>('daily');
  const [dueItems, setDueItems] = useState<WeakBucket[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<WeakBucket[]>([]);
  const [totalTracked, setTotalTracked] = useState(0);
  const [allBuckets, setAllBuckets] = useState<WeakBucket[]>([]);

  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [noteResults, setNoteResults] = useState<Record<string, NoteSearchResult[]>>({});
  const [loadingNotes, setLoadingNotes] = useState<Record<string, boolean>>({});
  const [selfRateKey, setSelfRateKey] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lastRatedTopic, setLastRatedTopic] = useState<string | null>(null);
  const [perfFilter, setPerfFilter] = useState<'all' | 'weak' | 'average' | 'strong' | 'mastered'>('all');
  const [activeRevSession, setActiveRevSession] = useState<WeakBucket | null>(null);
  const [showAllNotesModal, setShowAllNotesModal] = useState(false);

  // ── Real MCQ session (TodayMcqSession) state ────────────────────────────
  const [revMcqSessionActive, setRevMcqSessionActive] = useState(false);
  const [revMcqTopics, setRevMcqTopics] = useState<TopicItem[]>([]);

  // MCQ session chalne ke dauran sab notifications mute karo
  const revMcqTopicsRef = React.useRef<TopicItem[]>([]);
  useEffect(() => { revMcqTopicsRef.current = revMcqTopics; }, [revMcqTopics]);
  useEffect(() => {
    setMcqNotifSuppressed(revMcqSessionActive);
    const t0 = revMcqTopicsRef.current[0];
    window.dispatchEvent(new CustomEvent('iic-mcq-session', {
      detail: {
        active: revMcqSessionActive,
        chapterName: t0?.chapterName || t0?.name || '',
        subjectName: t0?.subjectName || '',
        activityType: 'MCQ',
      }
    }));
    return () => { if (revMcqSessionActive) { setMcqNotifSuppressed(false); window.dispatchEvent(new CustomEvent('iic-mcq-session', { detail: { active: false, activityType: 'MCQ' } })); } };
  }, [revMcqSessionActive]);

  // ── Inline "Practice All" MCQ session state ──────────────────────────────
  type PracticeQ = { question: string; correctOption: string; allOptions?: string[]; topic: string; bucketKey: string };
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceQs, setPracticeQs] = useState<PracticeQ[]>([]);
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [practiceRevealed, setPracticeRevealed] = useState(false);
  const [practiceSelected, setPracticeSelected] = useState<number | null>(null);
  const [practiceScores, setPracticeScores] = useState<Record<string, { got: number; total: number }>>({});
  const [practiceDone, setPracticeDone] = useState(false);

  // Live clock — ticks every second for countdown timers
  const [now, setNow] = useState(Date.now());
  const upcomingRef = useRef<WeakBucket[]>([]);

  const reload = useCallback(() => {
    const due = getDueItems();
    setDueItems(due);
    const upcoming = getUpcomingItems(1);
    setUpcomingItems(upcoming);
    upcomingRef.current = upcoming;
    const all = getAllBuckets();
    setAllBuckets(all);
    setTotalTracked(all.filter(b => b.wrongQuestions.length > 0).length);
    setNoteResults({});
    setLoadingNotes({});
    setSelfRateKey(null);
  }, []);

  // Every second: update clock + auto-reload when any upcoming topic becomes due
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (upcomingRef.current.some(b => b.nextDueAt && b.nextDueAt <= n)) {
        reload();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [reload]);

  useEffect(() => { reload(); }, []);

  const dueNotes = useMemo(() => dueItems.filter(b => !b.stage || b.stage === 'NOTES'), [dueItems]);
  const dueMcq   = useMemo(() => dueItems.filter(b => b.stage === 'MCQ'),               [dueItems]);

  const notesGroups    = useMemo(() => groupBySubjectChapter(dueNotes),    [dueNotes]);
  const mcqGroups      = useMemo(() => groupBySubjectChapter(dueMcq),      [dueMcq]);

  const toggleChapter = (key: string) =>
    setExpandedChapters(p => ({ ...p, [key]: !p[key] }));

  // ── Load matching notes for a bucket from local storage (no AI) ──────────
  const loadNotesForBucket = useCallback(async (b: WeakBucket) => {
    const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
    if (noteResults[k] !== undefined || loadingNotes[k]) return;

    setLoadingNotes(p => ({ ...p, [k]: true }));
    try {
      // 1. Direct topic-name lookup (exact match) — fastest, most accurate
      const directNote = b.topic ? getTopicNote(b.topic) : null;
      if (directNote) {
        const directResult: NoteSearchResult = {
          storageKey: 'nst_topic_notes',
          chapterId: b.chapterId,
          subjectName: b.subjectName || '',
          board: '',
          classLevel: '',
          noteTitle: directNote.title,
          noteContent: directNote.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 360),
          noteFullContent: directNote.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          matchCount: 99,
          matchedWords: [b.topic],
          chapterTitleFromKey: b.chapterTitle || b.chapterId,
          topicName: directNote.title,
        };
        setNoteResults(p => ({ ...p, [k]: [directResult] }));
        return;
      }
      // 2. Keyword-based fallback search across all cached chapters
      const words = keywordsForBucket(b);
      const results = await searchNotesByWords(words, 10);
      setNoteResults(p => ({ ...p, [k]: results }));
    } catch {
      setNoteResults(p => ({ ...p, [k]: [] }));
    } finally {
      setLoadingNotes(p => ({ ...p, [k]: false }));
    }
  }, [noteResults, loadingNotes]);

  // ── Mark notes reviewed → schedule MCQ ──────────────────────────────────
  const handleNotesRead = (b: WeakBucket, noteResult?: NoteSearchResult) => {
    const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
    markNotesReviewed(k, revisionConfig);
    // ── +5 pts notes padhne ke liye ──────────────────────────────────────
    if (onUpdateUser) {
      const updated = { ...user, totalScore: (user.totalScore || 0) + 5 };
      onUpdateUser(updated);
    }
    if (noteResult) {
      onOpenChapter?.(b.subjectId, noteResult.chapterId, noteResult.noteTitle || noteResult.chapterTitleFromKey);
    } else {
      onOpenChapter?.(b.subjectId, b.chapterId, b.chapterTitle);
    }
    reload();
  };

  // ── Real MCQ session: convert WeakBuckets → TopicItem[] → TodayMcqSession ──
  const startRealMcqSession = () => {
    const topics: TopicItem[] = dueMcq.map(b => ({
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
    if (topics.length === 0) return;
    setRevMcqTopics(topics);
    setRevMcqSessionActive(true);
  };

  // ── Inline Practice All ───────────────────────────────────────────────────
  const startPracticeAll = () => {
    // Build per-topic buckets first, then interleave round-robin so questions
    // from different topics are mixed instead of appearing topic-by-topic.
    const topicBuckets: PracticeQ[][] = [];
    dueMcq.forEach(b => {
      const bk = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
      const qs: PracticeQ[] = b.wrongQuestions
        .filter(q => q.question && q.correctOption)
        .map(q => ({ question: q.question, correctOption: q.correctOption!, allOptions: q.allOptions, topic: b.topic, bucketKey: bk }));
      // Fisher-Yates shuffle within each topic bucket
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
      if (qs.length > 0) topicBuckets.push(qs);
    });
    if (topicBuckets.length === 0) return;
    // Round-robin interleave across topic buckets
    const allQs: PracticeQ[] = [];
    const maxLen = Math.max(...topicBuckets.map(b => b.length));
    for (let row = 0; row < maxLen; row++) {
      for (let col = 0; col < topicBuckets.length; col++) {
        if (row < topicBuckets[col].length) allQs.push(topicBuckets[col][row]);
      }
    }
    if (allQs.length === 0) return;
    setPracticeQs(allQs);
    setPracticeIdx(0);
    setPracticeRevealed(false);
    setPracticeScores({});
    setPracticeDone(false);
    setPracticeActive(true);
  };

  const startPracticeTopic = (b: WeakBucket) => {
    const bk = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
    const topicQs: PracticeQ[] = b.wrongQuestions
      .filter(q => q.question && q.correctOption)
      .map(q => ({ question: q.question, correctOption: q.correctOption!, allOptions: q.allOptions, topic: b.topic, bucketKey: bk }));
    if (topicQs.length === 0) return;
    setPracticeQs(topicQs);
    setPracticeIdx(0);
    setPracticeRevealed(false);
    setPracticeScores({});
    setPracticeDone(false);
    setPracticeActive(true);
  };

  const handlePracticeRate = (got: boolean) => {
    // Award XP for school revision hub MCQ answer; respect gate (returns false if daily limit hit)
    if (onMcqAnswer) { if (!onMcqAnswer(got)) return; }
    const q = practiceQs[practiceIdx];
    setPracticeScores(prev => {
      const cur = prev[q.bucketKey] || { got: 0, total: 0 };
      return { ...prev, [q.bucketKey]: { got: cur.got + (got ? 1 : 0), total: cur.total + 1 } };
    });
    const next = practiceIdx + 1;
    if (next >= practiceQs.length) {
      setPracticeDone(true);
    } else {
      setPracticeIdx(next);
      setPracticeRevealed(false);
      setPracticeSelected(null);
    }
  };

  const finishPracticeSession = () => {
    dueMcq.forEach(b => {
      const bk = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
      const sc = practiceScores[bk];
      if (sc) {
        const acc = sc.total > 0 ? sc.got / sc.total : 0;
        markMcqDone(bk, acc, revisionConfig);
      }
    });
    setPracticeActive(false);
    setPracticeDone(false);
    reload();
    setActiveTab('results');
  };

  const resetPractice = () => {
    setPracticeActive(false);
    setPracticeDone(false);
    setPracticeQs([]);
    setPracticeIdx(0);
    setPracticeRevealed(false);
    setPracticeSelected(null);
    setPracticeScores({});
  };

  // ── MCQ open + self-rating ────────────────────────────────────────────────
  const handleMcqOpen = (b: WeakBucket) => {
    if (props.onBeforeMcqOpen) {
      props.onBeforeMcqOpen(() => setActiveRevSession(b));
    } else {
      setActiveRevSession(b);
    }
  };

  const handleRevSessionComplete = (b: WeakBucket, status: 'weak' | 'average' | 'strong') => {
    const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
    handleSelfRate(k, status, b.topic);
  };

  const handleSelfRate = (key: string, score: 'weak' | 'average' | 'strong', topicName?: string) => {
    // Map self-rate to a midpoint within each tier using actual thresholds from settings
    const thr = revisionConfig?.thresholds ?? { strong: 65, average: 50, mastery: 80 };
    const weakMid    = (thr.average - 1) / 2 / 100;                          // midpoint below average
    const averageMid = (thr.average + thr.strong - 1) / 2 / 100;             // midpoint in average range
    const strongMid  = (thr.strong + thr.mastery - 1) / 2 / 100;             // midpoint in strong range
    const acc = score === 'strong' ? strongMid : score === 'average' ? averageMid : weakMid;
    markMcqDone(key, acc, revisionConfig);
    // ── Pts based on self-rating: weak=+3, average=+5, strong=+10 ────────
    if (onUpdateUser) {
      const ratePts = score === 'strong' ? 10 : score === 'average' ? 5 : 3;
      const updated = { ...user, totalScore: (user.totalScore || 0) + ratePts };
      onUpdateUser(updated);
    }
    setSelfRateKey(null);
    setLastRatedTopic(topicName || null);
    reload();
    setActiveTab('results');
  };

  const handleClear = () => {
    clearTracker();
    setShowClearConfirm(false);
    reload();
  };

  const totalDue = dueItems.length;

  // ── Sub-components ────────────────────────────────────────────────────────

  const SectionHeader = ({
    icon, label, count, color,
  }: { icon: React.ReactNode; label: string; count: number; color: string }) => (
    <div className="flex items-center gap-2 px-1 mb-2">
      <div className={`w-7 h-7 rounded-lg bg-${color}-100 text-${color}-600 flex items-center justify-center`}>{icon}</div>
      <p className="text-sm font-black text-slate-800">{label}</p>
      <span className={`ml-auto text-xs font-bold bg-${color}-100 text-${color}-700 rounded-full px-2 py-0.5`}>{count}</span>
    </div>
  );

  const EmptyCard = ({ msg }: { msg: string }) => (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center">
      <CheckCircle size={22} className="mx-auto text-emerald-400 mb-2" />
      <p className="text-sm font-bold text-slate-600">{msg}</p>
    </div>
  );

  // Notes bucket card — sirf topic naam
  const NotesBucketCard = ({ b }: { b: WeakBucket }) => (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0">
      <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
      <p className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{b.topic}</p>
      {b.subjectName && (
        <span className="text-[10px] text-slate-400 shrink-0 truncate max-w-[80px]">{b.subjectName}</span>
      )}
    </div>
  );

  // MCQ bucket card — no individual Practice button, just shows topic info + wrong questions preview
  const McqBucketCard = ({ b }: { b: WeakBucket }) => {
    return (
      <div className="border-b border-slate-100 last:border-b-0 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Target size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{b.topic}</p>
            {b.pageLabel && <p className="text-[10px] text-slate-500">{b.pageLabel}</p>}
            <p className="text-[10px] text-rose-500 font-bold">{b.wrongCount} galat · {b.total} attempts</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-1 rounded-full">
            {b.wrongQuestions.length}Q
          </span>
        </div>

        {b.wrongQuestions.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {b.wrongQuestions.slice(0, 2).map((q, i) => (
              <div key={i} className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2">
                <p className="text-[11px] text-slate-700">{q.question}</p>
                {q.correctOption && (
                  <p className="text-[10px] text-emerald-700 font-bold mt-0.5">✓ {q.correctOption}</p>
                )}
              </div>
            ))}
            {b.wrongQuestions.length > 2 && (
              <p className="text-[10px] text-slate-400 text-center">+{b.wrongQuestions.length - 2} aur sawaal</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Subject–Chapter accordion
  const SubjectChapterList = ({
    groups,
    renderBucket,
  }: {
    groups: SubjectGroup[];
    renderBucket: (b: WeakBucket) => React.ReactNode;
  }) => (
    <div className="space-y-3">
      <VirtualList
        items={groups}
        keyExtractor={sg => sg.subjectId}
        estimatedItemHeight={160}
        renderItem={sg => (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{sg.subjectName}</p>
          </div>
          {sg.chapters.map(cg => {
            const chKey = `${sg.subjectId}::${cg.chapterId}`;
            const expanded = expandedChapters[chKey] !== false;
            return (
              <div key={cg.chapterId}>
                <button
                  onClick={() => toggleChapter(chKey)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <BookOpen size={15} className="text-indigo-500 shrink-0" />
                  <span className="flex-1 text-sm font-bold text-slate-800 truncate">{cg.chapterTitle}</span>
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">{cg.buckets.length} topic{cg.buckets.length !== 1 ? 's' : ''}</span>
                  {expanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                </button>
                {expanded && (
                  <div className="border-t border-slate-100">
                    {cg.buckets.map(b => (
                      <div key={`${b.chapterId}::${b.pageKey}::${b.topic}`}>
                        {renderBucket(b)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      />
    </div>
  );


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 to-white pb-24">

      {/* All-notes reader modal */}
      {showAllNotesModal && (
        <TodayAllNotesModal
          dueNotes={dueNotes}
          user={user}
          onClose={() => setShowAllNotesModal(false)}
          onTopicsMarked={(markedBuckets) => {
            markedBuckets.forEach(b => {
              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
              markNotesReviewed(k, revisionConfig);
            });
            // ── +5 pts per topic notes padha ──────────────────────────────
            if (onUpdateUser && markedBuckets.length > 0) {
              const notesPts = markedBuckets.length * 5;
              const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };
              onUpdateUser(updated);
            }
            setShowAllNotesModal(false);
            reload();
          }}
        />
      )}

      {/* Embedded RevisionSession overlay — legacy, kept for direct opens */}
      {activeRevSession && (
        <RevisionSession
          user={user}
          settings={settings}
          chapterId={activeRevSession.chapterId}
          subTopic={activeRevSession.topic}
          chapterTitle={activeRevSession.chapterTitle || activeRevSession.chapterId}
          subjectName={activeRevSession.subjectName}
          onClose={() => setActiveRevSession(null)}
          onUpdateUser={onUpdateUser ?? (() => {})}
          onSessionComplete={(status) => handleRevSessionComplete(activeRevSession, status)}
        />
      )}

      {/* ── Real MCQ Session using TodayMcqSession ── */}
      {revMcqSessionActive && (
        <TodayMcqSession
          user={user}
          topics={revMcqTopics}
          settings={settings}
          onUpdateUser={onUpdateUser}
          onClose={() => setRevMcqSessionActive(false)}
          onComplete={(_results) => {
            setRevMcqSessionActive(false);
            reload();
            setActiveTab('results');
          }}
        />
      )}

      {/* ── Inline "Practice All" MCQ Session Overlay ── */}
      {practiceActive && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white" style={{ height: '100dvh' }}>

          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 shadow-sm shrink-0">
            <button
              onClick={resetPractice}
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all"
            >
              <ArrowLeft size={18} className="text-slate-700" />
            </button>
            <div className="flex-1 min-w-0">
              {practiceDone ? (
                <>
                  <h1 className="text-base font-black text-slate-800 leading-none">Session Complete!</h1>
                  <p className="text-[11px] text-slate-500 mt-0.5">Performance save ho raha hai…</p>
                </>
              ) : (
                <>
                  <h1 className="text-base font-black text-slate-800 leading-none">
                    Sawaal {practiceIdx + 1} / {practiceQs.length}
                  </h1>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {practiceQs[practiceIdx]?.topic || 'Practice'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {!practiceDone && (
            <div className="h-1 bg-slate-100 shrink-0">
              <div
                className="h-1 bg-emerald-500 transition-all duration-300"
                style={{ width: `${((practiceIdx) / practiceQs.length) * 100}%` }}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 p-4 max-w-xl mx-auto w-full">

            {/* ── Session in progress ── */}
            {!practiceDone && practiceQs[practiceIdx] && (() => {
              const q = practiceQs[practiceIdx];
              return (
                <div className="space-y-4 pt-2">
                  {/* Topic badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {q.topic}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-auto">{practiceIdx + 1}/{practiceQs.length}</span>
                  </div>

                  {/* Question card */}
                  <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5">
                    <p className="font-bold text-slate-800 text-sm leading-relaxed">{q.question}</p>
                  </div>

                  {/* Options — A/B/C/D if available, else reveal-only */}
                  {q.allOptions && q.allOptions.length > 0 ? (() => {
                    const correctIdx = q.allOptions.findIndex(o => o === q.correctOption);
                    return (
                      <div className="space-y-2.5">
                        {q.allOptions.map((opt, oi) => {
                          const letter = String.fromCharCode(65 + oi);
                          const isSelected = practiceSelected === oi;
                          const isCorrect = oi === correctIdx;
                          const showResult = practiceRevealed;
                          let optClass = 'border-slate-200 bg-white text-slate-700';
                          if (showResult && isCorrect) optClass = 'border-emerald-400 bg-emerald-50 text-emerald-800';
                          else if (showResult && isSelected && !isCorrect) optClass = 'border-rose-400 bg-rose-50 text-rose-800';
                          else if (!showResult && isSelected) optClass = 'border-indigo-400 bg-indigo-50 text-indigo-800';
                          return (
                            <button
                              key={oi}
                              disabled={showResult}
                              onClick={() => {
                                setPracticeSelected(oi);
                                setPracticeRevealed(true);
                              }}
                              className={`w-full flex items-start gap-3 border-2 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.99] ${optClass} ${showResult ? 'cursor-default' : 'hover:border-indigo-300 hover:bg-indigo-50/60'}`}
                            >
                              <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs border-2 ${
                                showResult && isCorrect ? 'border-emerald-500 bg-emerald-500 text-white'
                                : showResult && isSelected && !isCorrect ? 'border-rose-500 bg-rose-500 text-white'
                                : !showResult && isSelected ? 'border-indigo-500 bg-indigo-500 text-white'
                                : 'border-slate-300 bg-slate-100 text-slate-600'
                              }`}>{letter}</span>
                              <span className="font-semibold text-sm leading-relaxed pt-0.5">{opt}</span>
                              {showResult && isCorrect && <CheckCircle size={18} className="shrink-0 ml-auto text-emerald-500 mt-0.5" />}
                              {showResult && isSelected && !isCorrect && <XCircle size={18} className="shrink-0 ml-auto text-rose-500 mt-0.5" />}
                            </button>
                          );
                        })}

                        {/* After reveal — Next/Back navigation */}
                        {practiceRevealed && (
                          <div className="space-y-3 pt-1">
                            {practiceSelected !== null && practiceSelected !== correctIdx && (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 font-medium">
                                💡 Sahi jawab: <strong>{q.allOptions[correctIdx]}</strong>
                              </div>
                            )}
                            {q.explanation && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 leading-relaxed">
                                📖 {q.explanation}
                              </div>
                            )}
                            <div className="flex gap-3 pt-1">
                              <button
                                onClick={() => {
                                  if (practiceIdx > 0) {
                                    setPracticeIdx(prev => prev - 1);
                                    setPracticeRevealed(false);
                                    setPracticeSelected(null);
                                  }
                                }}
                                disabled={practiceIdx === 0}
                                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-600 font-black text-sm active:scale-[0.97] transition-all disabled:opacity-30"
                              >
                                ← Pichla
                              </button>
                              <button
                                onClick={() => handlePracticeRate(practiceSelected === correctIdx)}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-sm active:scale-[0.97] transition-all shadow-md shadow-indigo-200"
                              >
                                {practiceIdx + 1 >= practiceQs.length ? '✅ Finish' : 'Agla →'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    /* Fallback — no options stored, show reveal button */
                    !practiceRevealed ? (
                      <button
                        onClick={() => setPracticeRevealed(true)}
                        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-indigo-300 text-indigo-600 font-black py-4 rounded-2xl text-sm active:scale-[0.99] transition-all bg-indigo-50"
                      >
                        <Eye size={18} /> Sahi Jawab Dekho
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4">
                          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">✅ Sahi Jawab</p>
                          <p className="font-bold text-emerald-800 text-sm leading-relaxed">{q.correctOption}</p>
                        </div>
                        {q.explanation && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 leading-relaxed">
                            📖 {q.explanation}
                          </div>
                        )}
                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => {
                              if (practiceIdx > 0) {
                                setPracticeIdx(prev => prev - 1);
                                setPracticeRevealed(false);
                                setPracticeSelected(null);
                              }
                            }}
                            disabled={practiceIdx === 0}
                            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-600 font-black text-sm active:scale-[0.97] transition-all disabled:opacity-30"
                          >
                            ← Pichla
                          </button>
                          <button
                            onClick={() => handlePracticeRate(false)}
                            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-sm active:scale-[0.97] transition-all shadow-md shadow-indigo-200"
                          >
                            {practiceIdx + 1 >= practiceQs.length ? '✅ Finish' : 'Agla →'}
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              );
            })()}

            {/* ── Session done — results ── */}
            {practiceDone && (() => {
              const totalGot = Object.values(practiceScores).reduce((s, v) => s + v.got, 0);
              const totalTotal = Object.values(practiceScores).reduce((s, v) => s + v.total, 0);
              const overallPct = totalTotal > 0 ? Math.round((totalGot / totalTotal) * 100) : 0;
              return (
                <div className="space-y-4 pt-2">
                  {/* Header */}
                  <div className="rounded-2xl p-5 text-white text-center bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-200">
                    <Trophy size={32} className="mx-auto mb-2 opacity-90" />
                    <p className="text-xl font-black">Session Complete!</p>
                    <p className="text-3xl font-black mt-1">{overallPct}%</p>
                    <p className="text-sm opacity-80 mt-1">{totalGot} / {totalTotal} sahi the</p>
                  </div>

                  {/* Per-topic breakdown */}
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 text-center">Topic-wise Results</p>
                  {dueMcq.map(b => {
                    const bk = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
                    const sc = practiceScores[bk];
                    if (!sc) return null;
                    const pct = sc.total > 0 ? Math.round((sc.got / sc.total) * 100) : 0;
                    const _thr = revisionConfig?.thresholds ?? { strong: 65, average: 50, mastery: 80 };
                    const tier = pct >= _thr.mastery ? { bg: 'bg-violet-100', text: 'text-violet-700', label: '🏆 Mastered' }
                      : pct >= _thr.strong  ? { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '💪 Strong' }
                      : pct >= _thr.average ? { bg: 'bg-amber-100', text: 'text-amber-700', label: '🙂 Average' }
                      : { bg: 'bg-rose-100', text: 'text-rose-700', label: '😕 Weak' };
                    return (
                      <div key={bk} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-black ${tier.bg} ${tier.text}`}>
                          <span className="text-sm leading-none">{sc.got}/{sc.total}</span>
                          <span className="text-[9px] uppercase">score</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{b.topic}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>{tier.label}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Info */}
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-xs text-indigo-700 flex gap-2">
                    <span>📅</span>
                    <span>Performance save ho gaya. <strong>Performance</strong> tab mein dekho.</span>
                  </div>

                  {/* Submit + reset */}
                  <button
                    onClick={finishPracticeSession}
                    className="w-full flex items-center justify-center gap-2 text-white font-black py-4 rounded-2xl text-base transition-all shadow-lg active:scale-[0.99] bg-emerald-600"
                  >
                    <Trophy size={20} /> Performance Save Karo
                  </button>
                  <button
                    onClick={resetPractice}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold py-3.5 rounded-2xl transition-all"
                  >
                    <RotateCcw size={16} /> Wapas Jao
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Header — hidden when embedded inside RevisionHubScreen to avoid duplicate title */}
      {!hideHeader && (
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 truncate">
              <BrainCircuit size={20} className="text-indigo-600 shrink-0" /> Revision Hub
            </h2>
            <p className="text-[11px] text-slate-500 -mt-0.5">Local word-match · Koi AI nahi</p>
          </div>
        </div>
      )}

      {/* Tab bar — always visible */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200">
        {/* Tab bar */}
        <div className="flex border-t border-slate-100">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black transition-colors ${
              activeTab === 'daily'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/60'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ListChecks size={14} />
            Aaj Ka Kaam
            {totalDue > 0 && (
              <span className="bg-rose-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {totalDue > 9 ? '9+' : totalDue}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black transition-colors ${
              activeTab === 'results'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/60'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 size={14} />
            Performance
          </button>
        </div>
      </div>

      {/* Confirm clear */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl">
            <p className="font-black text-slate-800 mb-2">Reset Revision Hub?</p>
            <p className="text-sm text-slate-500 mb-5">All tracking data and the revision schedule will be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2 rounded-xl bg-slate-100 text-sm font-bold">Cancel</button>
              <button onClick={handleClear} className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-sm font-bold">Reset</button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-5">

        {/* ═══════════════════════════════════════════════════════
            TAB 1 — AAJ KA KAAM (Daily Tasks)
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'daily' && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm text-center">
                <p className="text-2xl font-black text-indigo-600">{totalDue}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Due Today</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm text-center">
                <p className="text-2xl font-black text-blue-600">{dueNotes.length}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Notes</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm text-center">
                <p className="text-2xl font-black text-emerald-600">{dueMcq.length}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">MCQ</p>
              </div>
            </div>

            {/* Empty state */}
            {totalTracked === 0 && (
              <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 p-6 text-center">
                <Sparkles size={30} className="mx-auto text-indigo-400 mb-3" />
                <p className="font-black text-indigo-800 text-base mb-1">No topics being tracked yet</p>
                <p className="text-sm text-indigo-600 mb-4">Get an MCQ wrong and that topic will automatically show up here.</p>
              </div>
            )}

            {/* Notes due today */}
            {totalTracked > 0 && (
              <div>
                <SectionHeader icon={<BookOpen size={14} />} label="Notes To Read Today" count={dueNotes.length} color="indigo" />
                {dueNotes.length === 0
                  ? <EmptyCard msg="No notes pending today!" />
                  : (
                    <>
                      {/* Flat scrollable topic list — ~5 rows visible */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
                          {dueNotes.map((b, i) => (
                            <NotesBucketCard key={`${b.subjectId}::${b.chapterId}::${b.pageKey}::${b.topic}`} b={b} />
                          ))}
                        </div>
                      </div>
                      {/* ── "Revision Notes" bottom button ── */}
                      <button
                        onClick={() => setShowAllNotesModal(true)}
                        className="mt-3 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-black py-3.5 rounded-2xl shadow-lg shadow-indigo-200 transition-all"
                      >
                        <BookOpen size={16} />
                        📖 Revision Notes Padho
                      </button>
                    </>
                  )
                }
              </div>
            )}

            {/* MCQ due today */}
            {totalTracked > 0 && (
              <div>
                <SectionHeader icon={<Target size={14} />} label="MCQ Practice For Today" count={dueMcq.length} color="emerald" />
                {dueMcq.length === 0
                  ? <EmptyCard msg="No MCQs pending today!" />
                  : (
                    <>
                      {/* Topic list — clicking any topic starts full mixed session */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-700">Kisi bhi topic pe tap karo — sab topics mixed milenge ⚡</p>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
                          {dueMcq.map((b) => (
                            <button
                              key={`${b.subjectId}::${b.chapterId}::${b.pageKey}::${b.topic}`}
                              onClick={startPracticeAll}
                              className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-emerald-50 active:bg-emerald-100 transition-colors text-left"
                            >
                              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                              <p className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{b.topic}</p>
                              {b.wrongQuestions.length > 0 && (
                                <span className="shrink-0 text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                                  {b.wrongQuestions.length}Q
                                </span>
                              )}
                              {b.subjectName && (
                                <span className="text-[10px] text-slate-400 shrink-0 truncate max-w-[70px]">{b.subjectName}</span>
                              )}
                              <Zap size={13} className="text-emerald-400 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* ── "Saare MCQ Ek Saath" bottom button ── */}
                      <button
                        onClick={startPracticeAll}
                        className="mt-3 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-black py-3.5 rounded-2xl shadow-lg shadow-emerald-200 transition-all"
                      >
                        <Zap size={16} />
                        ⚡ Saare MCQ Ek Saath Practice Karo ({dueMcq.length} topic)
                      </button>
                    </>
                  )
                }
              </div>
            )}

            {/* ── Upcoming — Next Day Plan (MCQ + Notes split) ── */}
            {upcomingItems.length > 0 && (() => {
              const upMcq   = upcomingItems.filter(b => b.stage === 'MCQ');
              const upNotes = upcomingItems.filter(b => b.stage !== 'MCQ');

              const UpcomingBox = ({ items, icon, title, accentBg, accentText, accentBorder, dotFn }: {
                items: WeakBucket[];
                icon: React.ReactNode;
                title: string;
                accentBg: string;
                accentText: string;
                accentBorder: string;
                dotFn: (b: WeakBucket) => string;
              }) => {
                if (items.length === 0) return null;
                const { sub } = formatDayLabel(items[0].nextDueAt ?? 0, now);
                return (
                  <div className={`bg-white rounded-2xl border ${accentBorder} shadow-sm overflow-hidden`}>
                    {/* Box header */}
                    <div className={`flex items-center gap-2 px-4 py-2.5 ${accentBg}`}>
                      <span className="text-sm">{icon}</span>
                      <p className={`text-xs font-black flex-1 ${accentText}`}>{title}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${accentBg} ${accentText} border ${accentBorder}`}>{items.length}</span>
                    </div>
                    {/* Midnight countdown — common for all (all due same day: tomorrow) */}
                    {sub && (
                      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-slate-100 bg-slate-50">
                        <Clock size={10} className="text-blue-400" />
                        <span className="text-[9px] text-slate-500">Kal 12 baje milenge</span>
                        <span className="ml-auto text-[9px] font-mono font-black text-blue-600">{sub}</span>
                      </div>
                    )}
                    {/* Topic rows */}
                    <div className="overflow-y-auto divide-y divide-slate-100" style={{ maxHeight: 220 }}>
                      {items.map((b) => {
                        const dot = dotFn(b);
                        const displayPct = b.lastSessionAccuracy != null
                          ? Math.round(b.lastSessionAccuracy * 100)
                          : Math.round((b.correct / Math.max(b.total, 1)) * 100);
                        return (
                          <div
                            key={`${b.subjectId}::${b.chapterId}::${b.pageKey}::${b.topic}`}
                            className="flex items-center gap-3 px-4 py-2.5"
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{b.topic}</p>
                              <p className="text-[10px] text-slate-400 truncate">{b.subjectName}</p>
                            </div>
                            <span className="text-[10px] font-black text-slate-400">{displayPct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              const tierDot = (b: WeakBucket) =>
                b.lastTier === 'mastered' ? 'bg-violet-400' :
                b.lastTier === 'strong'   ? 'bg-emerald-400' :
                b.lastTier === 'average'  ? 'bg-amber-400'   : 'bg-rose-400';

              return (
                <div className="space-y-3">
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Clock size={14} />
                    </div>
                    <p className="text-sm font-black text-slate-800">Upcoming</p>
                    <span className="text-[10px] text-slate-400 font-semibold">— Kal ka plan</span>
                    <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{upcomingItems.length}</span>
                  </div>

                  {/* MCQ box */}
                  <UpcomingBox
                    items={upMcq}
                    icon="📝"
                    title="MCQ Practice"
                    accentBg="bg-indigo-50"
                    accentText="text-indigo-700"
                    accentBorder="border-indigo-200"
                    dotFn={tierDot}
                  />

                  {/* Notes box */}
                  <UpcomingBox
                    items={upNotes}
                    icon="📖"
                    title="Notes Revision"
                    accentBg="bg-teal-50"
                    accentText="text-teal-700"
                    accentBorder="border-teal-200"
                    dotFn={tierDot}
                  />

                  <p className="text-[10px] text-slate-400 text-center">
                    🌙 Raat 12 baje ye topics "Aaj Ka Kaam" mein aa jayenge
                  </p>
                </div>
              );
            })()}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 2 — PERFORMANCE RESULTS (Weak / Average / Strong / Mastered)
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'results' && (() => {
          // Use Interval Settings thresholds — never hardcode percentages
          const thr = revisionConfig?.thresholds ?? { strong: 65, average: 50, mastery: 80 };
          const avgMin  = thr.average;   // e.g. 45
          const strMin  = thr.strong;    // e.g. 60
          const mastMin = thr.mastery;   // e.g. 80

          const trackedBuckets = allBuckets.filter(b => b.total > 0) as WeakBucket[];

          // Classify using lastTier if available (reflects what student actually scored
          // in the last session), otherwise fall back to cumulative correct/total ratio.
          const getTier = (b: WeakBucket): 'weak' | 'average' | 'strong' | 'mastered' => {
            if (b.lastTier) return b.lastTier;
            const pct = (b.correct / Math.max(b.total, 1)) * 100;
            if (pct >= mastMin) return 'mastered';
            if (pct >= strMin)  return 'strong';
            if (pct >= avgMin)  return 'average';
            return 'weak';
          };

          const weak     = trackedBuckets.filter(b => getTier(b) === 'weak');
          const average  = trackedBuckets.filter(b => getTier(b) === 'average');
          const strong   = trackedBuckets.filter(b => getTier(b) === 'strong');
          const mastered = trackedBuckets.filter(b => getTier(b) === 'mastered');

          const tierMeta = (t: string) => {
            if (t === 'mastered') return { emoji: '🏆', color: 'text-violet-600', bg: 'bg-violet-100' };
            if (t === 'strong')   return { emoji: '💪', color: 'text-emerald-600', bg: 'bg-emerald-100' };
            if (t === 'average')  return { emoji: '🙂', color: 'text-amber-600',   bg: 'bg-amber-100' };
            return                       { emoji: '😕', color: 'text-rose-600',    bg: 'bg-rose-100' };
          };

          const TopicRow = ({ b, bgColor, textColor, badgeColor, badgeText }: { b: WeakBucket; bgColor: string; textColor: string; badgeColor: string; badgeText: string }) => {
            const displayPct = b.lastSessionAccuracy != null
              ? Math.round(b.lastSessionAccuracy * 100)
              : Math.round((b.correct / Math.max(b.total, 1)) * 100);

            // Day-based countdown for next due
            const dayInfo = b.nextDueAt ? formatDayLabel(b.nextDueAt, now) : null;
            const timerColor = dayInfo?.isDue
              ? 'bg-rose-100 text-rose-600 animate-pulse'
              : 'bg-blue-50 text-blue-600';

            const history = (b as any).sessionHistory as { accuracy: number; tier: string; at: number }[] | undefined;

            // Trend arrow: compare latest vs previous session
            const trendArrow = (() => {
              if (!history || history.length < 2) return null;
              const diff = history[0].accuracy - history[1].accuracy;
              if (diff > 0.05) return { icon: '↑', color: 'text-emerald-500' };
              if (diff < -0.05) return { icon: '↓', color: 'text-rose-500' };
              return { icon: '→', color: 'text-slate-400' };
            })();

            return (
              <div className="border-b border-slate-100 last:border-b-0">
                {/* Day-based timer strip */}
                {dayInfo && (
                  <div className="flex items-center gap-1.5 px-4 pt-2 pb-0.5">
                    <Clock size={10} className={dayInfo.isDue ? 'text-rose-500' : 'text-blue-400'} />
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${timerColor}`}>
                      {dayInfo.isDue ? '⚡ Due Now!' : dayInfo.label}
                    </span>
                    {dayInfo.sub && (
                      <span className="text-[9px] font-mono text-blue-400">{dayInfo.sub}</span>
                    )}
                    <span className="text-[9px] text-slate-400">
                      · {b.stage === 'MCQ' ? 'MCQ' : 'Notes'} due
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-11 h-11 rounded-2xl ${bgColor} flex flex-col items-center justify-center shrink-0 font-black relative`}>
                    <span className={`text-sm leading-tight ${textColor}`}>{displayPct}%</span>
                    {trendArrow && (
                      <span className={`absolute -top-1 -right-1 text-[11px] font-black ${trendArrow.color}`}>{trendArrow.icon}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{b.topic}</p>
                    <p className="text-[10px] text-slate-400 truncate">{b.subjectName} · {b.chapterTitle}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${badgeColor}`}>{badgeText}</span>
                      <span className="text-[9px] text-slate-400">{b.wrongQuestions.length} galat · {b.total} total</span>
                    </div>
                    {/* ── Last 3 sessions history ── */}
                    {history && history.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[8px] text-slate-400 mr-0.5">Pichhle test:</span>
                        {history.map((s, i) => {
                          const m = tierMeta(s.tier);
                          const pct = Math.round(s.accuracy * 100);
                          return (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full ${m.bg} ${m.color}`}
                              title={new Date(s.at).toLocaleDateString('en-IN')}
                            >
                              {m.emoji} {pct}%
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          };

          return (
            <>
              {/* Last rated toast */}
              {lastRatedTopic && (
                <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-2">
                  <CheckCircle size={16} className="text-indigo-500 shrink-0" />
                  <p className="text-xs font-bold text-indigo-700">"{lastRatedTopic}" submit ho gaya!</p>
                </div>
              )}

              {/* Empty state */}
              {trackedBuckets.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <BarChart3 size={30} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-500">Abhi koi performance data nahi</p>
                  <p className="text-xs text-slate-400 mt-1">MCQ practice karo, phir Submit dabao — yahan result aayega.</p>
                </div>
              )}

              {/* ── Radial Gauge (Speedometer) Chart ── */}
              {trackedBuckets.length > 0 && (() => {
                const total = trackedBuckets.length;
                const tiers = [
                  { key: 'weak'     as const, label: 'Weak',     emoji: '😕', color: '#ef4444', bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',    count: weak.length,     list: weak     },
                  { key: 'average'  as const, label: 'Average',  emoji: '🙂', color: '#f97316', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',  count: average.length,  list: average  },
                  { key: 'strong'   as const, label: 'Strong',   emoji: '💪', color: '#22c55e', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', count: strong.length, list: strong   },
                  { key: 'mastered' as const, label: 'Mastered', emoji: '🏆', color: '#8b5cf6', bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700', count: mastered.length, list: mastered },
                ];
                const activeTier = tiers.find(t => t.key === perfFilter) ?? null;

                // Overall score: Weak=0, Average=33, Strong=67, Mastered=100
                const score = total > 0
                  ? Math.round((weak.length * 0 + average.length * 33 + strong.length * 67 + mastered.length * 100) / total)
                  : 0;

                const levelInfo = score >= 80 ? { label: 'Excellent', emoji: '🏆', color: '#22c55e' }
                  : score >= 60              ? { label: 'Great',     emoji: '💪', color: '#84cc16' }
                  : score >= 40              ? { label: 'Good',      emoji: '🙂', color: '#eab308' }
                  : score >= 20              ? { label: 'Fair',      emoji: '😐', color: '#f97316' }
                  :                            { label: 'Poor',      emoji: '😕', color: '#ef4444' };

                // SVG gauge helpers
                const cx = 110, cy = 112;
                const ro = 88, ri = 56;
                const midR = (ro + ri) / 2;
                const toRad = (d: number) => d * Math.PI / 180;

                // Ring segment path: angles in degrees, s > e (both 0–180)
                const arcSeg = (s: number, e: number, outerR: number, innerR: number) => {
                  const x1 = cx + outerR * Math.cos(toRad(s)), y1 = cy - outerR * Math.sin(toRad(s));
                  const x2 = cx + outerR * Math.cos(toRad(e)), y2 = cy - outerR * Math.sin(toRad(e));
                  const x3 = cx + innerR * Math.cos(toRad(e)), y3 = cy - innerR * Math.sin(toRad(e));
                  const x4 = cx + innerR * Math.cos(toRad(s)), y4 = cy - innerR * Math.sin(toRad(s));
                  const lg = (s - e) > 180 ? 1 : 0;
                  return `M${x1} ${y1} A${outerR} ${outerR} 0 ${lg} 0 ${x2} ${y2} L${x3} ${y3} A${innerR} ${innerR} 0 ${lg} 1 ${x4} ${y4}Z`;
                };

                // 5 gauge segments with 1° gap between each
                const gaugeSegs = [
                  { s: 179, e: 145, label: 'Poor',      color: '#ef4444' },
                  { s: 143, e: 109, label: 'Fair',      color: '#f97316' },
                  { s: 107, e: 73,  label: 'Good',      color: '#eab308' },
                  { s: 71,  e: 37,  label: 'Great',     color: '#84cc16' },
                  { s: 35,  e: 1,   label: 'Excellent', color: '#22c55e' },
                ];

                // Needle — points from center toward score position
                const needleDeg = 180 - score * 1.8;  // 0%→180°, 100%→0°
                const needleRad = toRad(needleDeg);
                const nLen = 70;
                const ntx = cx + nLen * Math.cos(needleRad);
                const nty = cy - nLen * Math.sin(needleRad);
                // Needle triangle wings perpendicular at base
                const pw = 5;
                const pRad = needleRad + Math.PI / 2;
                const w1x = cx + pw * Math.cos(pRad), w1y = cy - pw * Math.sin(pRad);
                const w2x = cx - pw * Math.cos(pRad), w2y = cy + pw * Math.sin(pRad);

                // Pie chart data
                const pieData = tiers.filter(t => t.count > 0).map(t => ({
                  name: t.label,
                  value: t.count,
                  color: t.color,
                  key: t.key,
                }));
                const emptyPie = pieData.length === 0;

                const PieLabel = ({ cx: pcx, cy: pcy, midAngle, innerRadius, outerRadius, percent, name, value }: any) => {
                  if (percent < 0.06) return null;
                  const RADIAN = Math.PI / 180;
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
                  const x = pcx + radius * Math.cos(-midAngle * RADIAN);
                  const y = pcy + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
                      <tspan x={x} dy="-7" fontSize="13" fontWeight="900">{Math.round(percent * 100)}%</tspan>
                      <tspan x={x} dy="16" fontSize="10" fontWeight="600" opacity="0.9">{value}</tspan>
                    </text>
                  );
                };

                return (
                  <>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    {/* ── Pie Chart ── */}
                    <div className="px-3 pt-3 pb-1">
                      <div style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart style={{ background: 'transparent' }}>
                            <Pie
                              data={emptyPie ? [{ name: 'Empty', value: 1, color: '#e2e8f0', key: 'none' }] : pieData}
                              cx="50%"
                              cy="50%"
                              outerRadius={88}
                              dataKey="value"
                              paddingAngle={emptyPie ? 0 : 3}
                              cornerRadius={5}
                              labelLine={false}
                              label={emptyPie ? undefined : PieLabel}
                              onClick={(entry) => {
                                if (!emptyPie && entry?.payload?.key) {
                                  setPerfFilter((f: string) => f === entry.payload.key ? 'all' : entry.payload.key);
                                }
                              }}
                              stroke="none"
                              isAnimationActive={true}
                            >
                              {(emptyPie ? [{ color: '#e2e8f0', key: 'none' }] : pieData).map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                  style={{
                                    cursor: emptyPie ? 'default' : 'pointer',
                                    opacity: emptyPie ? 1 : (perfFilter === 'all' || perfFilter === entry.key) ? 1 : 0.5,
                                    filter: (!emptyPie && perfFilter === entry.key) ? `drop-shadow(0 4px 10px ${entry.color}80)` : 'none',
                                    outline: 'none',
                                  }}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {emptyPie && (
                        <p className="text-center text-xs text-slate-400 font-semibold pb-2">MCQ complete karo — topics yahan dikhenge 📊</p>
                      )}
                    </div>

                    {/* ── Tier stat tiles 2×2 (tappable to filter) ── */}
                    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                      {tiers.map(t => {
                        const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
                        const isActive = perfFilter === t.key;
                        return (
                          <button
                            key={t.key}
                            onClick={() => setPerfFilter(f => f === t.key ? 'all' : t.key)}
                            className={`rounded-xl p-2.5 text-left border transition-all active:scale-95 ${isActive ? `${t.bg} ${t.border} shadow-sm` : 'bg-slate-50 border-transparent'}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">{t.emoji}</span>
                              <span className="text-[10px] font-black" style={{ color: t.color }}>{pct}%</span>
                            </div>
                            <p className="text-[13px] font-black text-slate-800 leading-none">{t.count}</p>
                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{t.label}</p>
                            <div className="mt-1.5 h-1 rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: t.color }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {!activeTier && (
                      <p className="text-[10px] text-slate-400 text-center pb-3">Tile tap karo → us tier ke topics dekhne ke liye</p>
                    )}
                  </div>

                  {/* ── Tier detail panel — OUTSIDE the stats card ── */}
                  {activeTier && (
                    <div className="mt-3">
                      <div className={`flex items-center gap-2 px-1 py-2`}>
                        <span className="text-base">{activeTier.emoji}</span>
                        <p className={`text-sm font-black flex-1 ${activeTier.text}`}>{activeTier.label} Topics</p>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${activeTier.badge}`}>{activeTier.count}</span>
                        <button onClick={() => setPerfFilter('all')} className="ml-1 text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                      </div>
                      {activeTier.list.length === 0 ? (
                        <div className="py-5 text-center text-xs text-slate-400">Koi topic nahi</div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {activeTier.list.map((b: WeakBucket) => {
                            const displayPct = b.lastSessionAccuracy != null
                              ? Math.round(b.lastSessionAccuracy * 100)
                              : Math.round((b.correct / Math.max(b.total, 1)) * 100);
                            const nextDue = b.nextDueAt
                              ? new Date(b.nextDueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                              : '—';
                            return (
                              <div key={`${b.chapterId}::${b.pageKey}::${b.topic}`} className="flex items-center gap-3 py-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black ${activeTier.bg}`}>
                                  <span className="text-xs" style={{ color: activeTier.color }}>{displayPct}%</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">{b.topic}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{b.subjectName}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {b.wrongQuestions.length > 0 && (
                                      <span className="text-[9px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">{b.wrongQuestions.length} galat</span>
                                    )}
                                    <span className="text-[9px] text-slate-400">Due: {nextDue}</span>
                                  </div>
                                </div>
                                <ChevronRight size={15} className="shrink-0 text-slate-300" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  </>
                );
              })()}


              {/* Back to tasks */}
              <button
                onClick={() => { setActiveTab('daily'); setLastRatedTopic(null); }}
                className="w-full py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <ListChecks size={15} /> Wapas Aaj Ka Kaam
              </button>
            </>
          );
        })()}

      </div>
    </div>
  );
};

export default RevisionHubV2;
