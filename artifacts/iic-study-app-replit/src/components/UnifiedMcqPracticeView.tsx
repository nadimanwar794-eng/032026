// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, AlertTriangle, CheckCircle, Trophy, ArrowLeft, ChevronLeft, 
  ChevronRight, Star, LayoutGrid, X, RotateCcw, 
  AlertCircle, CheckCircle2, Plus, RefreshCw, Award, BookOpen
} from 'lucide-react';
import { renderMathInHtml } from '../utils/mathUtils';
import { hapticLight, hapticMedium, hapticStrong } from '../utils/haptic';
import McqQuestionDisplay from './McqQuestionDisplay';

export interface UnifiedMcqPracticeProps {
  questions: any[];
  title: string;
  subtitle?: string;
  subject?: string;
  accent?: string;
  hideTopHeader?: boolean;
  onTimeUpdate?: (seconds: number) => void;
  externalPaletteOpen?: boolean;
  onTogglePalette?: (open: boolean) => void;
  initialAnswers?: Record<number, number>;
  initialSubmitted?: Record<number, boolean>;
  onBack: () => void;
  onAnswer?: (qIndex: number, optionIndex: number | null, isCorrect: boolean) => void;
  onSubmit: (result: {
    score: number;
    total: number;
    answers: Record<number, number>;
    bookmarked: number[];
    timeElapsedSeconds: number;
  }) => void;
  onRestart?: () => void;
  onPracticeMistakes?: (wrongIndices: number[]) => void;
  onOpenAnalysis?: () => void;
  onSendToMcqCommunity?: (question: any) => void;
  user?: any;
  settings?: any;
}

export const UnifiedMcqPracticeView: React.FC<UnifiedMcqPracticeProps> = ({
  questions = [],
  title,
  subtitle,
  subject,
  accent = '#4f46e5',
  hideTopHeader = false,
  onTimeUpdate,
  externalPaletteOpen,
  onTogglePalette,
  initialAnswers = {},
  initialSubmitted = {},
  onBack,
  onAnswer,
  onSubmit,
  onRestart,
  onPracticeMistakes,
  onOpenAnalysis,
  onSendToMcqCommunity,
  user,
  settings,
}) => {
  const [answers, setAnswers] = useState<Record<number, number>>(initialAnswers);
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  
  // Modals and Drawers
  const [showPaletteDrawer, setShowPaletteDrawer] = useState<boolean>(false);
  const isPaletteDrawerOpen = externalPaletteOpen !== undefined ? externalPaletteOpen : showPaletteDrawer;
  const setPaletteOpenState = (open: boolean) => {
    setShowPaletteDrawer(open);
    if (onTogglePalette) onTogglePalette(open);
  };
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'attempted' | 'marked' | 'skipped' | 'unattempted'>('all');
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Time tracking
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const quickStripRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  const safeQuestions = Array.isArray(questions) ? questions : [];
  const totalQuestions = safeQuestions.length;

  // Sync initialAnswers if they change externally
  useEffect(() => {
    if (Object.keys(initialAnswers).length > 0 && Object.keys(answers).length === 0) {
      setAnswers(initialAnswers);
    }
  }, [initialAnswers]);

  // Timer: count elapsed seconds
  useEffect(() => {
    if (isFinished) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeElapsed(prev => {
        const next = prev + 1;
        if (onTimeUpdate) onTimeUpdate(next);
        return next;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isFinished, onTimeUpdate]);

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-scroll current question in horizontal strip
  useEffect(() => {
    if (!quickStripRef.current) return;
    const btn = quickStripRef.current.querySelector(`[data-qindex="${currentIndex}"]`) as HTMLElement;
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showSubmitModal || showExitModal || showPaletteDrawer || isFinished) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (['1', 'a', 'A'].includes(e.key)) {
        handleSelectOption(0);
      } else if (['2', 'b', 'B'].includes(e.key)) {
        handleSelectOption(1);
      } else if (['3', 'c', 'C'].includes(e.key)) {
        handleSelectOption(2);
      } else if (['4', 'd', 'D'].includes(e.key)) {
        handleSelectOption(3);
      } else if (['m', 'M'].includes(e.key)) {
        toggleMarkCurrent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, answers, totalQuestions, showSubmitModal, showExitModal, showPaletteDrawer, isFinished]);

  const attemptedCount = Object.keys(answers).length;
  const unattemptedCount = Math.max(0, totalQuestions - attemptedCount);
  const markedCount = bookmarked.size;

  const currentQ = safeQuestions[currentIndex] || safeQuestions[0] || {};
  const isCurrentAnswered = answers[currentIndex] !== undefined;
  const isCurrentMarked = bookmarked.has(currentIndex);

  // Helper to extract correct answer
  const getCorrectAnswerIndex = (q: any): number => {
    if (typeof q?.correctAnswer === 'number') return q.correctAnswer;
    if (Array.isArray(q?.correctAnswers) && q.correctAnswers.length > 0) return q.correctAnswers[0];
    return 0;
  };

  // Handle select option
  const handleSelectOption = (optIdx: number) => {
    hapticLight();
    const isFirstTime = answers[currentIndex] === undefined;
    setAnswers(prev => ({ ...prev, [currentIndex]: optIdx }));
    setSkipped(prev => {
      const next = new Set(prev);
      next.delete(currentIndex);
      return next;
    });

    const correctIdx = getCorrectAnswerIndex(currentQ);
    const isCorrect = optIdx === correctIdx;

    if (onAnswer) {
      onAnswer(currentIndex, optIdx, isCorrect);
    }
  };

  // Clear current response
  const handleClearResponse = () => {
    hapticLight();
    setAnswers(prev => {
      const next = { ...prev };
      delete next[currentIndex];
      return next;
    });
    if (onAnswer) {
      onAnswer(currentIndex, null, false);
    }
  };

  // Toggle bookmark / mark for review
  const toggleMarkCurrent = () => {
    hapticLight();
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(currentIndex)) {
        next.delete(currentIndex);
      } else {
        next.add(currentIndex);
      }
      return next;
    });
  };

  // Navigation handlers
  const handleNext = () => {
    hapticLight();
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowSubmitModal(true);
    }
  };

  const handlePrev = () => {
    hapticLight();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Final submit handler
  const handleConfirmSubmit = () => {
    hapticStrong();
    setShowSubmitModal(false);
    setIsFinished(true);

    let correctCount = 0;
    safeQuestions.forEach((q, idx) => {
      const correctIdx = getCorrectAnswerIndex(q);
      if (answers[idx] === correctIdx) {
        correctCount++;
      }
    });

    if (onSubmit) {
      onSubmit({
        score: correctCount,
        total: totalQuestions,
        answers,
        bookmarked: Array.from(bookmarked),
        timeElapsedSeconds: timeElapsed,
      });
    }
  };

  // Restart practice
  const handleRestartSession = () => {
    hapticLight();
    setAnswers({});
    setBookmarked(new Set());
    setSkipped(new Set());
    setCurrentIndex(0);
    setIsFinished(false);
    setTimeElapsed(0);
    if (onRestart) onRestart();
  };

  // Filtered palette questions
  const filteredIndices = safeQuestions.map((_, i) => i).filter(idx => {
    const isAns = answers[idx] !== undefined;
    const isMark = bookmarked.has(idx);
    const isSkip = !isAns && skipped.has(idx);

    if (paletteFilter === 'attempted') return isAns;
    if (paletteFilter === 'marked') return isMark;
    if (paletteFilter === 'skipped') return isSkip;
    if (paletteFilter === 'unattempted') return !isAns;
    return true;
  });

  // ── RESULT / SCORE CARD VIEW (Shown after final submission) ──
  if (isFinished) {
    let correctCount = 0;
    const wrongIndices: number[] = [];
    safeQuestions.forEach((q, idx) => {
      const correctIdx = getCorrectAnswerIndex(q);
      if (answers[idx] === correctIdx) {
        correctCount++;
      } else if (answers[idx] !== undefined) {
        wrongIndices.push(idx);
      }
    });
    const wrongCount = Math.max(0, attemptedCount - correctCount);
    const pct = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    const totalPts = correctCount * 2 + wrongCount * 1;

    const grade = pct >= 80 ? { label: 'Excellent Performance! 🌟', color: 'from-emerald-600 to-teal-700', ring: 'ring-emerald-200' }
                : pct >= 60 ? { label: 'Good Job! 👍', color: 'from-blue-600 to-indigo-700', ring: 'ring-blue-200' }
                : pct >= 40 ? { label: 'Keep Practicing! 💪', color: 'from-amber-600 to-orange-700', ring: 'ring-amber-200' }
                : { label: 'Needs More Practice 📚', color: 'from-rose-600 to-red-700', ring: 'ring-rose-200' };

    return (
      <div className="flex-1 min-h-0 overflow-y-auto w-full bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden my-auto">
          {/* Header Banner */}
          <div className={`bg-gradient-to-br ${grade.color} p-6 text-white text-center relative`}>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3 shadow-inner">
              <Award size={36} className="text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black">{grade.label}</h2>
            <p className="text-xs text-white/80 mt-1">{title} · Practice Complete</p>
            <div className="mt-4 flex items-baseline justify-center gap-2">
              <span className="text-5xl font-black">{pct}%</span>
              <span className="text-sm font-bold text-white/90">({correctCount}/{attemptedCount} Correct)</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Attempted</span>
                <span className="text-lg font-black text-slate-800">{attemptedCount}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Correct</span>
                <span className="text-lg font-black text-emerald-700">{correctCount}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-rose-600 uppercase block">Wrong</span>
                <span className="text-lg font-black text-rose-700">{wrongCount}</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold text-indigo-600 uppercase block">Time</span>
                <span className="text-base font-black text-indigo-700 font-mono">{formatTime(timeElapsed)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-2">
              {onOpenAnalysis && (
                <button
                  type="button"
                  onClick={onOpenAnalysis}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition"
                >
                  <Trophy size={16} /> Detailed Question Analysis
                </button>
              )}

              {wrongCount > 0 && onPracticeMistakes && (
                <button
                  type="button"
                  onClick={() => onPracticeMistakes(wrongIndices)}
                  className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  🎯 Practice Only Mistakes ({wrongCount})
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleRestartSession}
                  className="py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <RefreshCw size={14} /> Re-attempt
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900 select-none relative">
      
      {/* ── TOP HEADER (Shown only when NOT embedded under parent slim bar) ── */}
      {!hideTopHeader && (
        <header className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2 flex items-center justify-between gap-2.5 shrink-0 shadow-xs z-30 sticky top-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Back button */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                if (attemptedCount > 0) {
                  setShowExitModal(true);
                } else {
                  onBack();
                }
              }}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 active:scale-95 transition shrink-0 cursor-pointer"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            
            {/* Title & Stats */}
            <div className="min-w-0">
              <h1 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight truncate">
                {title}
              </h1>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <span>Q. {currentIndex + 1} of {totalQuestions}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="text-emerald-600 font-bold">{attemptedCount} Answered</span>
              </div>
            </div>
          </div>

          {/* Right: Timer & Palette Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Timer pill */}
            <div className="flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
              <Clock size={15} className="text-indigo-600" />
              <span>{formatTime(timeElapsed)}</span>
            </div>

            {/* Question Palette Trigger Button */}
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                setPaletteOpenState(true);
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
              title="Open Question Grid"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">Grid</span>
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                {attemptedCount}/{totalQuestions}
              </span>
            </button>
          </div>
        </header>
      )}

      {/* ── CONSOLIDATED CONTROLS & QUESTION NAVIGATION STRIP (Single 2nd Line) ── */}
      <nav 
        aria-label="Question Navigation and Controls Strip"
        className="bg-white border-b border-slate-200 px-2 sm:px-3 py-1.5 flex items-center justify-between gap-1.5 shrink-0 shadow-xs z-20"
      >
        {/* Left: Quick question number selector */}
        <div 
          ref={quickStripRef}
          className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 pr-1 min-w-0 flex-1 scroll-smooth"
        >
          {safeQuestions.map((_, idx) => {
            const isAns = answers[idx] !== undefined;
            const isMark = bookmarked.has(idx);
            const isSkip = !isAns && skipped.has(idx);
            const isCur = idx === currentIndex;

            let pillStyle = 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200';
            if (isAns && isMark) {
              pillStyle = 'bg-indigo-600 text-white border-indigo-700 font-black';
            } else if (isAns) {
              pillStyle = 'bg-emerald-600 text-white border-emerald-700 font-black';
            } else if (isMark) {
              pillStyle = 'bg-amber-400 text-slate-950 border-amber-500 font-black';
            } else if (isSkip) {
              pillStyle = 'bg-rose-100 text-rose-700 border-rose-300 font-bold';
            }

            return (
              <button
                key={idx}
                type="button"
                data-qindex={idx}
                onClick={() => {
                  hapticLight();
                  setCurrentIndex(idx);
                }}
                className={`relative shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs flex items-center justify-center border transition-all active:scale-95 cursor-pointer ${pillStyle} ${
                  isCur 
                    ? 'ring-2 ring-indigo-600 ring-offset-2 ring-offset-white font-black scale-105 z-10' 
                    : 'opacity-90'
                }`}
                title={`Question ${idx + 1}${isAns ? ' (Answered)' : isMark ? ' (Marked)' : ''}`}
              >
                {idx + 1}
                {isMark && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 border border-white rounded-full flex items-center justify-center shadow-xs">
                    <Star size={6} className="fill-amber-900 text-amber-900" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right side controls: Question count, Font size, Bookmark, Community (compact single line) */}
        <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-slate-200">
          {/* Attempted / Total counter pill */}
          <span 
            className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-1 rounded-md border border-slate-200 shrink-0" 
            title="Answered / Total Questions"
          >
            {attemptedCount}/{totalQuestions}
          </span>

          {/* Text Size Adjuster */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[11px] font-bold text-slate-600 shrink-0">
            <button
              type="button"
              onClick={() => setFontSize('sm')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${fontSize === 'sm' ? 'bg-white text-indigo-700 font-black shadow-xs' : 'hover:bg-slate-200 text-slate-600'}`}
              title="Small font"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize('base')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${fontSize === 'base' ? 'bg-white text-indigo-700 font-black shadow-xs' : 'hover:bg-slate-200 text-slate-600'}`}
              title="Normal font"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('lg')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${fontSize === 'lg' ? 'bg-white text-indigo-700 font-black shadow-xs' : 'hover:bg-slate-200 text-slate-600'}`}
              title="Large font"
            >
              A+
            </button>
          </div>

          {/* Bookmark / Review Star Button */}
          <button
            type="button"
            onClick={toggleMarkCurrent}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition cursor-pointer shrink-0 ${
              isCurrentMarked 
                ? 'bg-amber-100 border-amber-400 text-amber-800' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'
            }`}
            title={isCurrentMarked ? 'Remove Mark' : 'Mark for Review'}
          >
            <Star size={14} className={isCurrentMarked ? 'fill-amber-500 text-amber-500' : ''} />
          </button>

          {/* Share to Community button */}
          {onSendToMcqCommunity && (
            <button
              type="button"
              onClick={() => onSendToMcqCommunity(currentQ)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer shrink-0"
              title="Share to MCQ Community"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </nav>

      {/* ── MAIN QUESTION BODY (Clean & Spacious, Native Full Screen) ── */}
      <main className="flex-1 overflow-y-auto w-full flex flex-col p-0 sm:px-4 sm:py-4">
        {totalQuestions === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white sm:rounded-2xl sm:border sm:border-slate-200 shadow-sm max-w-xl mx-auto my-auto">
            <AlertCircle size={44} className="text-slate-400 mb-3" />
            <h3 className="text-base font-bold text-slate-700">No questions available</h3>
            <p className="text-xs text-slate-500 mt-1">Is practice me filhal koi question load nahi hua.</p>
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col bg-white sm:rounded-2xl sm:border sm:border-slate-200/90 sm:shadow-xs overflow-hidden">
            
            {/* Question Text Area with integrated Question number & Topic header */}
            <div className="p-3.5 sm:p-5 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-[11px] shrink-0">
                    Q{currentIndex + 1}
                  </span>
                  {currentQ.topic && (
                    <span className="text-[11px] font-bold text-slate-500 truncate max-w-[200px] sm:max-w-xs">
                      {currentQ.topic}
                    </span>
                  )}
                </div>
                {isCurrentMarked && (
                  <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                    <Star size={10} className="fill-amber-500 text-amber-500" />
                    <span>Review Marked</span>
                  </span>
                )}
              </div>
              <div className={`text-slate-900 leading-relaxed font-semibold ${
                fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'
              }`}>
                <McqQuestionDisplay 
                  q={currentQ} 
                  questionClassName="leading-relaxed" 
                />
              </div>
            </div>

            {/* Options List */}
            <div className="p-4 sm:p-6 flex flex-col gap-2.5 sm:gap-3 bg-slate-50/40">
              {(currentQ.options || []).map((opt: string, oIdx: number) => {
                const isSelected = answers[currentIndex] === oIdx;
                const letter = String.fromCharCode(65 + oIdx);

                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => handleSelectOption(oIdx)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-center gap-3.5 active:scale-[0.99] cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50/90 border-indigo-600 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20 font-bold' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-800'
                    }`}
                  >
                    {/* Option Letter Circle */}
                    <span 
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shrink-0 transition ${
                        isSelected 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                          : 'border-slate-300 text-slate-600 bg-slate-100/80'
                      }`}
                    >
                      {letter}
                    </span>

                    {/* Option Text Content */}
                    <span 
                      className={`flex-1 ${fontSize === 'sm' ? 'text-xs sm:text-sm' : fontSize === 'lg' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}
                      dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} 
                    />

                    {/* Checkmark Status Indicator */}
                    {isSelected && (
                      <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />
                    )}
                  </button>
                );
              })}

              {/* Clear Response Button */}
              {isCurrentAnswered && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleClearResponse}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2.5 py-1 rounded-lg hover:bg-rose-50 transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Clear Answer</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* ── ERGONOMIC BOTTOM ACTION BAR (Sticky) ── */}
      <footer className="bg-white border-t border-slate-200/90 px-3 sm:px-6 py-3 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.05)] sticky bottom-0 z-30 shrink-0 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Back Question */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm disabled:opacity-30 disabled:pointer-events-none transition active:scale-95 cursor-pointer whitespace-nowrap"
          aria-label="Previous question"
        >
          <ChevronLeft size={16} />
          <span>Back<span className="hidden xs:inline"> Question</span></span>
        </button>

        {/* Center: Submit button */}
        <button
          type="button"
          onClick={() => {
            hapticMedium();
            setShowSubmitModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition cursor-pointer whitespace-nowrap"
        >
          <Trophy size={16} />
          <span>Submit</span>
        </button>

        {/* Right: Next Question */}
        <button
          type="button"
          onClick={handleNext}
          className="flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition cursor-pointer whitespace-nowrap"
        >
          <span>
            {currentIndex >= totalQuestions - 1 ? 'Review & Submit' : 'Next Question'}
          </span>
          <ChevronRight size={16} />
        </button>
      </footer>

      {/* ── QUESTION PALETTE GRID DRAWER / MODAL ── */}
      {isPaletteDrawerOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPaletteOpenState(false)}
        >
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Top */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-black text-slate-800">Question Palette</h3>
                <p className="text-[11px] text-slate-500">{title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaletteOpenState(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="p-3 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: `All (${totalQuestions})` },
                { id: 'attempted', label: `Answered (${attemptedCount})` },
                { id: 'marked', label: `Marked (${markedCount})` },
                { id: 'unattempted', label: `Unattempted (${unattemptedCount})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPaletteFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition ${
                    paletteFilter === tab.id 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Numbers Grid */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {filteredIndices.map((idx) => {
                  const isAns = answers[idx] !== undefined;
                  const isMark = bookmarked.has(idx);
                  const isCur = idx === currentIndex;

                  let pillStyle = 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200';
                  if (isAns && isMark) {
                    pillStyle = 'bg-indigo-600 text-white border-indigo-700 font-black';
                  } else if (isAns) {
                    pillStyle = 'bg-emerald-600 text-white border-emerald-700 font-black';
                  } else if (isMark) {
                    pillStyle = 'bg-amber-400 text-slate-950 border-amber-500 font-black';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setCurrentIndex(idx);
                        setPaletteOpenState(false);
                      }}
                      className={`relative h-9 rounded-xl text-xs font-black flex items-center justify-center border transition active:scale-95 cursor-pointer ${pillStyle} ${
                        isCur ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
                      }`}
                    >
                      {idx + 1}
                      {isMark && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawer Bottom Actions */}
            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowPaletteDrawer(false)}
                className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200 font-bold text-xs transition cursor-pointer"
              >
                Close Palette
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPaletteDrawer(false);
                  setShowSubmitModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                Submit Practice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMIT CONFIRMATION MODAL ── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Trophy size={28} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-800">Submit Practice</h3>
              <p className="text-xs text-slate-500 mt-1">Kya aap apna practice session submit karna chahte hain?</p>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 grid grid-cols-2 gap-3 text-left">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                <span className="text-[10px] uppercase font-black text-slate-400 block">Answered</span>
                <span className="text-lg font-black text-emerald-600">{attemptedCount} / {totalQuestions}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                <span className="text-[10px] uppercase font-black text-slate-400 block">Left / Unattempted</span>
                <span className="text-lg font-black text-rose-600">{unattemptedCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                <span className="text-[10px] uppercase font-black text-slate-400 block">Marked for Review</span>
                <span className="text-lg font-black text-amber-600">{markedCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                <span className="text-[10px] uppercase font-black text-slate-400 block">Time Spent</span>
                <span className="text-lg font-black text-indigo-600 font-mono">{formatTime(timeElapsed)}</span>
              </div>
            </div>

            {unattemptedCount > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>Aapne <b>{unattemptedCount} sawal</b> chhod diye hain. Fir bhi submit karein?</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-95 transition cursor-pointer"
              >
                Wapas Jayein
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition cursor-pointer"
              >
                Submit Now
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── EXIT CONFIRMATION MODAL ── */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle size={28} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-800">Quit Practice?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Aapne {attemptedCount} questions solve kiye hain. Kya aap practice band karna chahte hain?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-95 transition cursor-pointer"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  onBack();
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-600/25 active:scale-95 transition cursor-pointer"
              >
                Quit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UnifiedMcqPracticeView;
