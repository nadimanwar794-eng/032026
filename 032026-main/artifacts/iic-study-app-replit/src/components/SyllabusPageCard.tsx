import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  BookOpen,
  Brain,
  CheckCircle2,
  AlertCircle,
  Lock,
  ChevronDown,
  ChevronUp,
  Trophy,
  RotateCcw,
  PenTool,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  getPageTime,
  isRoutinePageRead,
  calculatePageRequiredReadingSec,
} from '../utils/routineAutoTrack';
import {
  getStudyActivity,
  getStudyActivityKey,
  type McqScoreAttempt,
} from '../utils/activityTracker';

export interface SyllabusPageCardProps {
  page: any;
  pageIndex: number;
  lessonId: string;
  lessonTitle: string;
  user: any;
  settings?: any;
  tierTheme: any;
  isOpen: boolean;
  onToggle: () => void;
  onOpenReading: () => void;
  onOpenWriting?: () => void;
  onOpenMcq: () => void;
  onPracticeMistakes?: () => void;
  onOpenFlashcard?: () => void;
  onOpenProjector?: () => void;
  onOpenPdf?: () => void;
  onOpenVideo?: () => void;
  onOpenAudio?: () => void;
  adminAction?: React.ReactNode;
  showAlert: (msg: string, type?: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING', title?: string) => void;
}

function formatSecs(sec: number): string {
  if (sec <= 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export const SyllabusPageCard: React.FC<SyllabusPageCardProps> = ({
  page,
  pageIndex,
  lessonId,
  lessonTitle,
  user,
  settings,
  tierTheme,
  isOpen,
  onToggle,
  onOpenReading,
  onOpenWriting,
  onOpenMcq,
  onPracticeMistakes,
  onOpenFlashcard,
  onOpenProjector,
  onOpenPdf,
  onOpenVideo,
  onOpenAudio,
  adminAction,
  showAlert,
}) => {
  const contentKey = useMemo(() => getStudyActivityKey(lessonId, pageIndex), [lessonId, pageIndex]);

  // Live periodic activity polling when card is open
  const [actStats, setActStats] = useState(() => getStudyActivity(user.id, contentKey));
  useEffect(() => {
    if (!isOpen) return;
    setActStats(getStudyActivity(user.id, contentKey));
    const interval = window.setInterval(() => {
      setActStats(getStudyActivity(user.id, contentKey));
    }, 1500);
    return () => window.clearInterval(interval);
  }, [isOpen, user.id, contentKey]);

  // ── 1. Reading Time Calculation (Combined: Read + Write) ──
  const storedPageSec = getPageTime(lessonId, pageIndex);
  const actReadSec = actStats?.READING?.seconds || 0;
  const readSec = Math.max(storedPageSec, actReadSec);
  const writeSec = actStats?.WRITING?.seconds || 0;
  const combinedReadingSec = readSec + writeSec;

  const reqSec = useMemo(() => calculatePageRequiredReadingSec(page), [page]);
  const isReadGoalMet = isRoutinePageRead(lessonId, pageIndex) || combinedReadingSec >= reqSec;

  // User subscription checks
  const isPremiumUser = !!(
    user.isPremium ||
    user.subscriptionLevel === 'BASIC' ||
    user.subscriptionLevel === 'ULTRA' ||
    user.subscriptionTier === 'BASIC' ||
    user.subscriptionTier === 'ULTRA'
  );
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUB_ADMIN';

  // ── 2. Reading Score % ──
  // Rule:
  // - If goal met: 100%
  // - If NOT met:
  //    - Premium user: 0% (reading incomplete affects syllabus score)
  //    - Free user: proportional %
  const readingScorePct = isReadGoalMet
    ? 100
    : isPremiumUser
    ? 0
    : Math.min(99, Math.round((combinedReadingSec / Math.max(reqSec, 1)) * 100));

  // ── 3. MCQ Score & Performance ──
  const totalMcq = (page.mcqs || (page as any).parsedMcqs || []).length;
  const mcqScoreHist = useMemo(() => {
    const hist = [...((actStats?.MCQ?.scoreHistory || []) as McqScoreAttempt[])];
    if (hist.length === 0 && Array.isArray(user?.mcqHistory)) {
      const match = user.mcqHistory.find(
        (h: any) => h.chapterId === lessonId || (h.id && h.id.includes(lessonId))
      );
      if (match) {
        hist.push({
          correct: match.correctCount ?? 0,
          total: match.totalQuestions ?? 0,
          seconds: 0,
          attemptedAt: match.date || new Date().toISOString(),
        });
      }
    }
    return hist;
  }, [actStats?.MCQ?.scoreHistory, user?.mcqHistory, lessonId]);
  const latestMcq = mcqScoreHist.at(-1);
  const bestMcq =
    mcqScoreHist.length > 0
      ? mcqScoreHist.reduce(
          (b, s) =>
            s.total > 0 && s.correct / s.total > b.correct / Math.max(b.total, 1) ? s : b,
          mcqScoreHist[0]
        )
      : undefined;

  const attemptsCount = mcqScoreHist.length;
  const hasAttemptedMcq = attemptsCount > 0;
  const bestMcqPct =
    bestMcq && bestMcq.total > 0
      ? Math.round((bestMcq.correct / bestMcq.total) * 100)
      : 0;

  // Mistakes count in latest attempt
  const wrongCount = latestMcq ? Math.max(0, latestMcq.total - latestMcq.correct) : 0;

  // ── 4. Free vs Premium MCQ Gate ──
  // Free users cannot open MCQ until required reading time is completed.
  const isMcqLocked = !isAdmin && !isPremiumUser && !isReadGoalMet;

  // ── 5. Consolidated Page Mastery % ──
  // If MCQ exists: (Reading% + Best MCQ%) / 2
  // If no MCQ: Reading%
  const pageMasteryPct = useMemo(() => {
    if (totalMcq > 0) {
      const mcqVal = hasAttemptedMcq ? bestMcqPct : 0;
      return Math.round((readingScorePct + mcqVal) / 2);
    }
    return readingScorePct;
  }, [totalMcq, readingScorePct, hasAttemptedMcq, bestMcqPct]);

  // ── 6. Status Chip ──
  const statusConfig = useMemo(() => {
    if (isReadGoalMet && (totalMcq === 0 || (hasAttemptedMcq && bestMcqPct >= 60))) {
      return {
        label: 'Mastered',
        dot: '🟢',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (isReadGoalMet && totalMcq > 0 && (!hasAttemptedMcq || bestMcqPct < 60)) {
      return {
        label: 'MCQ Pending',
        dot: '🟠',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    if (!isReadGoalMet && combinedReadingSec > 0) {
      return {
        label: 'Reading Needed',
        dot: '⏳',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }
    return {
      label: 'Not Started',
      dot: '⚪',
      bg: 'bg-slate-50 text-slate-500 border-slate-200',
    };
  }, [isReadGoalMet, totalMcq, hasAttemptedMcq, bestMcqPct, combinedReadingSec]);

  // Display texts
  const pageNumStr = page.pageNo ? `Pg ${page.pageNo}` : `Pg ${pageIndex + 1}`;
  const topicTitle = (page.topicName || '').trim() || page.title || lessonTitle || `Page ${pageIndex + 1}`;
  const snippet = ((page as any).chunkNotes || page.content || (page as any).notes || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 95);

  const handleLockedMcqClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rem = Math.max(0, reqSec - combinedReadingSec);
    showAlert(
      `🔒 Free users ke liye pehle reading complete karna zaroori hai!\nReading Mode ya Writing Mode me ${formatSecs(
        rem
      )} aur padhein, uske baad MCQ automatic unlock ho jayega.`,
      'INFO',
      'MCQ Locked'
    );
  };

  return (
    <div
      className="nst-page-card nst-card-animated rounded-2xl overflow-hidden border transition-all"
      style={{
        borderColor: isReadGoalMet && (totalMcq === 0 || bestMcqPct >= 60)
          ? '#6ee7b7'
          : isReadGoalMet
          ? '#fed7aa'
          : (settings?.contentListCardBorder ? `${settings.contentListCardBorder}55` : '#e2e8f0'),
        background: settings?.contentListCardBg || '#ffffff',
      }}
    >
      {/* ── 1. Collapsed (Band) Card: 3 Hero Elements ── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3.5 flex items-center justify-between gap-3 active:bg-slate-50/70 transition-colors"
        aria-expanded={isOpen}
      >
        {/* Left Hero: Page Number & Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 border transition-all"
            style={{
              background: isReadGoalMet && (totalMcq === 0 || bestMcqPct >= 60)
                ? '#ecfdf5'
                : isReadGoalMet
                ? '#fff7ed'
                : `${tierTheme.primary}12`,
              borderColor: isReadGoalMet && (totalMcq === 0 || bestMcqPct >= 60)
                ? '#a7f3d0'
                : isReadGoalMet
                ? '#fed7aa'
                : `${tierTheme.primary}33`,
            }}
          >
            <span
              className="text-[11px] font-black leading-none"
              style={{
                color: isReadGoalMet && (totalMcq === 0 || bestMcqPct >= 60)
                  ? '#059669'
                  : isReadGoalMet
                  ? '#ea580c'
                  : tierTheme.primary,
              }}
            >
              {pageNumStr}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-black text-slate-800 truncate leading-snug">
                {topicTitle}
              </h4>
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100/90 border border-slate-200/80 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1" title="Word count reading time">
                ⏱️ {formatSecs(reqSec)}
              </span>
            </div>
            {snippet && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                {snippet}…
              </p>
            )}
          </div>
        </div>

        {/* Center Hero: Clean Mastery Progress Bar */}
        <div className="shrink-0 hidden sm:flex flex-col items-end gap-1 px-2">
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} className={pageMasteryPct >= 70 ? 'text-amber-500' : 'text-slate-400'} />
            <span className="text-[11px] font-black text-slate-700">
              {pageMasteryPct}% <span className="text-[9px] font-bold text-slate-400 font-normal">Mastered</span>
            </span>
          </div>
          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pageMasteryPct >= 70
                  ? 'bg-emerald-500'
                  : pageMasteryPct >= 40
                  ? 'bg-amber-500'
                  : 'bg-slate-300'
              }`}
              style={{ width: `${pageMasteryPct}%` }}
            />
          </div>
        </div>

        {/* Right Hero: Smart Status Chip + Chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Mastery Mini badge */}
          <div className="sm:hidden flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-700">{pageMasteryPct}%</span>
            <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  pageMasteryPct >= 70 ? 'bg-emerald-500' : pageMasteryPct >= 40 ? 'bg-amber-500' : 'bg-slate-300'
                }`}
                style={{ width: `${pageMasteryPct}%` }}
              />
            </div>
          </div>

          <span
            className={`px-2 py-0.5 rounded-full border text-[9px] font-black flex items-center gap-1 shrink-0 ${statusConfig.bg}`}
          >
            <span>{statusConfig.dot}</span>
            <span className="hidden xs:inline">{statusConfig.label}</span>
          </span>

          <div className="p-1 text-slate-400 rounded-lg hover:bg-slate-100">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {/* ── 2. Expanded (Kholne Par): 2 Sleek Actionable Pillars ── */}
      {isOpen && (
        <div className="px-3 pb-3.5 pt-1 space-y-2.5 bg-slate-50/60 border-t border-slate-100 animate-in fade-in">
          {/* 📖 Pillar 1: Reading & Writing Progress */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                <BookOpen size={14} className="text-indigo-600" />
                <span>Reading & Notes</span>
              </div>
              <div>
                {isReadGoalMet ? (
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={10} strokeWidth={2.5} /> Goal Achieved (100%)
                  </span>
                ) : (
                  <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock size={10} strokeWidth={2.5} />
                    {formatSecs(Math.max(0, reqSec - combinedReadingSec))} aur padhna hai
                  </span>
                )}
              </div>
            </div>

            {/* Reading progress bar */}
            <div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                <span>
                  ⏱️ {formatSecs(combinedReadingSec)}{' '}
                  <span className="text-slate-400 font-normal">/ Req: {formatSecs(reqSec)}</span>
                </span>
                <span className={isReadGoalMet ? 'text-emerald-600 font-black' : 'text-slate-600 font-bold'}>
                  {Math.min(100, Math.round((combinedReadingSec / Math.max(reqSec, 1)) * 100))}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isReadGoalMet ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((combinedReadingSec / Math.max(reqSec, 1)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Breakdown */}
            <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-0.5 flex-wrap">
              <span>📖 Reading: <strong className="text-slate-700">{formatSecs(readSec)}</strong></span>
              {writeSec > 0 && (
                <span>✍️ Writing: <strong className="text-slate-700">{formatSecs(writeSec)}</strong></span>
              )}
            </div>

            {/* Premium warning if reading not complete */}
            {isPremiumUser && !isReadGoalMet && (
              <p className="text-[9px] font-bold text-rose-500 bg-rose-50/70 border border-rose-200 rounded-lg p-1.5 flex items-center gap-1">
                <AlertCircle size={11} className="shrink-0" />
                Reading target bacha hai! Premium me MCQ unlocked hai par reading score 0% rahega jab tak reading poori na ho.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenReading(); }}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all"
              >
                <BookOpen size={13} />
                {combinedReadingSec > 0 ? 'Continue Reading' : 'Start Reading'}
              </button>

              {page.htmlNotes && onOpenWriting && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenWriting(); }}
                  className="py-2 px-3 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-black flex items-center justify-center gap-1 active:scale-98 transition-all shrink-0"
                  title="Practice writing notes"
                >
                  <PenTool size={12} />
                  Writing Mode
                </button>
              )}
            </div>
          </div>

          {/* 🧠 Pillar 2: MCQ & Tests */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                <Brain size={14} className="text-purple-600" />
                <span>MCQ & Performance</span>
              </div>
              {totalMcq > 0 && (
                <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  {totalMcq} Questions
                </span>
              )}
            </div>

            {totalMcq === 0 ? (
              <p className="text-[10px] text-slate-400 italic py-1">
                Is page ke liye koi MCQ available nahi hai.
              </p>
            ) : (
              <>
                {/* Score Summary */}
                {hasAttemptedMcq ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
                      <span className="font-black text-slate-700">
                        Latest: <strong className={bestMcqPct >= 60 ? 'text-emerald-600' : 'text-rose-500'}>
                          {latestMcq?.correct}/{latestMcq?.total} ({Math.round(((latestMcq?.correct || 0) / Math.max(latestMcq?.total || 1, 1)) * 100)}%)
                        </strong>
                      </span>
                      {bestMcq && (
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Trophy size={10} /> Best: {bestMcq.correct}/{bestMcq.total} ({bestMcqPct}%)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                      <span>{attemptsCount} attempt{attemptsCount === 1 ? '' : 's'} total</span>
                      {wrongCount > 0 ? (
                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <XCircle size={10} /> {wrongCount} Mistakes to correct
                        </span>
                      ) : (
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 size={10} /> 0 Mistakes
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 py-1">
                    Abhi tak test attempt nahi kiya gaya hai.
                  </div>
                )}

                {/* Lock note for Free users or warning for Premium users */}
                {isMcqLocked ? (
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleLockedMcqClick}
                      className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300/80 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                    >
                      <Lock size={13} className="text-slate-500" />
                      MCQ Locked (Pehle reading complete karein)
                    </button>
                    <p className="text-[9px] text-slate-400 text-center">
                      Free users ko pehle reading time ({formatSecs(reqSec)}) pura karna hoga tabhi MCQ unlock hoga.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenMcq(); }}
                        className="flex-1 min-w-[120px] py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all"
                      >
                        <Brain size={13} />
                        {hasAttemptedMcq ? 'Re-attempt MCQ' : 'Start MCQ Test'}
                      </button>

                      {wrongCount > 0 && onPracticeMistakes && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onPracticeMistakes(); }}
                          className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-black flex items-center justify-center gap-1 active:scale-98 transition-all shrink-0"
                          title="Practice mistakes"
                        >
                          <RotateCcw size={12} />
                          Practice Mistakes ({wrongCount})
                        </button>
                      )}
                    </div>

                    {isPremiumUser && !isReadGoalMet && (
                      <p className="text-[9px] font-bold text-amber-600 bg-amber-50 rounded-lg p-1.5 border border-amber-200">
                        ⚡ Premium pass se MCQ open hai, par reading score 0% rahega jab tak reading goal poora nahi hota.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {(onOpenPdf || onOpenVideo || onOpenAudio) && (
            <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-2xs flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Media:</span>
              {onOpenPdf && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenPdf(); }}
                  className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black flex items-center gap-1 active:scale-98 transition-all"
                >
                  📄 PDF
                </button>
              )}
              {onOpenVideo && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenVideo(); }}
                  className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-black flex items-center gap-1 active:scale-98 transition-all"
                >
                  🎬 Video
                </button>
              )}
              {onOpenAudio && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenAudio(); }}
                  className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center gap-1 active:scale-98 transition-all"
                >
                  🔊 Audio
                </button>
              )}
            </div>
          )}

          {adminAction && (
            <div className="flex justify-end pt-1">
              {adminAction}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
