// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Clock, AlertTriangle, CheckCircle, Trophy, ArrowLeft, ChevronLeft, 
  ChevronRight, Star, LayoutGrid, X, RotateCcw, 
  AlertCircle, CheckCircle2, Plus, RefreshCw, Award, BookOpen, Sparkles, FastForward
} from 'lucide-react';
import { renderMathInHtml } from '../utils/mathUtils';
import { hapticLight, hapticMedium, hapticStrong } from '../utils/haptic';
import McqQuestionDisplay from './McqQuestionDisplay';
import { tryEarnScore } from '../utils/scoreSystem';
import { getSkipDurationSeconds, formatDurationLabel, SkipEntry } from '../utils/officialMcqBank';
import { rotateScreen } from '../utils/displayPrefs';

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
  
  // ── Auto-Skip Ladder & 2nd/3rd Chance Re-attempt State ──
  const [skipEntries, setSkipEntries] = useState<Record<number, SkipEntry>>({});
  const [isReattemptPhase, setIsReattemptPhase] = useState<boolean>(false);
  const [reattemptRound, setReattemptRound] = useState<number>(0); // 0 = initial (30s), 1 = 2nd chance (1m), 2 = 3rd & last chance (5m)
  const [roundInitialCount, setRoundInitialCount] = useState<number>(0);
  const [qSecondsLeft, setQSecondsLeft] = useState<number>(30);
  const [qMaxSeconds, setQMaxSeconds] = useState<number>(30);

  // Auto-skip notification toast
  const [skipToast, setSkipToast] = useState<{
    id: number;
    questionNumber: number;
    nextDurationSeconds: number;
    message: string;
    subMessage?: string;
    isAuto: boolean;
  } | null>(null);

  // 2nd / 3rd Chance Modal (Max 3rd Chance)
  const [secondChanceModal, setSecondChanceModal] = useState<{
    isOpen: boolean;
    unsolvedCount: number;
    initialRoundCount?: number;
    remainingIndexes: number[];
    round: number;
    chanceLabel: string;
    nextDuration: number;
  } | null>(null);
  const [reattemptIndices, setReattemptIndices] = useState<number[]>([]);

  const getChanceLabel = (round: number) => {
    if (round <= 1) return '2nd Chance';
    return '3rd Chance';
  };

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

  // ── Screen Rotation & Landscape Mode (1/20 Top, 18/20 Content, 1/20 Bottom) ──
  const [isManualLandscape, setIsManualLandscape] = useState<boolean>(false);
  const [isDeviceLandscape, setIsDeviceLandscape] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight;
    }
    return false;
  });

  useEffect(() => {
    const handleCheckOrientation = () => {
      if (typeof window !== 'undefined') {
        setIsDeviceLandscape(window.innerWidth > window.innerHeight);
      }
    };
    window.addEventListener('resize', handleCheckOrientation);
    window.addEventListener('orientationchange', handleCheckOrientation);
    const handleCustomRotate = (e: any) => {
      if (e?.detail?.orientation) {
        setIsManualLandscape(e.detail.orientation === 'landscape');
      }
    };
    window.addEventListener('nst-screen-rotate', handleCustomRotate);
    return () => {
      window.removeEventListener('resize', handleCheckOrientation);
      window.removeEventListener('orientationchange', handleCheckOrientation);
      window.removeEventListener('nst-screen-rotate', handleCustomRotate);
    };
  }, []);

  const isRotatedOrLandscape = isManualLandscape || isDeviceLandscape;

  const handleToggleRotate = async () => {
    hapticLight();
    try {
      const res = await rotateScreen();
      if (res !== null) {
        setIsManualLandscape(res === 'landscape');
      } else {
        setIsManualLandscape(prev => !prev);
      }
    } catch {
      setIsManualLandscape(prev => !prev);
    }
  };

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
        // Active in MCQ Practice: 30 XP per active minute (0 credit) per user mandate
        if (next > 0 && next % 60 === 0 && user?.id) {
          try {
            tryEarnScore(user.id, 30, user.subscriptionLevel, user.isPremium, 0, 'MCQ_ACTIVE_TIME', undefined, undefined, 'MCQ Practice Active Minute');
          } catch (_) {}
        }
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

  // ── 2nd Chance Unsolved Live Tracker (e.g. 1/10, 2/10) ──
  const activeUnsolvedIndices = useMemo(() => {
    if (!isReattemptPhase) return [];
    if (reattemptIndices.length > 0) return reattemptIndices;
    return safeQuestions.map((_, i) => i).filter(i => answers[i] === undefined);
  }, [isReattemptPhase, reattemptIndices, safeQuestions, answers]);

  const currentUnsolvedPos = useMemo(() => {
    if (!isReattemptPhase) return 1;
    const idx = activeUnsolvedIndices.indexOf(currentIndex);
    return idx >= 0 ? idx + 1 : 1;
  }, [isReattemptPhase, activeUnsolvedIndices, currentIndex]);

  const totalUnsolvedInRound = useMemo(() => {
    if (!isReattemptPhase) return 0;
    return roundInitialCount || activeUnsolvedIndices.length || 1;
  }, [isReattemptPhase, roundInitialCount, activeUnsolvedIndices]);

  const currentQ = safeQuestions[currentIndex] || safeQuestions[0] || {};
  const isCurrentAnswered = answers[currentIndex] !== undefined;
  const isCurrentMarked = bookmarked.has(currentIndex);

  // ── Sync per-question timer duration whenever currentIndex or round changes ──
  useEffect(() => {
    if (totalQuestions === 0 || !currentQ || isFinished) return;
    const isAnswered = answers[currentIndex] !== undefined;
    if (isAnswered) {
      setQSecondsLeft(0);
      return;
    }

    const skipEntry = skipEntries[currentIndex];
    let duration = 30;
    if (isReattemptPhase && skipEntry) {
      duration = getSkipDurationSeconds(skipEntry.skipCount);
    } else if (isReattemptPhase) {
      duration = getSkipDurationSeconds(reattemptRound);
    } else {
      duration = 30;
    }
    setQSecondsLeft(duration);
    setQMaxSeconds(duration);
  }, [currentIndex, isReattemptPhase, reattemptRound, totalQuestions, answers[currentIndex]]);

  // ── Per-question countdown timer interval (30s initial, escalating ladder on re-attempt) ──
  useEffect(() => {
    if (
      isFinished || 
      showSubmitModal || 
      showExitModal || 
      showPaletteDrawer || 
      (secondChanceModal && secondChanceModal.isOpen)
    ) {
      return;
    }
    if (answers[currentIndex] !== undefined) return; // already answered

    const interval = setInterval(() => {
      setQSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-skip triggered on timer expiration!
          handleAutoSkip(currentIndex, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    currentIndex,
    answers[currentIndex],
    isFinished,
    showSubmitModal,
    showExitModal,
    showPaletteDrawer,
    secondChanceModal,
    isReattemptPhase,
    totalQuestions,
  ]);

  // ── Auto-skip / manual-skip notification toast ──
  const showSkipToast = (qNum: number, nextDuration: number, isAuto: boolean, curDuration: number, isFinalChance: boolean = false) => {
    setSkipToast({
      id: Date.now(),
      questionNumber: qNum,
      nextDurationSeconds: isFinalChance ? 0 : nextDuration,
      message: isAuto
        ? `⏳ ${formatDurationLabel(curDuration)} Time Up! Q#${qNum} Auto-Skip ho gaya`
        : `⏭️ Q#${qNum} Skip kiya gaya`,
      subMessage: isFinalChance
        ? `⚠️ Yeh aakhri (3rd) chance tha — iske baad aur chance nahi milega!`
        : `Agla mauka ${formatDurationLabel(nextDuration)} timer ke sath aayega!`,
      isAuto,
    });
  };

  useEffect(() => {
    if (!skipToast) return;
    const t = setTimeout(() => {
      setSkipToast(null);
    }, 4500);
    return () => clearTimeout(t);
  }, [skipToast]);

  // Helper to extract correct answer
  const getCorrectAnswerIndex = (q: any): number => {
    if (typeof q?.correctAnswer === 'number') return q.correctAnswer;
    if (Array.isArray(q?.correctAnswers) && q.correctAnswers.length > 0) return q.correctAnswers[0];
    return 0;
  };

  // ── Auto-skip / Manual-skip Core Handler ──
  const handleAutoSkip = (qIdx: number, isManual: boolean = false) => {
    if (totalQuestions === 0) return;
    if (answers[qIdx] !== undefined) {
      handleNext();
      return;
    }

    const prevSkips = skipEntries[qIdx]?.skipCount || 0;
    const newSkipCount = isReattemptPhase ? reattemptRound + 1 : Math.max(1, prevSkips + 1);
    const nextDur = getSkipDurationSeconds(newSkipCount);
    const curDur = qMaxSeconds || 30;
    const isFinalChance = isReattemptPhase && reattemptRound >= 2;

    showSkipToast(qIdx + 1, nextDur, !isManual, curDur, isFinalChance);

    const updatedSkips: Record<number, SkipEntry> = {
      ...skipEntries,
      [qIdx]: {
        skipCount: newSkipCount,
        lastSkippedAt: Date.now(),
        nextDurationSeconds: nextDur,
      },
    };
    setSkipEntries(updatedSkips);
    setSkipped(prev => new Set(prev).add(qIdx));

    if (isReattemptPhase) {
      // Find remaining unanswered questions across the test
      const remainingUnanswered = safeQuestions
        .map((_, i) => i)
        .filter(i => answers[i] === undefined && i !== qIdx);

      const nextIdx = remainingUnanswered.find(i => i > qIdx);
      if (nextIdx !== undefined) {
        // Move to the next unanswered question in this round without any popup
        setCurrentIndex(nextIdx);
      } else {
        // Reached end of this re-attempt round pass!
        const stillUnanswered: number[] = [];
        for (let i = 0; i < totalQuestions; i++) {
          if (answers[i] === undefined) {
            stillUnanswered.push(i);
          }
        }
        if (answers[qIdx] === undefined && !stillUnanswered.includes(qIdx)) {
          stillUnanswered.push(qIdx);
        }

        if (stillUnanswered.length === 0 || reattemptRound >= 2) {
          // 3rd chance (reattemptRound === 2) is the LAST chance — no 4th chance!
          handleConfirmSubmit();
        } else {
          // Summary popup after 2nd chance round completed -> offer 3rd Chance (5 min timer)
          const nextRound = reattemptRound + 1;
          const nextDur = getSkipDurationSeconds(nextRound);
          const label = getChanceLabel(nextRound);
          setSecondChanceModal({
            isOpen: true,
            unsolvedCount: stillUnanswered.length,
            initialRoundCount: roundInitialCount || totalQuestions,
            remainingIndexes: stillUnanswered,
            round: nextRound,
            chanceLabel: label,
            nextDuration: nextDur,
          });
        }
      }
    } else {
      // Normal 1st pass: 1 to totalQuestions
      if (qIdx < totalQuestions - 1) {
        setCurrentIndex(qIdx + 1);
      } else {
        // Reached end of initial round! Check if any remain unsolved
        const remainingUnsolved: number[] = [];
        for (let i = 0; i < totalQuestions; i++) {
          if (answers[i] === undefined && i !== qIdx) remainingUnsolved.push(i);
        }
        if (answers[qIdx] === undefined && !remainingUnsolved.includes(qIdx)) {
          remainingUnsolved.push(qIdx);
        }

        if (remainingUnsolved.length > 0) {
          setSecondChanceModal({
            isOpen: true,
            unsolvedCount: remainingUnsolved.length,
            initialRoundCount: totalQuestions,
            remainingIndexes: remainingUnsolved,
            round: 1,
            chanceLabel: '2nd Chance',
            nextDuration: 60, // 1 min for 2nd chance!
          });
        } else {
          handleConfirmSubmit();
        }
      }
    }
  };

  // Handle select option
  const handleSelectOption = (optIdx: number) => {
    hapticLight();
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
    if (isReattemptPhase) {
      const remaining = safeQuestions
        .map((_, i) => i)
        .filter(i => answers[i] === undefined && i !== currentIndex);
      
      const nextIdx = remaining.find(i => i > currentIndex);
      if (nextIdx !== undefined) {
        // Move to the next unanswered question in this round without any popup
        setCurrentIndex(nextIdx);
      } else {
        // Reached end of this re-attempt round pass!
        const stillUnanswered: number[] = [];
        for (let i = 0; i < totalQuestions; i++) {
          if (answers[i] === undefined) {
            stillUnanswered.push(i);
          }
        }

        if (stillUnanswered.length === 0 || reattemptRound >= 2) {
          // 3rd chance (reattemptRound === 2) is the LAST chance — no 4th chance!
          handleConfirmSubmit();
        } else {
          // Summary popup after 2nd chance round completed -> offer 3rd Chance (5 min timer)
          const nextRound = reattemptRound + 1;
          const nextDur = getSkipDurationSeconds(nextRound);
          const label = getChanceLabel(nextRound);
          setSecondChanceModal({
            isOpen: true,
            unsolvedCount: stillUnanswered.length,
            initialRoundCount: roundInitialCount || totalQuestions,
            remainingIndexes: stillUnanswered,
            round: nextRound,
            chanceLabel: label,
            nextDuration: nextDur,
          });
        }
      }
    } else {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        const remainingUnsolved: number[] = [];
        for (let i = 0; i < totalQuestions; i++) {
          if (answers[i] === undefined) remainingUnsolved.push(i);
        }

        if (remainingUnsolved.length > 0) {
          setSecondChanceModal({
            isOpen: true,
            unsolvedCount: remainingUnsolved.length,
            initialRoundCount: totalQuestions,
            remainingIndexes: remainingUnsolved,
            round: 1,
            chanceLabel: '2nd Chance',
            nextDuration: 60,
          });
        } else {
          setShowSubmitModal(true);
        }
      }
    }
  };

  const handlePrev = () => {
    hapticLight();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Submit button clicked in bottom bar
  const handleSubmitButtonClick = () => {
    hapticMedium();
    const remainingUnsolved: number[] = [];
    for (let i = 0; i < totalQuestions; i++) {
      if (answers[i] === undefined) remainingUnsolved.push(i);
    }

    if (remainingUnsolved.length > 0 && (!isReattemptPhase || reattemptRound < 2)) {
      const nextRound = isReattemptPhase ? reattemptRound + 1 : 1;
      const nextDurSeconds = getSkipDurationSeconds(nextRound);
      const label = getChanceLabel(nextRound);
      setSecondChanceModal({
        isOpen: true,
        unsolvedCount: remainingUnsolved.length,
        initialRoundCount: isReattemptPhase ? (roundInitialCount || remainingUnsolved.length) : totalQuestions,
        remainingIndexes: remainingUnsolved,
        round: nextRound,
        chanceLabel: label,
        nextDuration: nextDurSeconds,
      });
    } else {
      setShowSubmitModal(true);
    }
  };

  // 2nd Chance Modal Actions
  const handleAcceptSecondChance = () => {
    if (!secondChanceModal) return;
    hapticMedium();

    const remaining = secondChanceModal.remainingIndexes || [];
    const firstTarget = remaining.length > 0 ? remaining[0] : 0;
    const targetRound = secondChanceModal.round;

    setIsReattemptPhase(true);
    setReattemptRound(targetRound);
    setRoundInitialCount(secondChanceModal.initialRoundCount || remaining.length);
    setReattemptIndices(remaining);
    setSecondChanceModal(null);
    setCurrentIndex(firstTarget);

    const dur = secondChanceModal.nextDuration || 60;
    setQSecondsLeft(dur);
    setQMaxSeconds(dur);

    // Update skip entries for all remaining questions so ladder timer applies to all of them
    const updatedSkips = { ...skipEntries };
    remaining.forEach((idx) => {
      const prevSkip = updatedSkips[idx]?.skipCount || 0;
      const newSkipCount = Math.max(targetRound, prevSkip + 1);
      updatedSkips[idx] = {
        skipCount: newSkipCount,
        lastSkippedAt: Date.now(),
        nextDurationSeconds: dur,
      };
    });
    setSkipEntries(updatedSkips);

    setSkipToast({
      id: Date.now(),
      questionNumber: firstTarget + 1,
      nextDurationSeconds: dur,
      message: `🎯 ${secondChanceModal.chanceLabel} Round Shuru!`,
      subMessage: `${remaining.length} Unsolved Questions ke liye har question par ${formatDurationLabel(dur)} mila hai!`,
      isAuto: false,
    });
  };

  const handleDeclineSecondChance = () => {
    setSecondChanceModal(null);
    handleConfirmSubmit();
  };

  // Final submit handler
  const handleConfirmSubmit = () => {
    hapticStrong();
    setShowSubmitModal(false);
    setSecondChanceModal(null);
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
    setSkipEntries({});
    setIsReattemptPhase(false);
    setReattemptRound(0);
    setSecondChanceModal(null);
    setSkipToast(null);
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
      
      {/* ── FLOATING SKIP TOAST NOTIFICATION ── */}
      {skipToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-amber-500/40 backdrop-blur-md animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-amber-300 leading-snug">{skipToast.message}</p>
              <p className="text-[11px] font-bold text-slate-300 mt-0.5">{skipToast.subMessage}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setSkipToast(null)} 
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── TOP HEADER / NAV BAR ── */}
      {isRotatedOrLandscape ? (
        /* Landscape 1/20 (5vh) Ultra-Slim Consolidated Control Bar */
        <header
          className="bg-white border-b border-slate-200 px-2 flex items-center justify-between gap-1.5 shrink-0 z-30 sticky top-0"
          style={{ height: '5vh', minHeight: '26px', maxHeight: '38px' }}
        >
          {/* Left: Back & Question counter */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                if (attemptedCount > 0) setShowExitModal(true);
                else onBack();
              }}
              className="h-[calc(5vh-6px)] min-h-[22px] px-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 active:scale-95 transition shrink-0 flex items-center gap-1 font-bold text-[11px]"
              title="Back"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Back</span>
            </button>

            <span className="font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[11px] shrink-0">
              Q{currentIndex + 1}/{totalQuestions}
            </span>

            {/* Countdown or Solved badge */}
            {isCurrentAnswered ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                <CheckCircle2 size={11} className="text-emerald-600" />
                <span>Solved</span>
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 font-mono font-black text-[10px] px-1.5 py-0.5 rounded-full border ${
                qSecondsLeft <= 5 ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}>
                <Clock size={11} />
                <span>{qSecondsLeft}s</span>
              </span>
            )}

            {isReattemptPhase && (
              <span className="hidden md:inline font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200 truncate">
                ⚡ {getChanceLabel(reattemptRound)}
              </span>
            )}
          </div>

          {/* Right: Quick actions (Timer, Rotate, Grid, Star, Attempted) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Elapsed Time */}
            <div className="flex items-center gap-1 font-mono font-black text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Clock size={12} className="text-indigo-600" />
              <span>{formatTime(timeElapsed)}</span>
            </div>

            {/* Screen Rotate Button */}
            <button
              type="button"
              onClick={handleToggleRotate}
              className="h-[calc(5vh-6px)] min-h-[22px] px-2 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 flex items-center gap-1 font-bold text-[11px] active:scale-95 transition"
              title="Rotate Screen (Landscape / Portrait)"
              aria-label="Rotate Screen"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Rotate</span>
            </button>

            {/* Question Palette Trigger */}
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                setPaletteOpenState(true);
              }}
              className="h-[calc(5vh-6px)] min-h-[22px] px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1 font-bold text-[11px] active:scale-95 transition"
              title="Question Palette Grid"
            >
              <LayoutGrid size={12} />
              <span>Grid ({attemptedCount}/{totalQuestions})</span>
            </button>

            {/* Bookmark */}
            <button
              type="button"
              onClick={toggleMarkCurrent}
              className={`h-[calc(5vh-6px)] min-h-[22px] w-[calc(5vh-6px)] min-w-[22px] rounded-lg border flex items-center justify-center transition active:scale-95 ${
                isCurrentMarked ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-500'
              }`}
              title={isCurrentMarked ? 'Remove Mark' : 'Mark for Review'}
            >
              <Star size={12} className={isCurrentMarked ? 'fill-amber-500 text-amber-500' : ''} />
            </button>
          </div>
        </header>
      ) : (
        <>
          {/* Normal Portrait Header */}
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
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
                    {isReattemptPhase ? (
                      <>
                        <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          ⚡ {getChanceLabel(reattemptRound)}: {currentUnsolvedPos}/{totalUnsolvedInRound} Unsolved
                        </span>
                        <span className="font-bold text-slate-600">
                          (Q. {currentIndex + 1} of {totalQuestions})
                        </span>
                      </>
                    ) : (
                      <span>Q. {currentIndex + 1} of {totalQuestions}</span>
                    )}
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-emerald-600 font-bold">{attemptedCount} Answered</span>
                  </div>
                </div>
              </div>

              {/* Right: Timer & Palette Trigger & Rotate */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Rotate Screen button */}
                <button
                  type="button"
                  onClick={handleToggleRotate}
                  className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition active:scale-95"
                  title="Rotate Screen (Landscape Mode)"
                  aria-label="Rotate Screen"
                >
                  <RotateCcw size={15} />
                </button>

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
                    {isReattemptPhase ? `${currentUnsolvedPos}/${totalUnsolvedInRound} Left` : `${attemptedCount}/${totalQuestions}`}
                  </span>
                </button>
              </div>
            </header>
          )}

          {/* ── CONSOLIDATED CONTROLS & QUESTION NAVIGATION STRIP (Portrait 2nd Line) ── */}
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

            {/* Right side controls: Question count, Font size, Bookmark, Community */}
            <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-slate-200">
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

              {/* Bookmark Button */}
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
        </>
      )}

      {/* ── MAIN QUESTION BODY: 18/20 (90vh in rotated landscape, flex-1 in portrait) ── */}
      <main
        className={`overflow-y-auto w-full flex flex-col ${
          isRotatedOrLandscape ? 'p-1 sm:p-2' : 'flex-1 p-0 sm:px-4 sm:py-4'
        }`}
        style={isRotatedOrLandscape ? { height: '90vh', flex: '0 0 90vh' } : undefined}
      >
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
                    {isReattemptPhase && (
                      <span className="ml-1 text-amber-700 font-black">
                        • Unsolved {currentUnsolvedPos}/{totalUnsolvedInRound}
                      </span>
                    )}
                  </span>
                  {/* Round Badge */}
                  <span className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 font-bold text-[10px] shrink-0">
                    {isReattemptPhase ? `⚡ ${getChanceLabel(reattemptRound)}` : '🎯 Round 1'} ({formatDurationLabel(qMaxSeconds)})
                  </span>
                  {currentQ.topic && (
                    <span className="text-[11px] font-bold text-slate-500 truncate max-w-[160px] sm:max-w-xs">
                      {currentQ.topic}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Active Question Countdown Timer / Solved status badge */}
                  {isCurrentAnswered ? (
                    <span className="flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      <span>Solved</span>
                    </span>
                  ) : (
                    <div 
                      className={`flex items-center gap-1 font-mono font-black text-xs px-2.5 py-0.5 rounded-full border transition-all ${
                        qSecondsLeft <= 5
                          ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                          : qSecondsLeft <= 15
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      }`}
                      title={`${qSecondsLeft}s remaining before auto-skip`}
                    >
                      <Clock size={12} className={qSecondsLeft <= 5 ? 'text-rose-600 animate-spin' : 'text-emerald-600'} />
                      <span>{qSecondsLeft}s</span>
                    </div>
                  )}

                  {isCurrentMarked && (
                    <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                      <Star size={10} className="fill-amber-500 text-amber-500" />
                      <span className="hidden sm:inline">Marked</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Countdown Bar under header */}
              {!isCurrentAnswered && qMaxSeconds > 0 && (
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2.5">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                      qSecondsLeft <= 5 ? 'bg-rose-500' : qSecondsLeft <= 15 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(0, (qSecondsLeft / qMaxSeconds) * 100)}%` }}
                  />
                </div>
              )}

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

      {/* ── ERGONOMIC BOTTOM ACTION BAR: 1/20 (5vh in rotated landscape, py-3 in portrait) ── */}
      <footer 
        className={`bg-white border-t border-slate-200/90 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.05)] sticky bottom-0 z-30 shrink-0 flex items-center justify-between ${
          isRotatedOrLandscape ? 'px-2 gap-2' : 'px-3 sm:px-6 py-3 gap-2 sm:gap-4'
        }`}
        style={isRotatedOrLandscape ? { height: '5vh', minHeight: '26px', maxHeight: '38px' } : undefined}
      >
        {/* Left: Back & Skip buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`flex items-center gap-1 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-30 disabled:pointer-events-none transition active:scale-95 cursor-pointer whitespace-nowrap ${
              isRotatedOrLandscape ? 'h-[calc(5vh-6px)] min-h-[22px] px-2.5 text-xs' : 'px-3 sm:px-4 py-2.5 text-xs sm:text-sm'
            }`}
            aria-label="Previous question"
          >
            <ChevronLeft size={isRotatedOrLandscape ? 13 : 16} />
            <span>Prev</span>
          </button>
        </div>

        {/* Center: Submit button */}
        <button
          type="button"
          onClick={handleSubmitButtonClick}
          className={`flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black shadow-md shadow-emerald-600/25 transition cursor-pointer whitespace-nowrap ${
            isRotatedOrLandscape ? 'h-[calc(5vh-6px)] min-h-[22px] px-3 text-xs' : 'px-3.5 sm:px-5 py-2.5 text-xs sm:text-sm'
          }`}
        >
          <Trophy size={isRotatedOrLandscape ? 13 : 16} />
          <span>Submit</span>
        </button>

        {/* Right: Next Question */}
        <button
          type="button"
          onClick={handleNext}
          className={`flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold shadow-md shadow-indigo-600/25 transition cursor-pointer whitespace-nowrap ${
            isRotatedOrLandscape ? 'h-[calc(5vh-6px)] min-h-[22px] px-3 text-xs' : 'px-3.5 sm:px-5 py-2.5 text-xs sm:text-sm'
          }`}
        >
          <span>
            {isCurrentAnswered ? 'Next' : (currentIndex >= totalQuestions - 1 ? 'Review & Submit' : 'Next')}
          </span>
          <ChevronRight size={isRotatedOrLandscape ? 13 : 16} />
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

      {/* ── 2ND CHANCE CONFIRMATION MODAL (Ladder Re-attempt) ── */}
      {secondChanceModal && secondChanceModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full rounded-3xl p-6 bg-white border border-slate-200 text-slate-900 shadow-2xl flex flex-col gap-4 text-center transform transition-all animate-in zoom-in-95">
            {/* Top Graphic / Badge */}
            <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-white shadow-xl shadow-orange-500/30">
              <Sparkles size={32} className="animate-pulse" />
            </div>

            {/* Main Header / Question */}
            <div className="flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-1.5 mx-auto px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                <RotateCcw size={12} />
                <span>Round Complete • Re-attempt Choice</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {secondChanceModal.initialRoundCount && secondChanceModal.initialRoundCount > secondChanceModal.unsolvedCount ? (
                  <span>
                    Aapne {secondChanceModal.initialRoundCount} me se{' '}
                    <span className="text-emerald-600 underline font-black">
                      {Math.max(0, secondChanceModal.initialRoundCount - secondChanceModal.unsolvedCount)}
                    </span>{' '}
                    solve kiye,{' '}
                    <span className="text-amber-600 underline decoration-amber-500 underline-offset-4">
                      {secondChanceModal.unsolvedCount}
                    </span>{' '}
                    abhi bhi baaki hain!
                  </span>
                ) : (
                  <span>
                    Aap <span className="text-amber-600 underline decoration-amber-500 underline-offset-4">{secondChanceModal.unsolvedCount}</span> Question nahi bana paye!
                  </span>
                )}
              </h3>
              <p className="text-sm font-bold text-slate-600">
                Kya aapko {secondChanceModal.chanceLabel} chahiye? 🎯
              </p>
            </div>

            {/* Status Summary Card */}
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 font-semibold text-center leading-relaxed">
              📌 <strong className="font-bold">Round Summary:</strong> Aapne{' '}
              <span className="font-black text-slate-900">{secondChanceModal.initialRoundCount || totalQuestions}</span> me se{' '}
              <span className="font-black text-emerald-700">
                {Math.max(0, (secondChanceModal.initialRoundCount || totalQuestions) - secondChanceModal.unsolvedCount)}
              </span>{' '}
              solve kiye,{' '}
              <span className="font-black text-amber-700">{secondChanceModal.unsolvedCount}</span> abhi bhi baaki hain.
            </div>

            {/* Quick Summary Pill Strip */}
            <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Hal Kiye Gaye (Total)</span>
                <span className="text-base font-black text-emerald-600">
                  {attemptedCount}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Nahi Bane (Remaining)</span>
                <span className="text-base font-black text-amber-600">
                  {secondChanceModal.unsolvedCount}
                </span>
              </div>
            </div>

            {/* Info / Rule Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-left text-amber-900 leading-relaxed flex items-start gap-2.5">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">{secondChanceModal.chanceLabel} Rule:</strong> Chhute huye questions ko hal karne ke liye har question par <span className="font-black underline">{formatDurationLabel(secondChanceModal.nextDuration)}</span> ka timer milega!{secondChanceModal.round >= 2 ? ' ⚠️ Yeh aakhri (3rd) chance hai — iske baad 4th chance nahi milega!' : ' Agar abhi score jama karna chahte hain toh Submit button dabayein.'}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 mt-1">
              <button
                type="button"
                onClick={handleAcceptSecondChance}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
              >
                <RotateCcw size={18} />
                <span>Haan, {secondChanceModal.chanceLabel} Chahiye ⚡ ({formatDurationLabel(secondChanceModal.nextDuration)} Timer)</span>
              </button>

              <button
                type="button"
                onClick={handleDeclineSecondChance}
                className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
              >
                <CheckCircle2 size={16} className="text-slate-500" />
                <span>Nahi, Test Submit Karein 📤 (Final Result)</span>
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
