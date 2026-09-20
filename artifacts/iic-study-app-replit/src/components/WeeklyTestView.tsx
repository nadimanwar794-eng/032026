// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import { WeeklyTest, MCQItem } from '../types';
import { 
  Clock, AlertTriangle, CheckCircle, Trophy, ArrowLeft, ChevronLeft, 
  ChevronRight, Bookmark, Star, LayoutGrid, X, Check, RotateCcw, 
  HelpCircle, Eye, AlertCircle, Sparkles, Filter, CheckCircle2
} from 'lucide-react';
import { addMistakes, removeMistakeByQuestion } from '../utils/mistakeBank';
import { renderMathInHtml } from '../utils/mathUtils';
import { hapticLight, hapticMedium, hapticStrong } from '../utils/haptic';
import McqQuestionDisplay from './McqQuestionDisplay';

interface Props {
  test: WeeklyTest;
  onComplete: (score: number, total: number, answers: Record<number, number>) => void;
  onExit: () => void;
}

export const WeeklyTestView: React.FC<Props> = ({ test, onComplete, onExit }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // UI Dialog & Drawer states
  const [showPaletteDrawer, setShowPaletteDrawer] = useState<boolean>(false);
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'attempted' | 'marked' | 'skipped' | 'unattempted'>('all');
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  const [showResumeModal, setShowResumeModal] = useState<{
    savedAnswers: Record<number, number>;
    savedIndex: number;
    savedTimeLeft?: number;
    savedBookmarked?: number[];
    savedSkipped?: number[];
    count: number;
  } | null>(null);

  const quickStripRef = useRef<HTMLDivElement>(null);
  const safeQuestions: MCQItem[] = Array.isArray(test.questions) ? test.questions : [];

  // Check saved progress on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`weekly_test_progress_${test.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const count = Object.keys(parsed.answers || {}).length;
        if (count > 0) {
          setShowResumeModal({
            savedAnswers: parsed.answers,
            savedIndex: parsed.currentIndex || 0,
            savedTimeLeft: parsed.timeLeft,
            savedBookmarked: parsed.bookmarked || [],
            savedSkipped: parsed.skipped || [],
            count,
          });
        }
      }
    } catch (e) {
      console.warn('Error reading test progress', e);
    }
  }, [test.id]);

  const handleResume = () => {
    if (!showResumeModal) return;
    hapticMedium();
    setAnswers(showResumeModal.savedAnswers);
    setCurrentIndex(showResumeModal.savedIndex);
    if (showResumeModal.savedBookmarked) {
      setBookmarked(new Set(showResumeModal.savedBookmarked));
    }
    if (showResumeModal.savedSkipped) {
      setSkipped(new Set(showResumeModal.savedSkipped));
    }
    if (typeof showResumeModal.savedTimeLeft === 'number' && showResumeModal.savedTimeLeft > 0) {
      setTimeLeft(showResumeModal.savedTimeLeft);
    }
    setShowResumeModal(null);
  };

  const handleRestart = () => {
    hapticLight();
    try {
      localStorage.removeItem(`weekly_test_progress_${test.id}`);
      localStorage.removeItem(`weekly_test_start_${test.id}`);
    } catch {}
    setAnswers({});
    setBookmarked(new Set());
    setCurrentIndex(0);
    setSkipped(new Set());
    setShowResumeModal(null);
  };

  const saveProgressToStorage = () => {
    try {
      localStorage.setItem(`weekly_test_progress_${test.id}`, JSON.stringify({
        answers,
        bookmarked: Array.from(bookmarked),
        skipped: Array.from(skipped),
        currentIndex,
        timeLeft,
        savedAt: Date.now(),
      }));
    } catch (e) {
      console.warn('Failed to save test progress', e);
    }
  };

  const handleConfirmExit = () => {
    hapticLight();
    saveProgressToStorage();
    setShowExitModal(false);
    onExit();
  };

  // Initialize Timer
  useEffect(() => {
    const isDailyChallenge =
      (test as any).challengeType === 'DAILY_CHALLENGE' ||
      test.id.startsWith('daily-challenge-');
    const DURATION_SECONDS = (
      isDailyChallenge
        ? Math.min(test.durationMinutes || 60, 60)
        : (test.durationMinutes || 120)
    ) * 60;
    const STORAGE_KEY = `weekly_test_start_${test.id}`;
    
    let startTime = localStorage.getItem(STORAGE_KEY);
    
    if (!startTime) {
      startTime = Date.now().toString();
      localStorage.setItem(STORAGE_KEY, startTime);
    }
    
    const elapsedSeconds = Math.floor((Date.now() - parseInt(startTime)) / 1000);
    const remaining = Math.max(0, DURATION_SECONDS - elapsedSeconds);
    
    setTimeLeft(remaining);
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true); // Auto submit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [test.id, test.durationMinutes]);

  // Auto-scroll current question in horizontal strip
  useEffect(() => {
    if (!quickStripRef.current) return;
    const btn = quickStripRef.current.querySelector(`[data-qindex="${currentIndex}"]`) as HTMLElement;
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIndex]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showSubmitModal || showExitModal || showPaletteDrawer) return;

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
  }, [currentIndex, answers, safeQuestions.length, showSubmitModal, showExitModal, showPaletteDrawer]);

  const handleSubmit = (auto: boolean = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    hapticStrong();
    
    // Calculate Score
    let score = 0;
    safeQuestions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) {
        score++;
      }
    });

    // Update Mistake Bank
    try {
      const wrongPayload = safeQuestions
        .map((q, idx) => {
          const selected = answers[idx];
          if (selected !== undefined && selected !== q.correctAnswer) {
            return {
              question: q.question,
              options: q.options || [],
              correctAnswer: q.correctAnswer,
              explanation: (q as any).explanation,
              topic: (q as any).topic,
              chapterTitle: test.name || 'Weekly Test',
              subjectName: 'Weekly Test / Challenge',
              classLevel: (test.classLevel as any) || undefined,
              source: 'WEEKLY_TEST',
            };
          }
          return null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (wrongPayload.length > 0) addMistakes(wrongPayload);
      safeQuestions.forEach((q, idx) => {
        if (answers[idx] !== undefined && answers[idx] === q.correctAnswer) {
          removeMistakeByQuestion(q.question, q.correctAnswer);
        }
      });
    } catch (err) { 
      console.warn('mistakeBank update failed:', err); 
    }

    // Clear local storage for this test
    try {
      localStorage.removeItem(`weekly_test_start_${test.id}`);
      localStorage.removeItem(`weekly_test_progress_${test.id}`);
    } catch {}

    onComplete(score, safeQuestions.length, answers);
  };

  const handleSelectOption = (oIdx: number) => {
    hapticLight();
    setAnswers(prev => ({ ...prev, [currentIndex]: oIdx }));
    setSkipped(prev => { 
      const next = new Set(prev); 
      next.delete(currentIndex); 
      return next; 
    });
  };

  const handleClearResponse = () => {
    hapticLight();
    setAnswers(prev => {
      const next = { ...prev };
      delete next[currentIndex];
      return next;
    });
  };

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

  const handleNext = () => {
    hapticLight();
    if (currentIndex < safeQuestions.length - 1) {
      if (answers[currentIndex] === undefined) {
        setSkipped(prev => new Set(prev).add(currentIndex));
      }
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

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Counts for summary
  const attemptedCount = Object.keys(answers).length;
  const markedCount = bookmarked.size;
  const skippedCount = Array.from(skipped).filter(idx => answers[idx] === undefined).length;
  const unattemptedCount = Math.max(0, safeQuestions.length - attemptedCount);
  const currentQ = safeQuestions[currentIndex];
  const isCurrentAnswered = answers[currentIndex] !== undefined;
  const isCurrentMarked = bookmarked.has(currentIndex);

  // Filtered list of questions for Palette Drawer
  const filteredIndices = safeQuestions.map((_, i) => i).filter(idx => {
    const answered = answers[idx] !== undefined;
    const isMark = bookmarked.has(idx);
    const isSkip = !answered && skipped.has(idx);
    if (paletteFilter === 'attempted') return answered;
    if (paletteFilter === 'marked') return isMark;
    if (paletteFilter === 'skipped') return isSkip;
    if (paletteFilter === 'unattempted') return !answered;
    return true;
  });

  return (
    <div className="flex flex-col h-screen bg-slate-100/90 text-slate-900 select-none overflow-hidden font-sans">
      
      {/* ── TOP EXAMINATION HEADER ── */}
      <header className="bg-white border-b border-slate-200 shadow-xs px-3 sm:px-5 py-2.5 flex items-center justify-between sticky top-0 z-30 shrink-0">
        
        {/* Left: Exit button & Test Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setShowExitModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs transition border border-slate-200/80 shrink-0"
            title="Wapas jayein (Progress save rahegi)"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Exit</span>
          </button>
          
          <div className="min-w-0">
            <h1 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight truncate">
              {test.name}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span>Q. {currentIndex + 1} of {safeQuestions.length}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-emerald-600 font-bold">{attemptedCount} Answered</span>
            </div>
          </div>
        </div>

        {/* Right: Timer & Palette Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Countdown Timer */}
          <div 
            className={`flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm px-3 py-1.5 rounded-xl shadow-xs border transition-all ${
              timeLeft < 300 
                ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse' 
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}
          >
            <Clock size={15} className={timeLeft < 300 ? 'text-rose-600' : 'text-indigo-600'} />
            <span>{formatTime(timeLeft)}</span>
          </div>

          {/* Question Palette Drawer Trigger Button */}
          <button
            type="button"
            id="btn-open-question-palette"
            onClick={() => {
              hapticMedium();
              setShowPaletteDrawer(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
            title="Open Question Palette Grid"
          >
            <LayoutGrid size={15} />
            <span className="hidden md:inline">Palette</span>
            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {currentIndex + 1}/{safeQuestions.length}
            </span>
          </button>
        </div>
      </header>

      {/* ── SLEEK HORIZONTAL QUESTION QUICK-STRIP ── */}
      <nav 
        aria-label="Quick Question Strip"
        className="bg-white/95 border-b border-slate-200 px-2 sm:px-4 py-2 flex items-center justify-between gap-2 shrink-0 shadow-xs z-20 backdrop-blur-xs"
      >
        <div 
          ref={quickStripRef}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 pr-2 min-w-0 flex-1 scroll-smooth"
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
                className={`relative shrink-0 w-8 h-8 rounded-lg text-xs flex items-center justify-center border transition-all active:scale-95 ${pillStyle} ${
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

        {/* Quick Jump & Filter button */}
        <button
          type="button"
          onClick={() => {
            hapticLight();
            setShowPaletteDrawer(true);
          }}
          className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-200 transition"
        >
          <Filter size={12} />
          <span>Grid ({attemptedCount}/{safeQuestions.length})</span>
        </button>
      </nav>

      {/* ── MAIN QUESTION BODY (SPACIOUS & CENTERED) ── */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-5 max-w-3xl mx-auto w-full flex flex-col">
        {safeQuestions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <AlertCircle size={44} className="text-slate-400 mb-3" />
            <h3 className="text-base font-bold text-slate-700">No questions available</h3>
            <p className="text-xs text-slate-500 mt-1">Is test me filhal koi question load nahi hua.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden">
            
            {/* Question Card Top Bar */}
            <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs shadow-xs">
                  Q{currentIndex + 1}
                </span>
                <span className="text-xs font-bold text-slate-600 hidden xs:inline">
                  Single Choice (+1.00 Mark)
                </span>
                {isCurrentMarked && (
                  <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    <Star size={10} className="fill-amber-500 text-amber-500" />
                    <span>Review Marked</span>
                  </span>
                )}
              </div>

              {/* Text Size Adjuster & Fast Mark Toggle */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-bold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setFontSize('sm')}
                    className={`px-1.5 py-0.5 rounded ${fontSize === 'sm' ? 'bg-indigo-100 text-indigo-700 font-black' : 'hover:bg-slate-100'}`}
                    title="Small font"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize('base')}
                    className={`px-1.5 py-0.5 rounded ${fontSize === 'base' ? 'bg-indigo-100 text-indigo-700 font-black' : 'hover:bg-slate-100'}`}
                    title="Medium font"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize('lg')}
                    className={`px-1.5 py-0.5 rounded ${fontSize === 'lg' ? 'bg-indigo-100 text-indigo-700 font-black' : 'hover:bg-slate-100'}`}
                    title="Large font"
                  >
                    A+
                  </button>
                </div>

                <button
                  type="button"
                  onClick={toggleMarkCurrent}
                  className={`p-1.5 rounded-lg border transition ${
                    isCurrentMarked 
                      ? 'bg-amber-100 border-amber-400 text-amber-800' 
                      : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-500'
                  }`}
                  title={isCurrentMarked ? 'Remove Mark' : 'Mark for Review'}
                >
                  <Star size={15} className={isCurrentMarked ? 'fill-amber-500 text-amber-500' : ''} />
                </button>
              </div>
            </div>

            {/* Question Text Area */}
            <div className="p-4 sm:p-6 border-b border-slate-100">
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
              {currentQ.options && currentQ.options.map((opt, oIdx) => {
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
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2.5 py-1 rounded-lg hover:bg-rose-50 transition flex items-center gap-1"
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

      {/* ── ERGONOMIC BOTTOM ACTION BAR ── */}
      <footer className="bg-white border-t border-slate-200/90 px-3 sm:px-6 py-3 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.05)] sticky bottom-0 z-30 shrink-0 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Back Question button (replaces bottom Star button) */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0 || isSubmitting}
          className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm disabled:opacity-30 disabled:pointer-events-none transition active:scale-95 cursor-pointer whitespace-nowrap"
          aria-label="Previous question"
        >
          <ChevronLeft size={16} />
          <span>Back<span className="hidden xs:inline"> Question</span></span>
        </button>

        {/* Center: Submit Test button (in place of Next Question) */}
        <button
          type="button"
          id="btn-trigger-submit-modal"
          onClick={() => {
            hapticMedium();
            setShowSubmitModal(true);
          }}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition cursor-pointer whitespace-nowrap"
        >
          <Trophy size={16} />
          <span>Submit</span>
        </button>

        {/* Right: Next Question button (in place of Submit) */}
        <button
          type="button"
          onClick={handleNext}
          disabled={isSubmitting}
          className="flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition cursor-pointer whitespace-nowrap"
        >
          <span>
            {currentIndex >= safeQuestions.length - 1 ? (
              'Review & Finish'
            ) : (
              <>
                <span>Next</span>
                <span className="hidden xs:inline"> Question</span>
              </>
            )}
          </span>
          <ChevronRight size={16} />
        </button>
      </footer>

      {/* ── QUESTION PALETTE SLIDE-OVER DRAWER (BOTTOM SHEET / MODAL) ── */}
      {showPaletteDrawer && (
        <div 
          id="drawer-question-palette"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowPaletteDrawer(false)}
        >
          <div 
            className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <LayoutGrid size={16} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Question Palette</h3>
                  <p className="text-xs text-slate-500">Tap question number to jump directly</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaletteDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Status Counter Chips */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-around text-center text-xs font-bold">
              <div className="flex flex-col items-center">
                <span className="text-emerald-700 font-extrabold text-sm">{attemptedCount}</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <i className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Attempted
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-amber-700 font-extrabold text-sm">{markedCount}</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <i className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Marked
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-rose-700 font-extrabold text-sm">{skippedCount}</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <i className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Skipped
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-slate-700 font-extrabold text-sm">{unattemptedCount}</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <i className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Left
                </span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-100">
              {(['all', 'attempted', 'marked', 'skipped', 'unattempted'] as const).map((filterKey) => {
                const labels: Record<string, string> = {
                  all: `All (${safeQuestions.length})`,
                  attempted: `Answered (${attemptedCount})`,
                  marked: `Marked (${markedCount})`,
                  skipped: `Skipped (${skippedCount})`,
                  unattempted: `Left (${unattemptedCount})`,
                };
                const isActive = paletteFilter === filterKey;
                return (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setPaletteFilter(filterKey)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                      isActive 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {labels[filterKey]}
                  </button>
                );
              })}
            </div>

            {/* Question Matrix Grid */}
            <div className="p-4 overflow-y-auto max-h-72">
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
                {filteredIndices.map((idx) => {
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
                      onClick={() => {
                        hapticLight();
                        setCurrentIndex(idx);
                        setShowPaletteDrawer(false);
                      }}
                      className={`relative h-9 rounded-xl text-xs font-black flex items-center justify-center border transition active:scale-95 ${pillStyle} ${
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

            {/* Modal Bottom Actions */}
            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowPaletteDrawer(false)}
                className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200 font-bold text-xs transition"
              >
                Close Palette
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPaletteDrawer(false);
                  setShowSubmitModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition shadow-md shadow-emerald-600/20"
              >
                Submit Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFESSIONAL SUBMIT CONFIRMATION MODAL ── */}
      {showSubmitModal && (
        <div 
          id="modal-submit-confirmation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Trophy size={28} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-800">Final Test Submission</h3>
              <p className="text-xs text-slate-500 mt-1">Kya aap apna test submit karna chahte hain?</p>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 grid grid-cols-2 gap-3 text-left">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                <span className="text-[10px] uppercase font-black text-slate-400 block">Answered</span>
                <span className="text-lg font-black text-emerald-600">{attemptedCount} / {safeQuestions.length}</span>
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
                <span className="text-[10px] uppercase font-black text-slate-400 block">Time Left</span>
                <span className="text-lg font-black text-indigo-600 font-mono">{formatTime(timeLeft)}</span>
              </div>
            </div>

            {unattemptedCount > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>Aapne <b>{unattemptedCount} sawal</b> chhod diye hain. Ek bar fir dekhna chahte hain?</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition active:scale-95"
              >
                Review Karein
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubmitModal(false);
                  handleSubmit(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition shadow-md shadow-emerald-600/25 active:scale-95"
              >
                Submit Karein
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXIT CONFIRMATION MODAL (PROGRESS IS SAFE) ── */}
      {showExitModal && (
        <div 
          id="modal-exit-confirmation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Bookmark size={28} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-800">Progress Auto-Saved!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Aapne <b className="text-indigo-600">{attemptedCount}</b> sawal solve kiye hain. Kya aap bahar nikalna chahte hain? Aap baad me yahin se continue kar sakte hain.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition shadow-md shadow-indigo-600/20 active:scale-95"
              >
                Test Jari Rakhein
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="w-full py-2.5 px-3 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs transition active:scale-95"
              >
                Save & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESUME MODAL ── */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Trophy size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">Pehle Ki Progress Mili!</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Aapne is test me <span className="font-bold text-indigo-600">{showResumeModal.count} / {safeQuestions.length}</span> sawal banaye hain.
              <br />
              Wahin se <span className="font-bold text-slate-800">Resume</span> karein ya naye sire se <span className="font-bold text-slate-800">Restart</span>?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs active:scale-95 transition"
              >
                🔄 Restart
              </button>
              <button
                type="button"
                onClick={handleResume}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs active:scale-95 transition shadow-md shadow-indigo-600/20"
              >
                ▶️ Resume
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WeeklyTestView;

