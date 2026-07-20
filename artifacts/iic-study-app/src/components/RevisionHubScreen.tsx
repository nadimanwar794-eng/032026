// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, RotateCcw, Clock, BarChart2, ChevronRight,
  CheckCircle, XCircle, Zap, Calendar, BrainCircuit, Trophy, Plus,
} from 'lucide-react';
import type { User, StudentTab, SystemSettings } from '../types';
import { RevisionHubV2 } from './RevisionHubV2';
import { McqReviewHub } from './McqReviewHub';
import { MonthlyMarksheet } from './MonthlyMarksheet';
import { PerformanceGraph } from './PerformanceGraph';
import { subscribeMcqLessons, saveUserToLive } from '../firebase';
import { useAppTheme } from '../utils/themeContext';
import {
  recordAttempt, applyInitialSchedule, bucketKey,
} from '../utils/revisionTrackerV2';
import { applyDeduction, getTotalCredits } from '../utils/creditSystem';
import { CreditConfirmationModal } from './CreditConfirmationModal';

type HubTab = 'MCQ' | 'REVISION' | 'PERFORMANCE';

const CLASSES = ['6', '7', '8', '9', '10', '11', '12'];
const CLASS_EMOJIS: Record<string, string> = {
  '6': '📗', '7': '📘', '8': '📙', '9': '📕',
  '10': '🏅', '11': '🔬', '12': '🎓',
};

interface Props {
  user: User;
  settings?: SystemSettings;
  onBack: () => void;
  onTabChange: (tab: StudentTab) => void;
  onNavigateContent?: (type: 'PDF' | 'MCQ', chapterId: string, topicName?: string, subjectName?: string) => void;
  onUpdateUser?: (user: User) => void;
  onMcqAnswer?: (isCorrect: boolean) => boolean;
  onSendToMcqCommunity?: (draft: { question: string; options: [string,string,string,string]; correctAnswer: number; explanation: string }) => void;
}

const TABS: { id: HubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'MCQ',          label: 'MCQ',         icon: <BookOpen size={16} /> },
  { id: 'REVISION',    label: 'Revision',     icon: <RotateCcw size={16} /> },
  { id: 'PERFORMANCE', label: 'Performance',  icon: <BarChart2 size={16} /> },
];

function daysLabel(secs: number): string {
  const d = Math.round(secs / 86400);
  if (d <= 0) return 'Aaj';
  if (d === 1) return 'Kal';
  return `${d} din baad`;
}

function accuracyTier(pct: number, cfg: any) {
  const t = cfg?.thresholds ?? { mastery: 80, strong: 65, average: 50 };
  if (pct >= t.mastery) return 'mastered';
  if (pct >= t.strong)  return 'strong';
  if (pct >= t.average) return 'average';
  return 'weak';
}

function nextRevisionSecs(pct: number, cfg: any): number {
  const iv = cfg?.intervals ?? {
    weak:     { revision: 86400 },
    average:  { revision: 259200 },
    strong:   { revision: 604800 },
    mastered: { revision: 2592000 },
  };
  const tier = accuracyTier(pct, cfg);
  return iv[tier]?.revision ?? 86400;
}

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  mastered: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '🏆 Mastered' },
  strong:   { bg: 'bg-indigo-100',  text: 'text-indigo-700',  label: '💪 Strong'   },
  average:  { bg: 'bg-amber-100',   text: 'text-amber-700',   label: '🙂 Average'  },
  weak:     { bg: 'bg-rose-100',    text: 'text-rose-700',    label: '😕 Weak'     },
};

export const RevisionHubScreen: React.FC<Props> = ({
  user, settings, onBack, onTabChange, onNavigateContent, onUpdateUser, onMcqAnswer, onSendToMcqCommunity,
}) => {
  const theme = useAppTheme();
  const primary = theme.primary || '#6366f1';
  const [activeTab, setActiveTab]           = useState<HubTab>('MCQ');
  const [mcqSelectedClass, setMcqSelectedClass]     = useState<string | null>(null);
  const [mcqSelectedSubject, setMcqSelectedSubject] = useState<string | null>(null);
  const [mcqSelectedLesson, setMcqSelectedLesson]   = useState<any | null>(null);
  const [allLessons, setAllLessons]                 = useState<any[]>([]);
  const [showMonthlySheet, setShowMonthlySheet]     = useState(false);

  const [sessionActive, setSessionActive]   = useState(false);
  const [sessionQIndex, setSessionQIndex]   = useState(0);
  const [sessionAnswers, setSessionAnswers] = useState<(number | null)[]>([]);
  const [sessionDone, setSessionDone]       = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback]     = useState(false);
  const [sessionMcqs, setSessionMcqs]       = useState<any[]>([]);
  const [coinModal, setCoinModal] = useState<{ title: string; cost: number; onConfirm: () => void } | null>(null);
  const [pendingLesson, setPendingLesson] = useState<any | null>(null);

  // Subscribe to mcq_lessons from Firebase
  useEffect(() => {
    const unsub = subscribeMcqLessons((lessons) => setAllLessons(lessons));
    return unsub;
  }, []);

  // Only show MCQs that have a topic name (lessonTitle) set — lessons without
  // a title are considered incomplete/draft and should not appear in Revision Hub.
  const hubLessons = useMemo(
    () => allLessons.filter(l => l.lessonTitle && String(l.lessonTitle).trim() !== ''),
    [allLessons],
  );

  // Subjects are derived purely from lessons that actually exist in Firebase
  // for the selected class — no hardcoded subject list, so a subject only
  // ever shows up once real notes/MCQ content has been added for it.
  const mcqSubjects = useMemo(() => {
    if (!mcqSelectedClass) return [];
    const names = Array.from(
      new Set(
        hubLessons
          .filter(l => l.classLevel === mcqSelectedClass && l.subject)
          .map(l => l.subject as string),
      ),
    );
    return names
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ id: name, name }));
  }, [mcqSelectedClass, hubLessons]);

  // Lessons available for current class + subject
  const subjectLessons = hubLessons.filter(
    l => l.classLevel === mcqSelectedClass && l.subject === mcqSelectedSubject
  );

  // MCQs come from the selected lesson (new system) or fallback to legacy settings
  // Exclude MCQs without a topic name — blank-topic MCQs would appear as
  // "General" which should not show in Revision Hub.
  const classMcqs: any[] = (mcqSelectedLesson
    ? (mcqSelectedLesson.mcqs || [])
    : []
  ).filter((q: any) => q.topic && String(q.topic).trim() !== '');

  const currentQ = sessionActive ? sessionMcqs[sessionQIndex] : null;

  const topicResults = useMemo(() => {
    if (!sessionDone || !sessionMcqs.length) return [];
    const map: Record<string, { topic: string; correct: number; total: number }> = {};
    sessionMcqs.forEach((q: any, i: number) => {
      // Only count questions that were actually attempted (answered)
      if (sessionAnswers[i] === null || sessionAnswers[i] === undefined) return;
      const t = (q.topic || 'General').trim();
      if (!map[t]) map[t] = { topic: t, correct: 0, total: 0 };
      map[t].total += 1;
      if (sessionAnswers[i] === q.correctAnswer) {
        map[t].correct += 1;
      }
    });
    return Object.values(map);
  }, [sessionDone, sessionMcqs, sessionAnswers]);

  const revCfg = (settings as any)?.revisionConfig;

  const MCQ_START_COST = 40;
  const LESSON_OPEN_COST = 100;

  function doStartSession() {
    // ── Session tracking: App.tsx ko batao session shuru hua ─────────────
    const _chapterName = mcqSelectedLesson?.lessonTitle || `Class ${mcqSelectedClass} — ${mcqSelectedSubject}`;
    window.dispatchEvent(new CustomEvent('iic-mcq-session', {
      detail: { active: true, chapterName: _chapterName, subjectName: mcqSelectedSubject || 'General', activityType: 'MCQ' }
    }));
    // Group questions by topic, shuffle within each group, then round-robin interleave
    const topicBuckets: Record<string, any[]> = {};
    classMcqs.forEach((q: any) => {
      const t = (q.topic || 'General').trim();
      if (!topicBuckets[t]) topicBuckets[t] = [];
      topicBuckets[t].push(q);
    });
    const buckets = Object.values(topicBuckets).map(qs => {
      const arr = [...qs];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
    const mixed: any[] = [];
    const maxLen = Math.max(...buckets.map(b => b.length), 0);
    for (let row = 0; row < maxLen; row++) {
      for (const bucket of buckets) {
        if (row < bucket.length) mixed.push(bucket[row]);
      }
    }
    setSessionMcqs(mixed);
    setSessionAnswers(new Array(mixed.length).fill(null));
    setSessionQIndex(0);
    setSelectedOption(null);
    setShowFeedback(false);
    setSessionDone(false);
    setSessionActive(true);
  }

  function startSession() {
    // Direct start — no credit deduction popup
    doStartSession();
  }

  function handleNext() {
    doHandleNext();
  }

  function doHandleNext() {
    const nextIdx = sessionQIndex + 1;
    if (nextIdx >= sessionMcqs.length) {
      finishSession();
    } else {
      setSessionQIndex(nextIdx);
      const prevAns = sessionAnswers[nextIdx];
      setSelectedOption(prevAns !== undefined && prevAns !== null ? prevAns : null);
      setShowFeedback(false);
    }
  }

  function handleLessonClick(lesson: any) {
    if (!onUpdateUser) { setMcqSelectedLesson(lesson); return; }
    setPendingLesson(lesson);
    setCoinModal({
      title: '📖 Lesson MCQ Access',
      cost: LESSON_OPEN_COST,
      onConfirm: () => {
        const updated = applyDeduction(user, LESSON_OPEN_COST);
        if (updated) { onUpdateUser(updated); saveUserToLive(updated); }
        setCoinModal(null);
        setMcqSelectedLesson(lesson);
        setPendingLesson(null);
      },
    });
  }

  function handleOptionSelect(optIdx: number) {
    // Only record if not already answered for this question
    if (sessionAnswers[sessionQIndex] !== null && sessionAnswers[sessionQIndex] !== undefined) return;
    // Apply level-based daily MCQ limit (if parent provides the tracker)
    if (onMcqAnswer) {
      const isCorrect = optIdx === (sessionMcqs[sessionQIndex]?.correctAnswer);
      if (!onMcqAnswer(isCorrect)) return;
    }
    setSelectedOption(optIdx);
    setSessionAnswers(prev => {
      const next = [...prev];
      next[sessionQIndex] = optIdx;
      return next;
    });
  }

  function handlePrev() {
    if (sessionQIndex <= 0) return;
    const prevIdx = sessionQIndex - 1;
    setSessionQIndex(prevIdx);
    const prevAns = sessionAnswers[prevIdx];
    setSelectedOption(prevAns !== undefined && prevAns !== null ? prevAns : null);
    setShowFeedback(false);
  }

  function finishSession() {
    setSessionActive(false);
    setSessionDone(true);
    // ── Session tracking: App.tsx ko batao session khatam hua ────────────
    window.dispatchEvent(new CustomEvent('iic-mcq-session', {
      detail: { active: false, activityType: 'MCQ' }
    }));

    const lessonId = mcqSelectedLesson?.id || `${mcqSelectedClass}_${mcqSelectedSubject}`;
    const chapterId = lessonId;
    const subjectId = mcqSelectedSubject || 'General';
    const subjectName = mcqSelectedSubject || 'General';
    const chapterTitle = mcqSelectedLesson?.lessonTitle || `Class ${mcqSelectedClass} — ${mcqSelectedSubject}`;

    // Tally totals across all answered questions
    let totalCorrect = 0;
    let totalAnswered = 0;
    sessionMcqs.forEach((q: any, i: number) => {
      if (sessionAnswers[i] === null || sessionAnswers[i] === undefined) return;
      totalAnswered++;
      if (sessionAnswers[i] === q.correctAnswer) totalCorrect++;
    });

    const topicMap: Record<string, { questions: any[]; answers: (number | null)[] }> = {};
    sessionMcqs.forEach((q: any, i: number) => {
      if (sessionAnswers[i] === null || sessionAnswers[i] === undefined) return;
      const t = (q.topic || 'General').trim();
      if (!topicMap[t]) topicMap[t] = { questions: [], answers: [] };
      topicMap[t].questions.push(q);
      topicMap[t].answers.push(sessionAnswers[i]);
    });

    Object.entries(topicMap).forEach(([topic, { questions, answers }]) => {
      try {
        recordAttempt({
          subjectId,
          subjectName,
          chapterId,
          chapterTitle,
          pageKey: chapterId,
          questions,
          userAnswers: answers,
        });
        const correct = answers.filter((a, i) => a !== null && a === questions[i].correctAnswer).length;
        const accuracy = questions.length > 0 ? correct / questions.length : 0;
        const bk = bucketKey(subjectId, chapterId, chapterId, topic);
        applyInitialSchedule(bk, accuracy, revCfg);
      } catch (_) {}
    });

    // ── Save to mcqHistory so My Routine + score tracking can see it ──────────
    if (totalAnswered > 0 && onUpdateUser) {
      const newEntry = {
        id: `rhub-${Date.now()}`,
        testId: `rhub-${Date.now()}`,
        chapterId,
        chapterTitle,
        subjectId,
        subjectName,
        userId: user.id,
        date: new Date().toISOString(),
        totalQuestions: totalAnswered,
        correctCount: totalCorrect,
        wrongCount: totalAnswered - totalCorrect,
        score: totalCorrect,
        totalTimeSeconds: 0,
        averageTimePerQuestion: 0,
        performanceTag: totalCorrect / totalAnswered >= 0.8 ? 'EXCELLENT' : totalCorrect / totalAnswered >= 0.5 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
        type: 'REVISION_MCQ',
      };
      // ── Pts: +2 sahi jawab, +1 galat jawab ──────────────────────────────
      const ptsEarned = (totalCorrect * 2) + ((totalAnswered - totalCorrect) * 1);
      const updatedUser = {
        ...user,
        mcqHistory: [...(user.mcqHistory || []), newEntry],
        totalScore: (user.totalScore || 0) + ptsEarned,
      };
      onUpdateUser(updatedUser);
      try { saveUserToLive(updatedUser); } catch (_) {}
    }
  }

  function resetSession() {
    setSessionActive(false);
    setSessionDone(false);
    setSessionQIndex(0);
    setSessionAnswers([]);
    setSessionMcqs([]);
    setSelectedOption(null);
    setShowFeedback(false);
  }

  const handleTabChange = (tab: HubTab) => {
    setActiveTab(tab);
    setMcqSelectedClass(null);
    setMcqSelectedSubject(null);
    setMcqSelectedLesson(null);
    setShowMonthlySheet(false);
    resetSession();
  };

  const handleBack = () => {
    if (sessionActive || sessionDone) { resetSession(); return; }
    if (mcqSelectedLesson)  { setMcqSelectedLesson(null); return; }
    if (mcqSelectedSubject) { setMcqSelectedSubject(null); return; }
    if (mcqSelectedClass)   { setMcqSelectedClass(null);   return; }
    onBack();
  };

  const titleText =
    sessionDone   ? 'Session Results'                        :
    sessionActive ? `Q${sessionQIndex + 1} / ${sessionMcqs.length}` :
    activeTab === 'MCQ' && mcqSelectedLesson  ? mcqSelectedLesson.lessonTitle :
    activeTab === 'MCQ' && mcqSelectedSubject ? `MCQ — ${mcqSelectedSubject}` :
    activeTab === 'MCQ' && mcqSelectedClass   ? (mcqSelectedClass === 'COMPETITION' ? 'Competition MCQs' : `Class ${mcqSelectedClass}`) :
    'Revision Hub';

  const progress = sessionActive && sessionMcqs.length > 0
    ? ((sessionQIndex) / sessionMcqs.length) * 100
    : 0;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-white" style={{ height: '100dvh' }}>

      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 shadow-sm shrink-0">
        <button
          onClick={handleBack}
          className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-slate-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-slate-800 leading-none truncate">{titleText}</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {sessionActive
              ? `Topic: ${currentQ?.topic || 'General'}`
              : (mcqSelectedClass && activeTab === 'MCQ')
                ? 'MCQ Practice'
                : 'MCQ · Revision · History · Performance'}
          </p>
        </div>
      </div>

      {/* Progress bar (session only) */}
      {sessionActive && (
        <div className="h-1 bg-slate-100 shrink-0">
          <div
            className="h-1 transition-all duration-300"
            style={{ width: `${progress}%`, background: primary }}
          />
        </div>
      )}

      {/* ── Tabs (hidden during session / results) ── */}
      {!sessionActive && !sessionDone && (
        <div className="flex items-center bg-white border-b border-slate-100 shrink-0 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 min-w-[80px] flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-all relative ${
                  isActive ? '' : 'text-slate-400 hover:text-slate-600'
                }`}
                style={isActive ? { color: primary } : {}}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: primary }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20">

        {/* ══ SESSION MODE ══ */}
        {sessionActive && currentQ && (() => {
          const answered   = sessionAnswers.filter(a => a !== null && a !== undefined).length;
          const correct    = sessionAnswers.filter((a, i) => a !== null && a !== undefined && a === sessionMcqs[i]?.correctAnswer).length;
          const wrong      = answered - correct;
          const isAnswered = sessionAnswers[sessionQIndex] !== null && sessionAnswers[sessionQIndex] !== undefined;
          const minRequired = Math.min(30, sessionMcqs.length);
          const ready      = answered >= minRequired;

          return (
          <div className="p-4 max-w-xl mx-auto space-y-4">

            {/* Running score counter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                {currentQ.topic || 'General'}
              </span>
              <span className="text-[10px] text-slate-400 ml-auto">{sessionQIndex + 1}/{sessionMcqs.length}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle size={10} /> {correct}
                </span>
                <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <XCircle size={10} /> {wrong}
                </span>
              </div>
            </div>

            {/* Question */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start gap-2">
                <p className="font-bold text-slate-800 text-sm leading-relaxed flex-1"
                  dangerouslySetInnerHTML={{ __html: (currentQ.question || '').replace(/<br\/?>/g, '\n') }}
                />
                {onSendToMcqCommunity && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const opts = (currentQ.options || []).length === 4
                        ? currentQ.options as [string,string,string,string]
                        : ([...(currentQ.options || []), '', '', '', ''].slice(0, 4) as [string,string,string,string]);
                      onSendToMcqCommunity({ question: currentQ.question, options: opts, correctAnswer: currentQ.correctAnswer ?? 0, explanation: currentQ.explanation || '' });
                    }}
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-all bg-indigo-100 text-indigo-600"
                    title="MCQ Community mein bhejo"
                  >
                    <Plus size={13} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>

            {/* Options — blue highlight only, no green/red until submit */}
            <div className="space-y-2.5">
              {(currentQ.options || []).map((opt: string, oi: number) => {
                const isSelected = selectedOption === oi;
                let cls = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200 active:scale-[0.99]';
                if (isSelected) cls = 'bg-blue-50 border-blue-400 text-blue-800';
                else if (isAnswered) cls = 'bg-slate-50 border-slate-100 text-slate-400 opacity-60';
                return (
                  <button
                    key={oi}
                    onClick={() => handleOptionSelect(oi)}
                    disabled={isAnswered}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${cls}`}
                  >
                    <span className="font-black mr-2">{String.fromCharCode(65 + oi)}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Bottom navigation row */}
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                {/* Prev button */}
                <button
                  onClick={handlePrev}
                  disabled={sessionQIndex === 0}
                  className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-all bg-white"
                >
                  <ArrowLeft size={15} /> Pichla
                </button>

                {/* Next button — shows as soon as option selected */}
                {isAnswered && sessionQIndex < sessionMcqs.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="flex-1 flex items-center justify-center gap-2 active:scale-[0.99] text-white font-bold py-3.5 rounded-2xl transition-all"
                    style={{ background: primary }}
                  >
                    Agla Sawaal <ChevronRight size={16} />
                  </button>
                ) : (
                  <div className="flex-1 flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-3.5">
                    <p className="text-[11px] text-slate-400 font-bold">
                      {isAnswered ? '✓ Last question' : '⬆ Ek option chunein'}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit button */}
              <button
                onClick={finishSession}
                disabled={!ready}
                className={`w-full py-3.5 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-sm ${ready ? 'active:scale-[0.99] text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                style={ready ? { background: '#16a34a' } : {}}
              >
                {ready
                  ? <><Trophy size={16} /> Submit karein ({answered} answered)</>
                  : `${answered}/${minRequired} — ${minRequired - answered} aur sawaal do`}
              </button>
            </div>
          </div>
          );
        })()}

        {/* ══ SESSION RESULTS ══ */}
        {sessionDone && (
          <div className="p-4 max-w-xl mx-auto space-y-4">
            {/* Header */}
            <div className="rounded-2xl p-5 text-white text-center" style={{ background: `linear-gradient(135deg, ${primary}ee, ${primary})` }}>
              <BrainCircuit size={32} className="mx-auto mb-2 opacity-80" />
              <p className="text-lg font-black">Session Complete!</p>
              <p className="text-xs opacity-70 mt-1">Revision schedule update ho gaya ✓</p>
            </div>

            {/* Per-topic results */}
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 text-center">Topic-wise Results</p>
            {topicResults.map(({ topic, correct, total }) => {
              const pct = total > 0 ? (correct / total) * 100 : 0;
              const tier = accuracyTier(pct, revCfg);
              const style = TIER_STYLES[tier];
              const revSecs = nextRevisionSecs(pct, revCfg);
              return (
                <div key={topic} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-black ${style.bg} ${style.text}`}>
                      <span className="text-sm leading-none">{correct}/{total}</span>
                      <span className="text-[9px] uppercase">score</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{topic}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </div>
                  </div>

                  {/* Schedule line */}
                  <div className="px-4 pb-3 flex items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5 text-indigo-600">
                      <BookOpen size={12} />
                      <span className="font-bold">Notes: <span className="text-slate-600">Kal</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <Calendar size={12} />
                      <span className="font-bold">
                        MCQ: <span className="text-slate-600">{daysLabel(revSecs + 86400)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-violet-600 ml-auto">
                      <Zap size={12} />
                      <span className="font-bold">Interval: {Math.round(revSecs / 86400)}d</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Q-by-Q Review */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 text-center mb-3">Sawaal-wise Review</p>
              <div className="space-y-2">
                {sessionMcqs.map((q: any, qi: number) => {
                  const userAns = sessionAnswers[qi];
                  // Only show questions that were actually attempted
                  if (userAns === null || userAns === undefined) return null;
                  const isCorrect = userAns === q.correctAnswer;
                  return (
                    <div key={qi} className={`rounded-2xl border overflow-hidden ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                      <div className="flex items-start gap-3 px-4 py-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isCorrect ? '✅' : '❌'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-slate-400 mb-0.5">Q{qi + 1} · {q.topic || 'General'}</p>
                          <p className="text-xs font-bold text-slate-800 leading-relaxed line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: (q.question || '').replace(/<br\/?>/g, ' ') }}
                          />
                          <div className="mt-1.5 space-y-0.5">
                            {!isCorrect && (
                              <p className="text-[10px] text-rose-600 font-bold">
                                ❌ Tumhara: {String.fromCharCode(65 + userAns)}. {q.options?.[userAns] || ''}
                              </p>
                            )}
                            <p className="text-[10px] text-emerald-700 font-bold">
                              ✅ Sahi: {String.fromCharCode(65 + q.correctAnswer)}. {q.options?.[q.correctAnswer] || ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info box */}
            <div className="rounded-2xl px-4 py-3 text-xs leading-relaxed" style={{ background: `${primary}12`, border: `1px solid ${primary}25`, color: primary }}>
              <p className="font-black mb-1">📅 Performance Save Ho Gaya</p>
              <p><strong>Revision Hub → Performance</strong> tab mein Weak / Average / Strong topics dekhein. <strong>Aaj Ka Kaam</strong> tab mein notes aur MCQ schedule milega.</p>
            </div>

            <button
              onClick={resetSession}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl transition-all"
            >
              <RotateCcw size={16} /> Wapas Jao
            </button>
          </div>
        )}

        {/* MCQ → Class Selection */}
        {activeTab === 'MCQ' && !mcqSelectedClass && !sessionActive && !sessionDone && (
          <div className="p-4 space-y-3">
            {/* Header — same as home page */}
            <div className="flex items-center gap-2">
              <span className="flex-1 h-px bg-slate-100" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Apni Class Choose Karein</span>
              <span className="flex-1 h-px bg-slate-100" />
            </div>

            {(() => {
              const _c612Bg  = (settings as any)?.homeClass612CardBg     || '#ffffff';
              const _c612Bdr = (settings as any)?.homeClass612CardBorder  || primary;
              const _card3D  = (settings as any)?.homeAllCards3D || (settings as any)?.homeClass612Card3D || false;
              const boardClasses = ['10', '11', '12'];

              const cardStyle3D = _card3D ? {
                background: _c612Bg,
                border: `2px solid ${_c612Bdr}`,
                boxShadow: `0 1px 0 rgba(255,255,255,0.85) inset, 0 4px 0 ${_c612Bdr}bb, 0 7px 18px ${_c612Bdr}28`,
                transform: 'translateY(-1px)',
              } : {
                background: _c612Bg,
                border: `2px solid ${_c612Bdr}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              };

              const ClassBtn = ({ c }: { c: string }) => {
                const subjCount = new Set(
                  hubLessons.filter(l => l.classLevel === c && l.subject).map(l => l.subject as string),
                ).size;
                const isBoard = boardClasses.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => setMcqSelectedClass(c)}
                    className="relative flex flex-col p-2.5 rounded-xl active:scale-95 transition-all text-left"
                    style={cardStyle3D}
                  >
                    {isBoard ? (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[7px] font-black bg-amber-400 text-amber-900 leading-none">👑</span>
                    ) : (
                      <span className="absolute top-1.5 right-1.5 text-sm leading-none select-none opacity-60">{CLASS_EMOJIS[c]}</span>
                    )}
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CLASS</p>
                    <p className="text-2xl font-black leading-none mb-1" style={{ color: _c612Bdr }}>{c}</p>
                    <p className="text-[9px] font-bold text-slate-500 leading-tight">{subjCount} Subj.</p>
                  </button>
                );
              };

              const _cmpBg  = (settings as any)?.homeCompetitionCardBg     || (theme as any).profileCardBg || '#ffffff';
              const _cmpBdr = (settings as any)?.homeCompetitionCardBorder  || primary;
              const _cmp3D  = (settings as any)?.homeAllCards3D || (settings as any)?.homeCompetitionCard3D || false;

              return (
                <>
                  {/* Row 1: Class 6-9 (4 columns) */}
                  <div className="grid grid-cols-4 gap-2">
                    {['6','7','8','9'].map(c => <ClassBtn key={c} c={c} />)}
                  </div>
                  {/* Row 2: Class 10-12 (3 columns) */}
                  <div className="grid grid-cols-3 gap-2">
                    {['10','11','12'].map(c => <ClassBtn key={c} c={c} />)}
                  </div>

                  {/* Competition card — matches home page big banner style */}
                  <button
                    onClick={() => setMcqSelectedClass('COMPETITION')}
                    className="w-full relative overflow-hidden rounded-2xl text-left active:scale-[0.99] transition-all"
                    style={_cmp3D ? {
                      background: _cmpBg,
                      border: `2px solid ${_cmpBdr}`,
                      boxShadow: `0 1px 0 rgba(255,255,255,0.85) inset, 0 4px 0 ${_cmpBdr}bb, 0 7px 18px ${_cmpBdr}28`,
                      transform: 'translateY(-1px)',
                    } : {
                      background: _cmpBg,
                      border: `2px solid ${_cmpBdr}`,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="flex items-center justify-between px-4 py-4">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: _cmpBdr }}>Competitive Mode</p>
                        <h3 className="text-[22px] font-black leading-tight mb-1 text-slate-800">Govt. Exams</h3>
                        <div className="mb-3">
                          <span className="text-[10px] text-slate-400">SSC · UPSC · Railway · Police</span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black text-white" style={{ background: _cmpBdr }}>
                          Tap to open →
                        </span>
                      </div>
                      <div className="text-[52px] leading-none shrink-0 select-none">🏛️</div>
                    </div>
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {/* MCQ → Subject Selection */}
        {activeTab === 'MCQ' && mcqSelectedClass && !mcqSelectedSubject && !sessionActive && !sessionDone && (
          <div className="p-4 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-center py-2 text-slate-400">
              Subject Choose Karein
            </p>
            {mcqSubjects.map((sub: any) => {
              const lessonCount = hubLessons.filter(l => l.classLevel === mcqSelectedClass && l.subject === sub.name).length;
              return (
                <button
                  key={sub.id}
                  onClick={() => setMcqSelectedSubject(sub.name)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white active:scale-[0.99] active:translate-y-0.5 transition-all"
                  style={{ border: `1.5px solid #e2e8f0`, boxShadow: `0 4px 0 0 #cbd5e1, 0 4px 12px rgba(0,0,0,0.05)` }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${primary}18` }}>
                    📚
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-slate-800 text-sm">{sub.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {lessonCount > 0 ? `${lessonCount} lessons` : 'Lesson abhi nahi hai'}
                    </p>
                  </div>
                  {lessonCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${primary}18`, color: primary }}>
                      {lessonCount}
                    </span>
                  )}
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              );
            })}
          </div>
        )}

        {/* MCQ → Lesson List */}
        {activeTab === 'MCQ' && mcqSelectedClass && mcqSelectedSubject && !mcqSelectedLesson && !sessionActive && !sessionDone && (
          <div className="p-4 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center py-1">
              Lesson Choose Karein
            </p>
            {subjectLessons.length === 0 ? (
              <div className="text-center py-14">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-slate-700 font-bold">Is subject mein abhi koi lesson nahi</p>
                <p className="text-slate-400 text-sm mt-1">Admin jald hi MCQs add karenge</p>
              </div>
            ) : (
              subjectLessons.map((lesson: any) => (
                <button
                  key={lesson.id}
                  onClick={() => handleLessonClick(lesson)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white active:scale-[0.99] active:translate-y-0.5 transition-all"
                  style={{ border: '1.5px solid #e2e8f0', boxShadow: '0 4px 0 0 #cbd5e1, 0 4px 12px rgba(0,0,0,0.05)' }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${primary}18` }}>📖</div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{lesson.lessonTitle}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${primary}18`, color: primary }}>
                        {(lesson.mcqs || []).filter((q: any) => q.topic && String(q.topic).trim() !== '').length} MCQs
                      </span>
                      {(lesson.topics || []).slice(0, 2).map((t: string) => (
                        <span key={t} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full truncate max-w-[90px]">
                          {t}
                        </span>
                      ))}
                      {(lesson.topics || []).length > 2 && (
                        <span className="text-[9px] text-slate-400">+{lesson.topics.length - 2} more</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        )}

        {/* MCQ → Start Session */}
        {activeTab === 'MCQ' && mcqSelectedLesson && !sessionActive && !sessionDone && (
          <div className="p-4 max-w-xl mx-auto">
            <div className="space-y-4">
              {/* Summary card */}
              <div className="rounded-2xl p-5 text-center" style={{ background: `${primary}10`, border: `1px solid ${primary}25` }}>
                <div className="text-4xl mb-2">📖</div>
                <p className="font-black text-slate-800 text-lg leading-tight">{mcqSelectedLesson.lessonTitle}</p>
                <p className="text-slate-500 text-sm mt-1">Class {mcqSelectedClass} · {mcqSelectedSubject}</p>
                <div className="mt-3 flex items-center justify-center gap-3 text-sm">
                  <span className="bg-white rounded-xl px-3 py-1.5 font-bold" style={{ border: `1px solid ${primary}25`, color: primary }}>
                    {classMcqs.length} Sawaal
                  </span>
                  <span className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-600">
                    {[...new Set(classMcqs.map((q: any) => q.topic || 'General'))].length} Topics
                  </span>
                </div>
              </div>

              {/* Topic preview */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Topics in this lesson</p>
                {[...new Set(classMcqs.map((q: any) => q.topic || 'General'))].map((t: any) => {
                  const cnt = classMcqs.filter((q: any) => (q.topic || 'General') === t).length;
                  return (
                    <div key={t} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 font-medium truncate flex-1">{t}</span>
                      <span className="text-[11px] font-bold ml-2 shrink-0" style={{ color: primary }}>{cnt}Q</span>
                    </div>
                  );
                })}
              </div>

              {/* Info */}
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-700 flex gap-2">
                <span>💡</span>
                <span>MCQ complete karne ke baad topic-wise Weak/Average/Strong automatically save ho jayega.</span>
              </div>

              <button
                onClick={startSession}
                className="w-full flex items-center justify-center gap-2 active:scale-[0.99] text-white font-black py-4 rounded-2xl text-base transition-all shadow-lg"
                style={{ background: primary }}
              >
                <Zap size={20} /> MCQ Session Shuru Karo
              </button>
            </div>
          </div>
        )}

        {/* Revision Tab — full RevisionHubV2 embedded (header hidden to avoid duplicate title) */}
        {activeTab === 'REVISION' && (
          <RevisionHubV2
            user={user}
            settings={settings}
            onBack={() => setActiveTab('MCQ')}
            onTabChange={onTabChange}
            onNavigateContent={onNavigateContent}
            onUpdateUser={onUpdateUser}
            hideHeader={true}
            onMcqAnswer={onMcqAnswer}
          />
        )}

        {/* Performance Tab */}
        {activeTab === 'PERFORMANCE' && (
          <div className="p-4 space-y-4">
            <PerformanceGraph
              history={(user as any).mcqHistory || []}
              user={user}
            />
            <button
              onClick={() => setShowMonthlySheet(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-indigo-200 bg-indigo-50 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div className="text-left">
                  <p className="font-black text-slate-800 text-sm">Monthly Report</p>
                  <p className="text-[10px] text-slate-500">Full marksheet aur analysis</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-indigo-400" />
            </button>
          </div>
        )}
      </div>

      {showMonthlySheet && (
        <MonthlyMarksheet
          user={user}
          settings={settings}
          onClose={() => setShowMonthlySheet(false)}
        />
      )}

      {/* Coin deduction modal */}
      {coinModal && (
        <CreditConfirmationModal
          title={coinModal.title}
          cost={coinModal.cost}
          userCredits={getTotalCredits(user)}
          onConfirm={() => coinModal.onConfirm()}
          onCancel={() => { setCoinModal(null); setPendingLesson(null); }}
          isAutoEnabledInitial={false}
        />
      )}
    </div>
  );
};
