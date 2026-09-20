import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ChevronRight, ChevronLeft, RotateCw, Volume2, Square, Shuffle,
  Lightbulb, Edit2, X, MoreVertical, RefreshCw, BookOpen, Tv, CheckCircle,
  Maximize2, Minimize2, LayoutGrid, Users, Radio, Sun, Moon, Scroll,
  Timer, VolumeX, Eye, EyeOff, Slash, HelpCircle, Sparkles, Award, Bookmark
} from 'lucide-react';
import type { MCQItem } from '../types';
import type { User, SystemSettings } from '../types';
import { speakText, stopSpeech } from '../utils/textToSpeech';
import { recordFlashcardSession } from '../utils/flashcardHistory';
import { recordProjectorAnswer } from '../utils/activityTracker';
import { getLevelFromScore, getEffectiveDailyLimit } from '../utils/levelSystem';
import { getUserTier } from '../utils/permissionUtils';
import { applyDeduction } from '../utils/creditSystem';
import { saveUserToLive, saveSuggestion } from '../firebase';
import { fireCreditNotify } from '../utils/creditNotify';
import { loadRoutineData } from '../utils/routineStorage';
import { useAppTheme } from '../utils/themeContext';
import { tryEarnScore } from '../utils/scoreSystem';
import { rotateScreen } from '../utils/displayPrefs';
import { fireSessionComplete } from '../utils/sessionNotify';
import { renderMathInHtml, formatExplanationHtml } from '../utils/mathUtils';
import { inlineMd, parseMcqQuestion } from '../utils/mcqRender';
import McqQuestionDisplay from './McqQuestionDisplay';
import McqPracticeCard from './McqPracticeCard';
import McqQuestionNavigator from './McqQuestionNavigator';
import { deferMcqCreditsFromXp } from '../utils/studyRewards';
import { McqAnalysisOverlay } from './McqAnalysisOverlay';
import { hapticCorrect, hapticWrong, hapticLight } from '../utils/haptic';
import { playSoundClick, playSoundCorrect, playSoundWrong, playSoundVictory, isSoundEnabled, setSoundEnabled } from '../utils/soundEffects';
import DraggableNstaLogoFab from './DraggableNstaLogoFab';

interface Props {
  questions: MCQItem[];
  title?: string;
  subtitle?: string;
  subject?: string;
  onBack: () => void;
  user?: User;
  settings?: SystemSettings | null;
  onUpdateUser?: (u: User) => void;
  sourceMeta?: { lessonTitle?: string; subject?: string; classLevel?: string; };
  /** Firebase key for the source entry — used to link MCQ correction suggestions back to the right entry.
   *  Format: "lucent_ENTRYID_pPAGEINDEX" or "hw_ENTRYID" */
  sourceKey?: string;
  /** If true, component opens directly in Projector Mode (TV button shortcut) */
  startInProjectorMode?: boolean;
  /** Keep the parent lesson tab selection in sync when projector is toggled
   * from inside the flashcard overlay. */
  onProjectorModeChange?: (enabled: boolean) => void;
  /** Lesson tab bar rendered at the very top (Reading Mode | Writing Mode | MCQ Practice | Projector) */
  tabBar?: React.ReactNode;
  /** App bottom navigation bar rendered at the bottom in Projector Mode */
  bottomNav?: React.ReactNode;
  /** If true, hides the "PROJECTOR MODE" badge in the projector header */
  hideProjectorLabel?: boolean;
  /** Trigger to open Group Study / Live Room modal for this flashcard set */
  onOpenGroupStudy?: () => void;
}

const CREDIT_COST = 5;

const PROJ_FONT_SIZES = [13, 15, 17, 20, 24, 28, 32, 36, 40] as const;
const PROJ_FONT_KEY = 'projector_mcq_font_size';
const getStoredProjFontIdx = () => {
  try {
    const v = parseInt(localStorage.getItem(PROJ_FONT_KEY) || '2', 10);
    return (!isNaN(v) && v >= 0 && v < PROJ_FONT_SIZES.length) ? v : 2;
  } catch { return 2; }
};

const stripHtml = (s: string) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const sampleN = <T,>(arr: T[], n: number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};

const getTodayKey = (userId: string) =>
  `nst_fc_daily_${userId}_${new Date().toDateString()}`;

const getTodayCount = (userId: string): number => {
  try { return parseInt(localStorage.getItem(getTodayKey(userId)) || '0', 10); } catch { return 0; }
};

const addTodayCount = (userId: string, n: number) => {
  try { localStorage.setItem(getTodayKey(userId), String(getTodayCount(userId) + n)); } catch {}
};

export const FlashcardMcqView: React.FC<Props> = ({
  questions, title, subtitle, subject, onBack, user, settings, onUpdateUser, sourceMeta, sourceKey, startInProjectorMode, onProjectorModeChange, tabBar, bottomNav, hideProjectorLabel, onOpenGroupStudy
}) => {
  const isMountedRef = useRef(true);
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  // Confidence level per card position
  const [confidenceMap, setConfidenceMap] = useState<Record<number, 'easy'|'medium'|'hard'>>({});
  // Suggestion / correction panel
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionNote, setSuggestionNote] = useState('');
  const [suggestionSaved, setSuggestionSaved] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);
  // ── Projector Mode ──
  const [isProjectorMode, setIsProjectorMode] = useState(() => startInProjectorMode ?? false);
  // The lesson tab bar can switch this overlay between Flashcard and Projector
  // without remounting the component. Keep the local presentation state in
  // sync with that external mode switch.
  useEffect(() => {
    if (typeof startInProjectorMode === 'boolean') {
      setIsProjectorMode(startInProjectorMode);
    }
  }, [startInProjectorMode]);
  const [projectorFontIdx, setProjectorFontIdx] = useState<number>(getStoredProjFontIdx);
  const projectorFontSize = PROJ_FONT_SIZES[projectorFontIdx];
  const changeProjFont = (dir: 1 | -1) => {
    setProjectorFontIdx(prev => {
      const next = Math.max(0, Math.min(PROJ_FONT_SIZES.length - 1, prev + dir));
      try { localStorage.setItem(PROJ_FONT_KEY, String(next)); } catch {}
      return next;
    });
  };
  const [projectorQIndex, setProjectorQIndex] = useState(0);
  const [projectorReveal, setProjectorReveal] = useState(false);
  const [projectorSelected, setProjectorSelected] = useState<number | null>(null);
  const [projectorRotated, setProjectorRotated] = useState(false);
  const [projectorFocused, setProjectorFocused] = useState(false);
  // ── Projector score tracking ──
  const [projectorCorrect, setProjectorCorrect] = useState(0);
  const [projectorWrong, setProjectorWrong] = useState(0);
  const [projectorAnswered, setProjectorAnswered] = useState<Set<number>>(new Set());
  const projectorQStartTimeRef = useRef(Date.now());
  // Persistent per-question selections (qIndex → chosen option index)
  const [projectorSelections, setProjectorSelections] = useState<Record<number, number>>({});
  const [projectorSkipped, setProjectorSkipped] = useState<Set<number>>(new Set());
  const [projectorNavigatorOpen, setProjectorNavigatorOpen] = useState(false);
  // Review screen — shown after Submit
  const [projectorShowReview, setProjectorShowReview] = useState(false);

  // ── Projector Mode Mature Enhancements ──
  const [projectorTheme, setProjectorTheme] = useState<'light' | 'dark' | 'sepia'>(() => {
    try {
      return (localStorage.getItem('nst_projector_theme') as any) || 'dark';
    } catch {
      return 'dark';
    }
  });
  const handleSetProjectorTheme = (theme: 'light' | 'dark' | 'sepia') => {
    setProjectorTheme(theme);
    try { localStorage.setItem('nst_projector_theme', theme); } catch {}
  };

  // Sound effects toggle
  const [soundActive, setSoundActive] = useState<boolean>(() => isSoundEnabled());
  const handleToggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    setSoundEnabled(next);
    playSoundClick();
  };

  // Bookmarking
  const [projectorBookmarked, setProjectorBookmarked] = useState<Set<number>>(new Set());
  const toggleBookmark = (idx: number) => {
    setProjectorBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
    playSoundClick();
  };

  // Option Elimination (50-50 / Strike-through)
  const [projectorEliminated, setProjectorEliminated] = useState<Record<number, Set<number>>>({});
  const [showEliminateTool, setShowEliminateTool] = useState(false);
  const toggleEliminateOption = (qIdx: number, optIdx: number) => {
    setProjectorEliminated(prev => {
      const currentSet = prev[qIdx] || new Set<number>();
      const nextSet = new Set(currentSet);
      if (nextSet.has(optIdx)) nextSet.delete(optIdx);
      else nextSet.add(optIdx);
      return { ...prev, [qIdx]: nextSet };
    });
    playSoundClick();
  };

  // Classroom Drill Timer ('off' | 'stopwatch' | '30s' | '45s' | '60s')
  type TimerMode = 'off' | 'stopwatch' | '30s' | '45s' | '60s';
  const [drillTimerMode, setDrillTimerMode] = useState<TimerMode>('off');
  const [drillTimeRemaining, setDrillTimeRemaining] = useState<number>(0);
  const [drillStopwatchSec, setDrillStopwatchSec] = useState<number>(0);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Drill Timer Countdown & Stopwatch Loop
  useEffect(() => {
    if (!isProjectorMode || drillTimerMode === 'off' || projectorShowReview) return;
    const interval = setInterval(() => {
      if (drillTimerMode === 'stopwatch') {
        setDrillStopwatchSec(s => s + 1);
      } else {
        setDrillTimeRemaining(r => {
          if (r <= 1) {
            setProjectorReveal(true);
            playSoundWrong();
            return 0;
          }
          return r - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isProjectorMode, drillTimerMode, projectorQIndex, projectorShowReview]);

  // Reset drill timer when question changes
  useEffect(() => {
    if (drillTimerMode === '30s') setDrillTimeRemaining(30);
    else if (drillTimerMode === '45s') setDrillTimeRemaining(45);
    else if (drillTimerMode === '60s') setDrillTimeRemaining(60);
    else if (drillTimerMode === 'stopwatch') setDrillStopwatchSec(0);
  }, [projectorQIndex, drillTimerMode]);

  // Snapshot of question data captured at submit time so the review never
  // depends on a potentially-stale `questions` prop or closure.
  const [reviewSnapshot, setReviewSnapshot] = useState<{
    answered: number[];
    selections: Record<number, number>;
    questions: MCQItem[];
  } | null>(null);
  // Hard-card review queue (stores positions from main session)
  const [hardQueue, setHardQueue] = useState<number[]>([]);
  const hardQueueRef = useRef<number[]>([]);
  const [hardReviewMode, setHardReviewMode] = useState(false);
  const [hardReviewPos, setHardReviewPos] = useState(0);

  const sessionStartRef = useRef(Date.now());
  const viewedIdxRef = useRef<Set<number>>(new Set([0]));
  const sessionCommittedRef = useRef(false); // prevents double-counting on exit
  // Track which card positions have already given +1 pts this session (Answer Dekho)
  const revealedPtsRef = useRef<Set<number>>(new Set());
  // Total pts earned via Answer Dekho reveals this session (for session-complete event)
  const sessionRevealPtsRef = useRef(0);
  // Live session score shown in top bar (updates on each reveal)
  const [sessionScore, setSessionScore] = useState(0);
  // Score chip tooltip
  const [scoreTooltip, setScoreTooltip] = useState(false);

  // ── MCQ Score Popup ────────────────────────────────────────────────────────
  const [mcqScorePopup, setMcqScorePopup] = useState<number | null>(null);
  const [mcqScoreVisible, setMcqScoreVisible] = useState<boolean>(false);
  const mcqPopupTimerRef = useRef<any>(null);

  const showMcqScore = (pts: number) => {
    if (mcqPopupTimerRef.current) clearTimeout(mcqPopupTimerRef.current);
    setMcqScorePopup(pts);
    setMcqScoreVisible(true);
    mcqPopupTimerRef.current = setTimeout(() => setMcqScoreVisible(false), 1800);
  };

  /** Called when user taps "Answer Dekho". Gives +1 pts once per card per session. */
  const handleRevealAnswer = () => {
    setFlipped(true);
    // Award +1 pts only the first time this card is revealed this session
    if (!revealedPtsRef.current.has(pos)) {
      revealedPtsRef.current.add(pos);
      // Always update visual chip so everyone (including admin/test) sees it increment
      setSessionScore(prev => prev + 1);
      if (user?.id && !isAdmin && onUpdateUser) {
        const pts = tryEarnScore(user.id, 1, userTier, userTier !== 'FREE', 0, 'FLASHCARD_REVEAL');
        if (pts > 0) {
          sessionRevealPtsRef.current += pts;
          showMcqScore(pts);
          const _routineOn = loadRoutineData(user.id).enabled;
          deferMcqCreditsFromXp(user.id, pts, _routineOn);
          const updated = { ...user, totalScore: (user.totalScore || 0) + pts };
          onUpdateUser(updated);
          saveUserToLive(updated);
        }
      }
    }
  };

  /** Back handler — fires flashcard session-complete then calls onBack. */
  const handleBack = () => {
    if (sessionRevealPtsRef.current > 0 && user?.id) {
      const secs = Math.round((Date.now() - sessionStartRef.current) / 1000);
      fireSessionComplete({
        type: 'LESSON',
        subject: subject || '',
        chapter: title || '',
        timeSecs: secs,
        activityType: 'Flashcard',
        sessionScore: sessionRevealPtsRef.current,
      });
      sessionRevealPtsRef.current = 0;
    }
    onBack();
  };

  const isAdmin = user?.role === 'ADMIN';
  const userId = user?.id || 'guest';
  const userLevel = user ? getLevelFromScore(user.totalScore ?? 0) : 1;
  const userTier = user ? getUserTier(user) : 'FREE';
  const dailyLimit = isAdmin ? 9999 : getEffectiveDailyLimit('flashcard', userLevel, userTier, settings);

  const initSession = useCallback(() => {
    if (questions.length === 0) return;
    const viewedToday = getTodayCount(userId);
    const remaining = isAdmin ? 10 : Math.max(0, dailyLimit - viewedToday);
    if (remaining <= 0) {
      setLimitReached(true);
      setPickedIndices([]);
      return;
    }
    const size = Math.min(dailyLimit, remaining, questions.length);
    const idx = questions.map((_, i) => i);
    setPickedIndices(sampleN(idx, size));
    setPos(0);
    setFlipped(false);
    setLimitReached(false);
    viewedIdxRef.current = new Set([0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, userId, dailyLimit, isAdmin]);

  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  useEffect(() => {
    initSession();
    sessionStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  // When parent switches startInProjectorMode (e.g. via overlay tab bar), sync projector mode
  useEffect(() => {
    if (startInProjectorMode) {
      setIsProjectorMode(true);
      setProjectorQIndex(0);
      setProjectorReveal(false);
      setProjectorFocused(false);
      setProjectorSelected(null);
    } else if (startInProjectorMode === false) {
      setIsProjectorMode(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startInProjectorMode]);

  // Reset per-question timer whenever the projector moves to a new question
  useEffect(() => {
    projectorQStartTimeRef.current = Date.now();
    setProjectorSelected(projectorSelections[projectorQIndex] ?? null);
  }, [projectorQIndex, projectorSelections]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) { stopSpeech(); setSpeaking(false); }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    return () => {
      const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);
      recordFlashcardSession({
        subject: subject || '—',
        lessonTitle: title || 'Flashcards',
        total: pickedIndices.length,
        viewed: viewedIdxRef.current.size,
        durationSec,
      });
      // Track viewed count on back/exit if session wasn't already committed
      if (!sessionCommittedRef.current && viewedIdxRef.current.size > 0) {
        addTodayCount(userId, viewedIdxRef.current.size);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = pickedIndices.length;
  const currentQ = total > 0 ? (questions[pickedIndices[pos]] ?? null) : null;
  // In hard-review mode, use the hard queue to pick the active question
  const activeQ = hardReviewMode
    ? (questions[pickedIndices[hardQueue[hardReviewPos]]] ?? null)
    : currentQ;
  const activePos   = hardReviewMode ? hardReviewPos : pos;
  const activeTotal = hardReviewMode ? hardQueue.length : total;

  const speakQuestion = () => {
    if (!currentQ) return;
    const text = `Question ${pos + 1}: ${stripHtml(currentQ.question)}`;
    if (speaking) { stopSpeech(); setSpeaking(false); return; }
    stopSpeech();
    setSpeaking(true);
    speakText(text, null, 1.0, 'hi-IN', () => setSpeaking(true), () => setSpeaking(false))
      .catch(() => setSpeaking(false));
  };

  const goNext = () => {
    stopSpeech();
    setSpeaking(false);
    if (pos >= total - 1) {
      sessionCommittedRef.current = true;
      setFlipped(false);
      const hq = [...hardQueueRef.current];
      setTimeout(() => {
        if (!isMountedRef.current) return;
        if (hq.length > 0) {
          // Start hard-card review instead of reshuffling
          setHardReviewMode(true);
          setHardReviewPos(0);
          setFlipped(false);
          sessionCommittedRef.current = false;
        } else {
          addTodayCount(userId, viewedIdxRef.current.size);
          sessionCommittedRef.current = false;
          setConfidenceMap({});
          setHardQueue([]); hardQueueRef.current = [];
          initSession();
        }
      }, flipped ? 520 : 0);
      return;
    }
    const nextPos = pos + 1;
    if (flipped) {
      setFlipped(false);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setPos(nextPos);
        viewedIdxRef.current.add(nextPos);
      }, 520);
    } else {
      setPos(nextPos);
      viewedIdxRef.current.add(nextPos);
    }
  };

  const goNextHard = () => {
    stopSpeech();
    setSpeaking(false);
    if (hardReviewPos >= hardQueue.length - 1) {
      // Hard review done — clear and fresh session
      setFlipped(false);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        addTodayCount(userId, hardQueue.length);
        setHardReviewMode(false);
        setHardQueue([]); hardQueueRef.current = [];
        setHardReviewPos(0);
        setConfidenceMap({});
        initSession();
      }, flipped ? 520 : 0);
      return;
    }
    const nextHardPos = hardReviewPos + 1;
    if (flipped) {
      setFlipped(false);
      setTimeout(() => { if (isMountedRef.current) setHardReviewPos(nextHardPos); }, 520);
    } else {
      setHardReviewPos(nextHardPos);
    }
  };

  const goPrevHard = () => {
    stopSpeech();
    setSpeaking(false);
    if (flipped) {
      setFlipped(false);
      setTimeout(() => { if (isMountedRef.current) setHardReviewPos(p => Math.max(0, p - 1)); }, 520);
    } else {
      setHardReviewPos(p => Math.max(0, p - 1));
    }
  };

  const handleConfidence = (level: 'easy'|'medium'|'hard') => {
    if (hardReviewMode) return; // no confidence rating in hard review
    if (confidenceMap[pos] !== undefined) return; // already rated
    setConfidenceMap(prev => ({ ...prev, [pos]: level }));
    if (level === 'hard') {
      const newQ = [...hardQueueRef.current, pos];
      hardQueueRef.current = newQ;
      setHardQueue(newQ);
    }
    // ── Award score + credits when "Easy" (student knew the answer) ───────
    if (level === 'easy' && user?.id && !isAdmin) {
      const pts = tryEarnScore(user.id, 1, userTier, userTier !== 'FREE', 0, 'FLASHCARD_MCQ_CORRECT');
      if (pts > 0) {
        showMcqScore(pts);
        if (onUpdateUser) {
          const _routineOn  = loadRoutineData(user.id).enabled;
          deferMcqCreditsFromXp(user.id, pts, _routineOn);
          const updated = { ...user, totalScore: (user.totalScore || 0) + pts };
          onUpdateUser(updated);
          saveUserToLive(updated);
        }
      }
    }
    // Auto-advance after brief visual feedback
    setTimeout(() => { if (isMountedRef.current) goNext(); }, 480);
  };

  const goPrev = () => {
    stopSpeech();
    setSpeaking(false);
    if (flipped) {
      setFlipped(false);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setPos(p => Math.max(0, p - 1));
      }, 520);
    } else {
      setPos(p => Math.max(0, p - 1));
    }
  };

  const reshuffle = () => {
    stopSpeech();
    setSpeaking(false);
    addTodayCount(userId, viewedIdxRef.current.size);
    sessionCommittedRef.current = false;
    setConfidenceMap({});
    setHardQueue([]); hardQueueRef.current = [];
    setHardReviewMode(false);
    setHardReviewPos(0);
    sessionStartRef.current = Date.now();
    revealedPtsRef.current = new Set(); // reset per-session reveal tracking
    initSession();
  };

  const payAndContinue = () => {
    if (!user || !onUpdateUser) return;
    const updatedUser = applyDeduction(user, CREDIT_COST) ?? user;
    localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
    saveUserToLive(updatedUser);
    onUpdateUser(updatedUser);
    fireCreditNotify({ type: 'DEDUCTION', message: `Flashcard extra session: ${CREDIT_COST} CR` });
    try { localStorage.removeItem(getTodayKey(userId)); } catch {}
    sessionStartRef.current = Date.now();
    initSession();
  };

  const appTheme = useAppTheme();
  const fcBg1 = (appTheme as any).flashcardBg1 || appTheme.primary;
  const fcBg2 = (appTheme as any).flashcardBg2 || appTheme.mid;
  const tierBgStyle = { background: `linear-gradient(135deg, ${fcBg1} 0%, ${fcBg2} 50%, ${fcBg1} 100%)` };

  const isLast = pos >= total - 1;

  const handleProjectorOptionSelect = useCallback((oi: number) => {
    if (projectorShowReview) return;
    const pq = questions[projectorQIndex];
    if (!pq) return;
    const previousSelection = projectorSelections[projectorQIndex];
    if (previousSelection === oi) return;
    setProjectorSelected(oi);
    setProjectorSelections(prev => ({ ...prev, [projectorQIndex]: oi }));
    setProjectorSkipped(prev => {
      const next = new Set(prev);
      next.delete(projectorQIndex);
      return next;
    });
    const isCorrect = oi === pq.correctAnswer;
    if (isCorrect) {
      playSoundCorrect();
      hapticCorrect();
    } else {
      playSoundWrong();
      hapticWrong();
    }
    if (previousSelection === undefined) {
      const newAnswered = new Set(projectorAnswered);
      newAnswered.add(projectorQIndex);
      setProjectorAnswered(newAnswered);
    } else {
      const wasCorrect = previousSelection === pq.correctAnswer;
      if (wasCorrect !== isCorrect) {
        if (isCorrect) {
          setProjectorCorrect(c => c + 1);
          setProjectorWrong(w => Math.max(0, w - 1));
        } else {
          setProjectorCorrect(c => Math.max(0, c - 1));
          setProjectorWrong(w => w + 1);
        }
      }
    }
    const elapsedSec = Math.round((Date.now() - projectorQStartTimeRef.current) / 1000);
    if (previousSelection === undefined && user?.id && sourceKey) {
      recordProjectorAnswer(user.id, sourceKey, `proj_${projectorQIndex}`, isCorrect, elapsedSec);
    }
    if (previousSelection === undefined && isCorrect) {
      setProjectorCorrect(c => c + 1);
      if (user?.id && !isAdmin) {
        const pts = tryEarnScore(user.id, 1, userTier, userTier !== 'FREE', 0, 'FLASHCARD_MCQ_CORRECT');
        if (pts > 0) {
          showMcqScore(pts);
          if (onUpdateUser) {
            const _routineOn = loadRoutineData(user.id).enabled;
            deferMcqCreditsFromXp(user.id, pts, _routineOn);
            const updated = { ...user, totalScore: (user.totalScore || 0) + pts };
            onUpdateUser(updated);
            saveUserToLive(updated);
          }
        }
      }
    } else if (previousSelection === undefined) {
      setProjectorWrong(w => w + 1);
    }
  }, [projectorShowReview, questions, projectorQIndex, projectorSelections, projectorAnswered, user, sourceKey, isAdmin, userTier, onUpdateUser]);

  const toggleProjectorNativeFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setProjectorFocused(f => !f);
    }
  };

  useEffect(() => {
    if (!isProjectorMode || projectorShowReview) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (projectorQIndex < questions.length - 1) {
          const nextIdx = projectorQIndex + 1;
          setProjectorQIndex(nextIdx);
          setProjectorReveal(false);
          setProjectorSelected(projectorSelections[nextIdx] ?? null);
          playSoundClick();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (projectorQIndex > 0) {
          const prevIdx = projectorQIndex - 1;
          setProjectorQIndex(prevIdx);
          setProjectorReveal(false);
          setProjectorSelected(projectorSelections[prevIdx] ?? null);
          playSoundClick();
        }
      } else if (['1', '2', '3', '4', 'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, number> = {
          '1': 0, 'a': 0, 'A': 0,
          '2': 1, 'b': 1, 'B': 1,
          '3': 2, 'c': 2, 'C': 2,
          '4': 3, 'd': 3, 'D': 3,
        };
        const optIdx = map[e.key];
        if (optIdx !== undefined) {
          handleProjectorOptionSelect(optIdx);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setProjectorReveal(prev => !prev);
        playSoundClick();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleSetProjectorTheme(
          projectorTheme === 'dark' ? 'light' : projectorTheme === 'light' ? 'sepia' : 'dark'
        );
        playSoundClick();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleProjectorNativeFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleSound();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (projectorQIndex < questions.length - 1) {
          setProjectorSkipped(prev => new Set([...prev, projectorQIndex]));
          const nextIdx = projectorQIndex + 1;
          setProjectorQIndex(nextIdx);
          setProjectorSelected(projectorSelections[nextIdx] ?? null);
          playSoundClick();
        }
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProjectorMode, projectorShowReview, projectorQIndex, questions.length, projectorSelections, projectorTheme, handleProjectorOptionSelect]);

  const submitProjectorQuiz = () => {
    playSoundVictory();
    const answered = Array.from(projectorAnswered).sort((a, b) => a - b);
    const correct = answered.filter(index => projectorSelections[index] === questions[index]?.correctAnswer).length;
    setProjectorCorrect(correct);
    setProjectorWrong(answered.length - correct);
    setReviewSnapshot({
      answered,
      selections: { ...projectorSelections },
      questions: [...questions],
    });
    setProjectorShowReview(true);
  };

  if (limitReached && !isProjectorMode) {
    const canPay = !!(user?.subscriptionLevel && (user.credits ?? 0) >= CREDIT_COST);
    return (
      <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh]" style={tierBgStyle}>
        {tabBar}
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="bg-white/10 text-white p-2 rounded-full active:scale-95">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-base font-black text-white">Flashcards</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="text-5xl mb-4">⚡</div>
          <p className="text-white font-black text-xl mb-2">Daily Limit Reached!</p>
          <p className="text-white/70 text-sm mb-2">
            You've used today's <span className="font-black text-white">{dailyLimit}</span> free flashcards.
          </p>
          <p className="text-white/50 text-xs mb-8">Resets tomorrow or continue with credits.</p>
          {canPay ? (
            <button
              onClick={payAndContinue}
              className="bg-white font-black px-8 py-3.5 rounded-2xl text-sm shadow-xl active:scale-95 transition mb-3"
              style={{ color: fcBg2 }}
            >
              🪙 Continue with {CREDIT_COST} Credits
            </button>
          ) : user?.subscriptionLevel ? (
            <p className="text-amber-300 text-sm font-bold">Low balance ({user?.credits ?? 0} CR). Earn more credits!</p>
          ) : (
            <p className="text-amber-300 text-sm font-bold">Upgrade your plan or come back tomorrow!</p>
          )}
          <p className="text-white/30 text-xs mt-4">Balance: {user?.credits ?? 0} CR</p>
        </div>
      </div>
    );
  }

  if (!currentQ && !isProjectorMode) {
    // If questions exist but pickedIndices is still empty, initSession is running — return null to avoid flash
    if (questions.length > 0) return null;
    return (
      <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh]" style={tierBgStyle}>
        {tabBar}
        <div className="px-4 py-3 flex items-center gap-3">
          <h2 className="text-base font-black text-white">Flashcards</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-white font-black">No MCQs available</p>
          <p className="text-white/50 text-xs mt-2">Load this chapter's content first.</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh]" style={tierBgStyle}>
      {tabBar}
      {/* MCQ Score Popup */}
      {mcqScorePopup !== null && (
        <div style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 9999,
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color: '#fff', borderRadius: 14, padding: '8px 16px',
          fontSize: 14, fontWeight: 900,
          boxShadow: '0 6px 20px rgba(99,102,241,0.4)',
          opacity: mcqScoreVisible ? 1 : 0,
          transform: mcqScoreVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
          transition: 'opacity 0.25s, transform 0.25s',
          pointerEvents: 'none',
        }}>
          ⭐ +{mcqScorePopup} pts
        </div>
      )}
      {/* Top Bar — title/actions stay separate from session stats on mobile */}
      <div className="shrink-0 px-4 pt-3 pb-2.5 border-b border-white/10">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {hardReviewMode ? (
              <>
                <p className="text-[10px] font-black text-red-300 uppercase tracking-widest truncate flex items-center gap-1">
                  <span>🔴</span> Hard Cards Review
                </p>
                <h2 className="text-sm font-black text-white truncate">{hardQueue.length} Hard Card{hardQueue.length !== 1 ? 's' : ''} dobara dekho</h2>
              </>
            ) : (
              <>
                <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest truncate">
                  🃏 Flashcards · {total} cards
                  {hardQueueRef.current.length > 0 && (
                    <span className="ml-1 text-red-300">· {hardQueueRef.current.length} Hard</span>
                  )}
                </p>
                <h2 className="text-sm font-black text-white truncate">{title || 'Flashcards'}</h2>
                {subtitle && <p className="text-[10px] text-white/50 truncate">{subtitle}</p>}
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Live Room / Group Study */}
            {onOpenGroupStudy && (
              <button
                type="button"
                onClick={onOpenGroupStudy}
                className="px-2.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 flex items-center gap-1 active:scale-95 transition"
                title="Live Flashcard Study Room"
              >
                <Users size={14} className="text-emerald-300" />
                <span className="text-[10px] font-black uppercase tracking-wider">Live</span>
              </button>
            )}
            {/* Projector Mode */}
            {questions.length > 0 && (
              <button
                onClick={() => { setProjectorQIndex(0); setProjectorReveal(false); setProjectorRotated(false); setProjectorAnswered(new Set()); setProjectorSkipped(new Set()); setProjectorNavigatorOpen(false); setProjectorCorrect(0); setProjectorWrong(0); setProjectorSelections({}); setProjectorShowReview(false); setIsProjectorMode(true); }}
                className="p-2 rounded-full bg-white/10 hover:bg-amber-500 text-amber-300 hover:text-white active:scale-95 transition"
                title="Projector Mode"
                aria-label="Projector Mode"
              >
                <Tv size={16} />
              </button>
            )}
            {/* 3-dot menu */}
            <div className="relative">
              <button
                onClick={() => setShowTopMenu(v => !v)}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full active:scale-95 transition"
                title="More"
                aria-label="More options"
              >
                <MoreVertical size={16} />
              </button>
              {showTopMenu && (
                <>
                  <div className="fixed inset-0 z-[300]" onClick={() => setShowTopMenu(false)} />
                  <div className="absolute right-0 top-10 z-[301] bg-white rounded-2xl shadow-2xl border border-slate-100 py-1.5 w-52 overflow-hidden">
                    {/* Suggestions & Corrections */}
                    <button
                      onClick={() => { setShowTopMenu(false); setFlipped(true); setShowSuggestion(true); setSuggestionNote(''); setSuggestionSaved(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors font-semibold"
                    >
                      <Lightbulb size={15} className="text-amber-500 shrink-0" />
                      Suggestions & Corrections
                    </button>
                    {/* Reshuffle — only in normal mode */}
                    {!hardReviewMode && (
                      <button
                        onClick={() => { setShowTopMenu(false); reshuffle(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors font-semibold"
                      >
                        <Shuffle size={15} className="text-indigo-500 shrink-0" />
                        Cards Shuffle karo
                      </button>
                    )}
                    {/* Restart from beginning */}
                    <button
                      onClick={() => { setShowTopMenu(false); setPos(0); setFlipped(false); setHardReviewMode(false); setHardReviewPos(0); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors font-semibold"
                    >
                      <RefreshCw size={15} className="text-slate-500 shrink-0" />
                      Shuru se dekho
                    </button>
                    {/* Hard review toggle */}
                    {hardQueueRef.current.length > 0 && (
                      <button
                        onClick={() => { setShowTopMenu(false); setHardReviewMode(v => !v); setHardReviewPos(0); setFlipped(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors text-red-600 hover:bg-red-50"
                      >
                        <BookOpen size={15} className="text-red-500 shrink-0" />
                        {hardReviewMode ? 'Normal mode mein jao' : `Hard Cards (${hardQueueRef.current.length}) dekho`}
                      </button>
                    )}
                    {/* Projector Mode */}
                    {questions.length > 0 && (
                      <button
                        onClick={() => {
                          setShowTopMenu(false);
                          setProjectorQIndex(0);
                          setProjectorReveal(false);
                          setProjectorAnswered(new Set());
                          setProjectorCorrect(0);
                          setProjectorWrong(0);
                          setProjectorSkipped(new Set());
                          setProjectorNavigatorOpen(false);
                          setProjectorSelections({});
                          setProjectorShowReview(false);
                          setIsProjectorMode(true);
                          onProjectorModeChange?.(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors text-amber-700 hover:bg-amber-50"
                      >
                        <Tv size={15} className="text-amber-500 shrink-0" />
                        📽️ Projector Mode
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Compact session stats — one row instead of mixing with actions */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-black text-white/70">
            Today <strong className="text-white">{getTodayCount(userId)}/{isAdmin ? '∞' : dailyLimit}</strong>
          </span>
          <button
            type="button"
            onClick={() => { setScoreTooltip(true); setTimeout(() => setScoreTooltip(false), 2500); }}
            className="shrink-0 rounded-lg border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1.5 text-[10px] font-black text-emerald-200"
          >
            Score <strong className="text-emerald-100">+{sessionScore}</strong>
          </button>
          {!hardReviewMode && confidenceMap[pos] && (
            <span className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black ${
              confidenceMap[pos] === 'easy' ? 'bg-emerald-500/30 text-emerald-200' :
              confidenceMap[pos] === 'medium' ? 'bg-amber-500/30 text-amber-200' :
              'bg-red-500/30 text-red-200'
            }`}>
              {confidenceMap[pos] === 'easy' ? '✓ Easy' : confidenceMap[pos] === 'medium' ? '~ Med' : '✗ Hard'}
            </span>
          )}
        </div>
      </div>

      {/* Single question progress row */}
      <div className="shrink-0 px-4 pt-2.5 pb-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-black text-white/70">
            Q <span className="text-white">{activePos + 1}</span> of {activeTotal}
          </span>
          <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${hardReviewMode ? 'bg-red-400' : 'bg-white/70'}`}
              style={{ width: `${((activePos + 1) / activeTotal) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Flashcard Score HUD — below progress bar */}
      {scoreTooltip && (
        <div style={{ margin: '0 16px 10px', background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', border: '1.5px solid rgba(99,102,241,0.2)', borderTop: '2px solid #16a34a', borderRadius: 12, padding: '7px 12px', whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 4px 20px rgba(22,163,74,0.15), inset 0 -1px 0 #c7d2fe', animation: 'rshud-slide 0.18s ease', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>🃏</span>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Flashcard Score</span>
          <div style={{ width: 1, height: 14, background: '#e2e8f0', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Score</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#16a34a', lineHeight: 1.2 }}>+{sessionScore}</span>
          </div>
          <div style={{ width: 1, height: 14, background: '#e2e8f0', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Progress</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#16a34a', lineHeight: 1.2 }}>--</span>
          </div>
          <div style={{ width: 1, height: 14, background: '#e2e8f0', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Next</span>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', lineHeight: 1.2 }}>Card reveal pe!</span>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setScoreTooltip(false)} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11, fontWeight: 900, cursor: 'pointer', flexShrink: 0, padding: 0 }}>✕</button>
        </div>
      )}

      {/* Flip Card */}
      <div className="flex-1 px-4 flex flex-col justify-center gap-4 overflow-y-auto py-2">
        {/* Guard: activeQ can be null briefly while initSession initialises pickedIndices.
            Projector mode skips the early-return guard, so we protect here instead. */}
        {!activeQ ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40 text-sm font-bold">Loading cards…</p>
          </div>
        ) : null}
        {activeQ && <div className="w-full max-w-lg mx-auto" style={{ perspective: '1200px' }}>
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              // Give statement/options questions enough room to breathe.
              // The card can still scroll internally when a question is unusually long.
              minHeight: 'clamp(344px, 53dvh, 512px)',
            }}
          >
            {/* ── FRONT: Question ── */}
            <div
              className="absolute inset-0 bg-white rounded-3xl shadow-2xl p-5 flex flex-col"
               style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', overflowY: 'auto' }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${hardReviewMode ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {hardReviewMode ? '🔴 Hard' : `Q ${activePos + 1}`}
                </span>
                <button
                  type="button"
                  onClick={speakQuestion}
                  className={`p-2 rounded-full transition shrink-0 ${
                    speaking
                      ? 'bg-red-100 text-red-600 animate-pulse'
                      : 'bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700'
                  }`}
                  title="Question suno"
                >
                  {speaking ? <Square size={13} /> : <Volume2 size={13} />}
                </button>
              </div>

              <div className="flex-1 mb-3">
                <McqQuestionDisplay
                  q={activeQ!}
                  questionClassName="text-base font-black text-slate-800 leading-snug"
                  stmtClassName="bg-indigo-50/70 border-l-4 border-indigo-300 px-3 py-2 rounded-lg text-slate-700 text-sm font-medium leading-snug"
                   showOptions
                />
              </div>

              <button
                type="button"
                onClick={handleRevealAnswer}
                className="mt-auto w-full py-3 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition shadow-md"
                style={{ background: appTheme.btnGrad }}
              >
                Answer Dekho <ChevronRight size={16} />
              </button>
            </div>

            {/* ── BACK: Answer ── */}
            <div
              className="absolute inset-0 bg-emerald-50 border-2 border-emerald-200 rounded-3xl shadow-2xl p-5 flex flex-col overflow-y-auto"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                  Correct Answer
                </span>
                <div className="flex items-center gap-1.5">
                  {/* 💡 Suggestion button */}
                  <button
                    type="button"
                    onClick={() => { setShowSuggestion(s => !s); setSuggestionNote(''); setSuggestionSaved(false); }}
                    className={`p-1.5 rounded-lg border transition active:scale-95 ${showSuggestion ? 'bg-amber-500 border-amber-500 text-white' : 'bg-amber-50 border-amber-200 text-amber-500'}`}
                    title="Suggestion — MCQ improve karein"
                  >
                    <Lightbulb size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFlipped(false); stopSpeech(); setSpeaking(false); }}
                    className="bg-white border border-slate-200 text-slate-600 text-[10px] font-black px-2.5 py-1.5 rounded-lg active:scale-95"
                  >
                    ← Question
                  </button>
                </div>
              </div>

              {/* 💡 Suggestion Panel */}
              {showSuggestion && (
                <div className="mb-3 bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb size={13} className="text-amber-600" />
                      <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Suggestion Mode</span>
                    </div>
                    <button type="button" onClick={() => setShowSuggestion(false)} className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-[10px] font-black active:scale-90">✕</button>
                  </div>
                  {/* Current MCQ context */}
                  <div className="bg-white rounded-xl p-2.5 border border-amber-200">
                    <p className="text-[9px] font-black text-amber-700 uppercase mb-1">Yeh MCQ:</p>
                    <p className="text-[10px] text-slate-700 font-bold leading-snug mb-1">{activeQ!.question}</p>
                    <p className="text-[9px] text-emerald-700 font-black">Answer: {activeQ!.options?.[activeQ!.correctAnswer] || '—'}</p>
                  </div>
                  {/* Self-test questions for MCQ */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-amber-700 uppercase">🧠 MCQ Self-Check:</p>
                    {[
                      'Kya yeh answer 100% sahi hai? Apni book se verify karo.',
                      'Agar yeh answer galat laga to admin ko flag karo.',
                      'Is topic se related aur kaunse questions ho sakte hain?',
                    ].map((q, qi) => (
                      <div key={qi} className="flex items-start gap-1.5 bg-white/70 rounded-lg p-1.5 border border-amber-100">
                        <span className="text-[9px] font-black text-amber-600 shrink-0 mt-0.5">Q{qi+1}</span>
                        <p className="text-[9px] text-amber-800 leading-tight">{q}</p>
                      </div>
                    ))}
                  </div>
                  {/* Flag wrong answer */}
                  {suggestionSaved ? (
                    <div className="bg-emerald-100 border border-emerald-300 rounded-xl p-2 text-center">
                      <p className="text-[10px] font-black text-emerald-700">✅ Suggestion save ho gaya! Admin review karega.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-red-600 uppercase">⚠️ Answer galat lagta hai? Suggestion do:</p>
                      <textarea
                        value={suggestionNote}
                        onChange={e => setSuggestionNote(e.target.value)}
                        placeholder="Sahi answer kya hona chahiye? Ya koi correction..."
                        className="w-full p-2 border border-red-200 rounded-xl text-[10px] outline-none min-h-[50px] resize-none focus:border-red-400 bg-white"
                      />
                      <button
                        type="button"
                        disabled={!suggestionNote.trim()}
                        onClick={async () => {
                          if (!suggestionNote.trim()) return;
                          const key = 'nst_mcq_suggestions';
                          try {
                            const existing = JSON.parse(localStorage.getItem(key) || '[]');
                            existing.unshift({ question: activeQ!.question, currentAnswer: activeQ!.options?.[activeQ!.correctAnswer], suggestion: suggestionNote.trim(), savedAt: new Date().toISOString() });
                            localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
                          } catch {}
                          try {
                            await saveSuggestion({
                              id: `mcq_${Date.now()}`,
                              text: `MCQ: "${stripHtml(activeQ!.question).substring(0, 100)}" | Sahi Jawab: ${activeQ!.options?.[activeQ!.correctAnswer] || '—'} | Correction: ${suggestionNote.trim()}`,
                              uid: user?.id || 'anonymous',
                              userName: user?.name || user?.email?.split('@')[0] || 'Student',
                              userBoard: (user as any)?.board || '',
                              createdAt: new Date().toISOString(),
                              mode: 'mcq',
                              lessonTitle: sourceMeta?.lessonTitle || title,
                              subject: sourceMeta?.subject || subject,
                              classLevel: sourceMeta?.classLevel,
                              chapterKey: sourceKey || '',
                              mcqId: (activeQ as any)?.id || '',
                              mcqQuestion: stripHtml(activeQ!.question).substring(0, 200),
                              mcqOptions: activeQ!.options || [],
                              mcqCurrentAnswer: activeQ!.correctAnswer ?? -1,
                            });
                          } catch {}
                          setSuggestionSaved(true);
                        }}
                        className="w-full py-2 bg-red-500 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-40"
                      >
                        <Edit2 size={11} /> Flag as Incorrect & Save Suggestion
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white border-2 border-emerald-300 rounded-2xl p-4 mb-3">
                <div className="text-base font-black text-emerald-900 leading-snug"
                  dangerouslySetInnerHTML={{ __html: renderMathInHtml(activeQ!.options?.[activeQ!.correctAnswer] || '—') }}
                />
              </div>

              {activeQ!.explanation && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 mb-1">Explanation</p>
                  <div className="text-sm text-blue-900 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatExplanationHtml(activeQ!.explanation) }} />
                </div>
              )}
              {activeQ!.concept && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1">Concept</p>
                  <div className="text-sm text-purple-900 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMathInHtml(activeQ!.concept) }} />
                </div>
              )}
              {activeQ!.examTip && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">Exam Tip</p>
                  <div className="text-sm text-amber-900 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMathInHtml(activeQ!.examTip) }} />
                </div>
              )}
              {activeQ!.mnemonic && (
                <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-pink-700 mb-1">Memory Trick</p>
                  <div className="text-sm text-pink-900 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMathInHtml(activeQ!.mnemonic) }} />
                </div>
              )}

              {/* ── Confidence Level Buttons (main session only) ── */}
              {!hardReviewMode && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 text-center">
                    How difficult was this card?
                  </p>
                  {confidenceMap[pos] ? (
                    <div className={`text-center py-2 rounded-xl font-black text-sm ${
                      confidenceMap[pos] === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                      confidenceMap[pos] === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {confidenceMap[pos] === 'easy' ? '✅ Easy — Moving forward!' :
                       confidenceMap[pos] === 'medium' ? '🟡 Medium — Practice a bit more' :
                       '🔴 Hard — Will come back later!'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfidence('easy')}
                        className="py-2.5 rounded-xl bg-emerald-500 text-white font-black text-xs active:scale-95 transition shadow-md flex flex-col items-center gap-0.5"
                      >
                        <span className="text-base">✅</span>
                        <span>Easy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfidence('medium')}
                        className="py-2.5 rounded-xl bg-amber-500 text-white font-black text-xs active:scale-95 transition shadow-md flex flex-col items-center gap-0.5"
                      >
                        <span className="text-base">🟡</span>
                        <span>Medium</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfidence('hard')}
                        className="py-2.5 rounded-xl bg-red-500 text-white font-black text-xs active:scale-95 transition shadow-md flex flex-col items-center gap-0.5"
                      >
                        <span className="text-base">🔴</span>
                        <span>Hard</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>}

        {/* Navigation — forward only; card navigation does not show a Back button */}
        <div className="flex items-center gap-3 w-full max-w-md mx-auto">
          <button
            onClick={hardReviewMode ? goNextHard : goNext}
            className={`w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl font-black text-sm active:scale-95 transition shadow-lg ${
              hardReviewMode
                ? 'bg-red-400 text-white hover:bg-red-300'
                : 'bg-white text-indigo-900 hover:bg-white/90'
            }`}
          >
            {hardReviewMode
              ? hardReviewPos >= hardQueue.length - 1
                ? (<><RotateCw size={14} /> Naye Cards</>)
                : (<>Next <ChevronRight size={16} /></>)
              : isLast
                ? (<><RotateCw size={14} /> Naye Cards</>)
                : (<>Next <ChevronRight size={16} /></>)
            }
          </button>
        </div>
      </div>
    </div>

      {/* ── Projector Mode Overlay (Mature Classroom / TV Presentation Engine) ── */}
      {isProjectorMode && questions.length > 0 && (() => {
        const pq = questions[projectorQIndex] ?? null;
        if (!pq) return null;
        const total = questions.length;
        const projectorCurrentSelection = projectorSelections[projectorQIndex] ?? null;

        const isThemeDark = projectorTheme === 'dark';
        const isThemeSepia = projectorTheme === 'sepia';

        const canvasBg = isThemeDark ? '#090d16' : isThemeSepia ? '#fbf8f2' : '#f8fafc';
        const headerBg = isThemeDark ? '#0f172a' : isThemeSepia ? '#fefce8' : '#ffffff';
        const headerBorder = isThemeDark ? '#1e293b' : isThemeSepia ? '#fde68a' : '#e2e8f0';
        const headerText = isThemeDark ? '#f8fafc' : isThemeSepia ? '#451a03' : '#0f172a';
        const headerSubtext = isThemeDark ? '#94a3b8' : isThemeSepia ? '#92400e' : '#64748b';
        const pillBg = isThemeDark ? '#1e293b' : isThemeSepia ? '#fef3c7' : '#f1f5f9';
        const pillBorder = isThemeDark ? '#334155' : isThemeSepia ? '#fde68a' : '#e2e8f0';
        const pillText = isThemeDark ? '#e2e8f0' : isThemeSepia ? '#78350f' : '#334155';
        const footerBg = isThemeDark ? '#0f172a' : isThemeSepia ? '#fefce8' : '#ffffff';
        const footerBorder = isThemeDark ? '#1e293b' : isThemeSepia ? '#fde68a' : '#e2e8f0';

        const totalTimerSec = drillTimerMode === '30s' ? 30 : drillTimerMode === '45s' ? 45 : drillTimerMode === '60s' ? 60 : 0;
        const timerProgressPercent = totalTimerSec > 0 ? (drillTimeRemaining / totalTimerSec) * 100 : 0;
        const timerColor = drillTimeRemaining <= 5 ? '#ef4444' : drillTimeRemaining <= 15 ? '#f59e0b' : '#10b981';

        const cycleTimerMode = () => {
          const modes: TimerMode[] = ['off', '30s', '45s', '60s', 'stopwatch'];
          const nextIdx = (modes.indexOf(drillTimerMode) + 1) % modes.length;
          setDrillTimerMode(modes[nextIdx]);
          playSoundClick();
        };

        const cycleTheme = () => {
          const nextTheme: 'light' | 'dark' | 'sepia' =
            projectorTheme === 'dark' ? 'light' : projectorTheme === 'light' ? 'sepia' : 'dark';
          handleSetProjectorTheme(nextTheme);
          playSoundClick();
        };

        const overlayStyle: React.CSSProperties = {
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: canvasBg,
          color: headerText,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'background 0.25s, color 0.25s',
        };

        const submitThreshold = 1;
        const canSubmit = projectorAnswered.size >= submitThreshold;

        return createPortal(
          <div style={overlayStyle}>
            {!projectorFocused && tabBar}

            {/* Standard Comprehensive Top Bar (Hidden only in full focus mode) */}
            {!projectorFocused && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', borderBottom:`1px solid ${headerBorder}`, background:headerBg, flexShrink:0, boxShadow:'0 1px 6px rgba(0,0,0,0.06)', zIndex:20 }}>
                {/* Back Button */}
                <button
                  onClick={() => {
                    stopSpeech();
                    if (onBack && tabBar) {
                      onBack();
                    } else if (startInProjectorMode) {
                      handleBack();
                    } else {
                      setIsProjectorMode(false);
                      setProjectorRotated(false);
                      onProjectorModeChange?.(false);
                    }
                  }}
                  style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, background:pillBg, border:`1px solid ${pillBorder}`, borderRadius:10, color:pillText, cursor:'pointer' }}
                  title="Back"
                  aria-label="Back"
                >
                  <ChevronLeft size={18} />
                </button>

                {/* Title and Projector Badge */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:900, color:headerText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.2 }}>
                    {sourceMeta?.lessonTitle || title || 'MCQ Practice'}
                  </div>
                  <div style={{ fontSize:10, fontWeight:800, color: isThemeDark ? '#fbbf24' : '#d97706', textTransform:'uppercase', letterSpacing:'0.05em', lineHeight:1.2, display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                    <Tv size={11} /> <span>PREMIUM MCQ • PROJECTOR</span>
                  </div>
                </div>

                {/* Live Accuracy HUD */}
                <div className="hidden md:flex" style={{ flexShrink:0, alignItems:'center', gap:6, background:pillBg, border:`1px solid ${pillBorder}`, borderRadius:12, padding:'5px 10px', fontSize:11, fontWeight:800 }}>
                  <span style={{ color:'#10b981' }}>✓ {projectorCorrect}</span>
                  <span style={{ color:headerSubtext }}>·</span>
                  <span style={{ color:'#ef4444' }}>✗ {projectorWrong}</span>
                  {projectorAnswered.size > 0 && (
                    <>
                      <span style={{ color:headerSubtext }}>·</span>
                      <span style={{ color:headerText }}>{Math.round((projectorCorrect / projectorAnswered.size) * 100)}%</span>
                    </>
                  )}
                </div>

                {/* Question Counter Pill */}
                <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:4, background:pillBg, border:`1px solid ${pillBorder}`, borderRadius:12, padding:'6px 10px' }}>
                  <span style={{ fontSize:12, fontWeight:900, color:headerText }}>{projectorQIndex + 1}</span>
                  <span style={{ fontSize:10, color:headerSubtext, fontWeight:700 }}>/ {total}</span>
                </div>

                {/* Drill Timer Toggle */}
                <button
                  onClick={cycleTimerMode}
                  title="Classroom Drill Timer: Off / 30s / 45s / 60s / Stopwatch"
                  aria-label="Classroom Drill Timer"
                  style={{
                    flexShrink:0,
                    height:36,
                    padding:'0 10px',
                    background: drillTimerMode !== 'off' ? (isThemeDark ? '#1e1b4b' : '#eef2ff') : pillBg,
                    border: `1px solid ${drillTimerMode !== 'off' ? '#818cf8' : pillBorder}`,
                    borderRadius:12,
                    color: drillTimerMode !== 'off' ? '#6366f1' : pillText,
                    fontSize:11,
                    fontWeight:900,
                    cursor:'pointer',
                    display:'flex',
                    alignItems:'center',
                    gap:5,
                  }}
                >
                  <Timer size={14} className={drillTimeRemaining <= 5 && drillTimerMode !== 'stopwatch' && drillTimerMode !== 'off' ? 'animate-pulse text-red-500' : ''} />
                  <span className="hidden sm:inline">
                    {drillTimerMode === 'off' ? 'Timer' : drillTimerMode === 'stopwatch' ? `${drillStopwatchSec}s` : `${drillTimeRemaining}s`}
                  </span>
                </button>

                {/* Teacher Reveal Answer Toggle */}
                <button
                  onClick={() => { setProjectorReveal(r => !r); playSoundClick(); }}
                  title="Teacher Answer Key: Show/Hide Answer & Explanation without selecting"
                  aria-label="Reveal Answer Key"
                  style={{
                    flexShrink:0,
                    height:36,
                    padding:'0 10px',
                    background: projectorReveal ? (isThemeDark ? '#064e3b' : '#dcfce7') : pillBg,
                    border: `1px solid ${projectorReveal ? '#10b981' : pillBorder}`,
                    borderRadius:12,
                    color: projectorReveal ? '#10b981' : pillText,
                    fontSize:11,
                    fontWeight:900,
                    cursor:'pointer',
                    display:'flex',
                    alignItems:'center',
                    gap:5,
                  }}
                >
                  {projectorReveal ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span className="hidden sm:inline">{projectorReveal ? 'Hide Ans' : 'Show Ans'}</span>
                </button>

                {/* Theme Switcher Button */}
                <button
                  onClick={cycleTheme}
                  title={`Current Theme: ${projectorTheme.toUpperCase()}. Click to switch.`}
                  aria-label="Toggle Projector Theme"
                  style={{
                    flexShrink:0,
                    height:36,
                    padding:'0 10px',
                    background: pillBg,
                    border: `1px solid ${pillBorder}`,
                    borderRadius:12,
                    color: pillText,
                    fontSize:11,
                    fontWeight:800,
                    cursor:'pointer',
                    display:'flex',
                    alignItems:'center',
                    gap:5,
                  }}
                >
                  {isThemeDark ? <Moon size={14} /> : isThemeSepia ? <Scroll size={14} /> : <Sun size={14} />}
                  <span className="hidden xl:inline">{isThemeDark ? 'Dark Board' : isThemeSepia ? 'Warm Sepia' : 'Daylight'}</span>
                </button>

                {/* Sound Toggle */}
                <button
                  onClick={handleToggleSound}
                  title={soundActive ? 'Sound Effects Enabled (Click to Mute)' : 'Sound Effects Muted (Click to Enable)'}
                  aria-label="Toggle Sound"
                  style={{
                    flexShrink:0,
                    width:36,
                    height:36,
                    background: pillBg,
                    border: `1px solid ${pillBorder}`,
                    borderRadius:12,
                    color: soundActive ? '#10b981' : '#94a3b8',
                    cursor:'pointer',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                  }}
                >
                  {soundActive ? <Volume2 size={15} /> : <VolumeX size={15} />}
                </button>

                {/* Font Size Adjusters */}
                <div style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0 }}>
                  <button
                    onClick={() => changeProjFont(-1)}
                    disabled={projectorFontIdx === 0}
                    title="Font Chhota Karo"
                    style={{ padding:'6px 8px', background:pillBg, border:`1px solid ${pillBorder}`, borderRadius:'10px 0 0 10px', color: projectorFontIdx === 0 ? '#94a3b8' : pillText, fontSize:12, fontWeight:900, cursor: projectorFontIdx === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    A−
                  </button>
                  <button
                    onClick={() => changeProjFont(1)}
                    disabled={projectorFontIdx === PROJ_FONT_SIZES.length - 1}
                    title="Font Bada Karo"
                    style={{ padding:'6px 8px', background:pillBg, border:`1px solid ${pillBorder}`, borderRadius:'0 10px 10px 0', color: projectorFontIdx === PROJ_FONT_SIZES.length - 1 ? '#94a3b8' : pillText, fontSize:12, fontWeight:900, cursor: projectorFontIdx === PROJ_FONT_SIZES.length - 1 ? 'not-allowed' : 'pointer' }}
                  >
                    A+
                  </button>
                </div>

                {/* Rotate Screen */}
                <button
                  onClick={async () => {
                    const result = await rotateScreen();
                    if (result !== null) { setProjectorRotated(result === 'landscape'); }
                    else { alert('📱 Phone ko physically rotate karein — landscape ke liye sideways, portrait ke liye seedha.'); }
                  }}
                  title={projectorRotated ? 'Portrait mode' : 'Landscape mode'}
                  aria-label={projectorRotated ? 'Portrait mode' : 'Landscape mode'}
                  style={{ flexShrink:0, width:36, height:36, background: projectorRotated ? (isThemeDark ? '#3b0764' : '#ede9fe') : pillBg, border: `1px solid ${projectorRotated ? '#a855f7' : pillBorder}`, borderRadius:12, color: projectorRotated ? '#a855f7' : pillText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                >
                  <RotateCw size={14} />
                </button>

                {/* Question Navigator (9-dot grid) */}
                <button
                  onClick={() => { setProjectorNavigatorOpen(open => !open); playSoundClick(); }}
                  title="Question Palette & Navigator"
                  aria-label="Question Palette"
                  style={{ flexShrink:0, width:36, height:36, background: projectorNavigatorOpen ? '#6366f1' : pillBg, border: `1px solid ${projectorNavigatorOpen ? '#4f46e5' : pillBorder}`, borderRadius:12, color: projectorNavigatorOpen ? '#ffffff' : pillText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                >
                  <LayoutGrid size={16} />
                </button>

                {/* Keyboard Shortcuts Help Button */}
                <button
                  onClick={() => { setShowShortcutsModal(true); playSoundClick(); }}
                  title="Remote & Keyboard Shortcuts (?)"
                  aria-label="Keyboard Shortcuts"
                  style={{ flexShrink:0, width:36, height:36, background:pillBg, border:`1px solid ${pillBorder}`, borderRadius:12, color:pillText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                >
                  <HelpCircle size={15} />
                </button>

                {/* Fullscreen / Focus Mode */}
                <button
                  onClick={toggleProjectorNativeFullscreen}
                  title="Native Fullscreen (F)"
                  aria-label="Native Fullscreen"
                  style={{ flexShrink:0, width:36, height:36, background: isThemeDark ? '#064e3b' : '#f0fdf4', border: '1px solid #10b981', borderRadius:12, color:'#10b981', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                >
                  <Maximize2 size={16} />
                </button>

                {/* Hide Bars / Focus Mode */}
                <button
                  onClick={() => setProjectorFocused(true)}
                  title="Hide Bars • Focus Mode"
                  aria-label="Hide Bars"
                  style={{ flexShrink:0, width:36, height:36, background: pillBg, border: `1px solid ${pillBorder}`, borderRadius:12, color: pillText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                >
                  <EyeOff size={15} />
                </button>

                {/* Live Class Room */}
                {onOpenGroupStudy && (
                  <button
                    onClick={onOpenGroupStudy}
                    title="Live Class Room"
                    aria-label="Live Class Room"
                    style={{ flexShrink:0, height:36, padding:'0 10px', background:'#fdf2f8', border:'1.5px solid #f472b6', borderRadius:12, color:'#db2777', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontWeight:900, fontSize:11 }}
                  >
                    <Radio size={14} className="animate-pulse text-pink-600" />
                    <span>LIVE</span>
                  </button>
                )}
              </div>
            )}

            {/* Drill Timer Animated Countdown Bar */}
            {!projectorFocused && drillTimerMode !== 'off' && drillTimerMode !== 'stopwatch' && (
              <div style={{ height:4, width:'100%', background: isThemeDark ? '#1e293b' : '#e2e8f0', overflow:'hidden', flexShrink:0 }}>
                <div style={{ height:'100%', width:`${timerProgressPercent}%`, background:timerColor, transition:'width 1s linear, background 0.3s' }} />
              </div>
            )}

            {/* Scrollable Content: MCQ Practice Card scaled & themed */}
            <div style={{ flex:1, overflowY:'auto', padding: projectorFocused ? '24px' : '20px 24px 16px', minHeight:0 }}>
              <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                {projectorNavigatorOpen && (
                  <div style={projectorFocused
                    ? { position:'absolute', top:58, right:12, zIndex:40, width:'min(380px, calc(100% - 24px))', padding:12, background:headerBg, border:`1px solid ${pillBorder}`, borderRadius:16, boxShadow:'0 16px 40px rgba(0,0,0,0.3)' }
                    : { marginBottom:16 }}>
                    <McqQuestionNavigator
                      total={total}
                      currentIndex={projectorQIndex}
                      answers={projectorSelections}
                      skipped={projectorSkipped}
                      bookmarked={projectorBookmarked}
                      themeMode={projectorTheme}
                      onJump={(index) => {
                        setProjectorQIndex(index);
                        setProjectorReveal(false);
                        setProjectorSelected(projectorSelections[index] ?? null);
                        setProjectorNavigatorOpen(false);
                        playSoundClick();
                      }}
                    />
                  </div>
                )}

                <McqPracticeCard
                  q={pq}
                  questionNumber={pq.questionNumber ?? projectorQIndex + 1}
                  selectedOption={projectorCurrentSelection}
                  answered={projectorCurrentSelection !== null || projectorReveal}
                  showResult={projectorCurrentSelection !== null || projectorReveal}
                  variant="projector"
                  fontSize={projectorFontSize}
                  themeMode={projectorTheme}
                  isBookmarked={projectorBookmarked.has(projectorQIndex)}
                  onToggleBookmark={() => toggleBookmark(projectorQIndex)}
                  eliminatedOptions={projectorEliminated[projectorQIndex]}
                  onToggleEliminate={(oi) => toggleEliminateOption(projectorQIndex, oi)}
                  showEliminateTool={showEliminateTool}
                  onSelect={handleProjectorOptionSelect}
                />
              </div>

              {/* Comprehensive Teacher / Student Explanation */}
              {(projectorCurrentSelection !== null || projectorReveal) && pq.explanation && (
                <div style={{
                  maxWidth: 1200,
                  margin: '18px auto 0',
                  background: isThemeDark ? '#0f1d32' : isThemeSepia ? '#fef3c7' : '#fefce8',
                  border: `2px solid ${isThemeDark ? '#0284c7' : isThemeSepia ? '#f59e0b' : '#fde047'}`,
                  borderRadius: 16,
                  padding: '16px 20px',
                  fontSize: projectorFontSize,
                  color: isThemeDark ? '#e0f2fe' : isThemeSepia ? '#78350f' : '#713f12',
                  lineHeight: 1.55,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, fontWeight:900, color: isThemeDark ? '#38bdf8' : isThemeSepia ? '#b45309' : '#a16207' }}>
                    <Lightbulb size={18} />
                    <span>Solution & Explanation:</span>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: formatExplanationHtml(pq.explanation) }} />
                </div>
              )}
            </div>

            {/* Standard Bottom Navigation Bar (Hidden in focus mode) */}
            {!projectorFocused && (
              <div style={{ display:'flex', alignItems:'center', padding:'10px 12px', borderTop:`2px solid ${footerBorder}`, background:footerBg, flexShrink:0, gap:8 }}>
                {/* Prev Question */}
                <button
                  onClick={() => {
                    const index = Math.max(0, projectorQIndex - 1);
                    setProjectorQIndex(index);
                    setProjectorReveal(false);
                    setProjectorSelected(projectorSelections[index] ?? null);
                    playSoundClick();
                  }}
                  disabled={projectorQIndex === 0}
                  style={{
                    height: 42,
                    background: projectorQIndex === 0 ? (isThemeDark ? '#1e293b' : '#e2e8f0') : '#3b82f6',
                    color: projectorQIndex === 0 ? (isThemeDark ? '#64748b' : '#94a3b8') : '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '0 14px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: projectorQIndex === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    flexShrink: 0
                  }}
                >
                  <ChevronLeft size={16} /> Prev
                </button>

                {/* Skip Question */}
                <button
                  onClick={() => {
                    if (projectorQIndex < total - 1) {
                      setProjectorSkipped(prev => new Set([...prev, projectorQIndex]));
                      const index = projectorQIndex + 1;
                      setProjectorQIndex(index);
                      setProjectorReveal(false);
                      setProjectorSelected(projectorSelections[index] ?? null);
                      playSoundClick();
                    }
                  }}
                  disabled={projectorShowReview || (projectorQIndex === total - 1 && projectorCurrentSelection !== null)}
                  style={{
                    height: 42,
                    background: isThemeDark ? '#1e293b' : '#fffbeb',
                    color: isThemeDark ? '#fbbf24' : '#b45309',
                    border: `1px solid ${isThemeDark ? '#334155' : '#fcd34d'}`,
                    borderRadius: 12,
                    padding: '0 12px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  Skip
                </button>

                {/* Submit Quiz or Progress */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {canSubmit ? (
                    <button
                      onClick={submitProjectorQuiz}
                      style={{
                        width: '100%',
                        height: 42,
                        background: 'linear-gradient(135deg,#10b981,#059669)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '0 10px',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 16px rgba(16,185,129,0.35)'
                      }}
                    >
                      <CheckCircle size={15} /> Submit ({projectorAnswered.size}/{total})
                    </button>
                  ) : (
                    <div style={{ width: '100%', height: 42, display:'flex', flexDirection:'column', alignItems:'center', justifyContent: 'center', gap:3 }}>
                      <div style={{ width:'100%', height:6, background:pillBg, borderRadius:99, overflow:'hidden', border:`1px solid ${pillBorder}` }}>
                        <div style={{ height:'100%', background:'#3b82f6', borderRadius:99, width:`${(projectorAnswered.size / submitThreshold) * 100}%`, transition:'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, color:headerSubtext, whiteSpace: 'nowrap' }}>{projectorAnswered.size}/{submitThreshold} to Submit</span>
                    </div>
                  )}
                </div>

                {/* Next Question */}
                <button
                  onClick={() => {
                    const index = Math.min(total - 1, projectorQIndex + 1);
                    setProjectorQIndex(index);
                    setProjectorReveal(false);
                    setProjectorSelected(projectorSelections[index] ?? null);
                    playSoundClick();
                  }}
                  disabled={projectorQIndex === total - 1}
                  style={{
                    height: 42,
                    background: projectorQIndex === total - 1 ? (isThemeDark ? '#1e293b' : '#e2e8f0') : '#3b82f6',
                    color: projectorQIndex === total - 1 ? (isThemeDark ? '#64748b' : '#94a3b8') : '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '0 14px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: projectorQIndex === total - 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    flexShrink: 0
                  }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* App Bottom Navigation Bar (Visible in projector mode, hidden in focus mode) */}
            {!projectorFocused && bottomNav && (
              <div style={{ zIndex: 25, flexShrink: 0, width: '100%' }}>
                {bottomNav}
              </div>
            )}

            {/* Focus Mode Floating Bottom Bar */}
            {projectorFocused && (
              <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:12, zIndex:20 }}>
                <button
                  onClick={() => {
                    const index = Math.max(0, projectorQIndex - 1);
                    setProjectorQIndex(index);
                    setProjectorReveal(false);
                    setProjectorSelected(projectorSelections[index] ?? null);
                    playSoundClick();
                  }}
                  disabled={projectorQIndex === 0}
                  style={{ background: projectorQIndex===0 ? 'rgba(30,41,59,0.4)' : 'rgba(30,41,59,0.85)', color: projectorQIndex===0 ? 'rgba(255,255,255,0.3)' : '#fff', border:'none', borderRadius:12, padding:'11px 22px', fontSize:14, fontWeight:900, cursor: projectorQIndex===0 ? 'not-allowed' : 'pointer', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', gap:6, boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
                  <ChevronLeft size={18} /> Prev
                </button>
                <button
                  onClick={() => setProjectorFocused(false)}
                  style={{ background:'rgba(239,68,68,0.9)', color:'#fff', border:'2px solid #fca5a5', borderRadius:12, padding:'11px 16px', fontSize:14, fontWeight:900, cursor:'pointer', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
                  <Minimize2 size={16} />
                </button>
                {projectorQIndex < total - 1 ? (
                  <button
                    onClick={() => {
                      if (projectorCurrentSelection === null) {
                        setProjectorSkipped(prev => new Set([...prev, projectorQIndex]));
                      }
                      const index = Math.min(total - 1, projectorQIndex + 1);
                      setProjectorQIndex(index);
                      setProjectorReveal(false);
                      setProjectorSelected(projectorSelections[index] ?? null);
                      playSoundClick();
                    }}
                    style={{ background: 'rgba(30,41,59,0.85)', color: '#fff', border:'none', borderRadius:12, padding:'11px 22px', fontSize:14, fontWeight:900, cursor: 'pointer', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', gap:6, boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
                    Next <ChevronRight size={18} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (projectorAnswered.size >= 1) {
                        submitProjectorQuiz();
                      } else {
                        setProjectorFocused(false);
                      }
                    }}
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border:'none', borderRadius:12, padding:'11px 22px', fontSize:14, fontWeight:900, cursor: 'pointer', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', gap:6, boxShadow:'0 8px 24px rgba(16,185,129,0.3)' }}>
                    {projectorAnswered.size >= 1 ? (
                      <><CheckCircle size={18} /> Submit</>
                    ) : (
                      <><Minimize2 size={18} /> Exit</>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Remote & Keyboard Shortcuts Modal Dialog */}
            {showShortcutsModal && (
              <div style={{ position:'fixed', inset:0, zIndex:100001, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                <div style={{ background: isThemeDark ? '#0f172a' : '#ffffff', color: isThemeDark ? '#f8fafc' : '#0f172a', border:`1px solid ${pillBorder}`, borderRadius:20, width:'min(480px, 100%)', padding:'24px', boxShadow:'0 24px 64px rgba(0,0,0,0.4)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Tv size={20} className="text-amber-500" />
                      <h3 style={{ fontSize:17, fontWeight:900 }}>Remote & Keyboard Shortcuts</h3>
                    </div>
                    <button
                      onClick={() => setShowShortcutsModal(false)}
                      style={{ padding:6, background:pillBg, border:`1px solid ${pillBorder}`, borderRadius:10, color:pillText, cursor:'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13 }}>
                    {[
                      { key: '→ / Space', desc: 'Agla Sawal (Next Question)' },
                      { key: '←', desc: 'Pichhla Sawal (Previous Question)' },
                      { key: '1 / 2 / 3 / 4 (or A / B / C / D)', desc: 'Option Chuno (Select Choice)' },
                      { key: 'R', desc: 'Jawab Dikhao / Chhupao (Reveal / Hide Answer)' },
                      { key: 'T', desc: 'Theme Badlo (Dark Board / Daylight / Sepia)' },
                      { key: 'F', desc: 'Fullscreen Mode Toggle' },
                      { key: 'S', desc: 'Sawal Skip Karo' },
                      { key: 'M', desc: 'Sound Mute / Unmute' },
                      { key: '?', desc: 'Ye Shortcuts Guide Box' },
                    ].map((item, idx) => (
                      <div key={idx} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:pillBg, borderRadius:10 }}>
                        <kbd style={{ background: isThemeDark ? '#334155' : '#e2e8f0', color: isThemeDark ? '#f8fafc' : '#0f172a', padding:'3px 8px', borderRadius:6, fontWeight:800, fontSize:12, fontFamily:'monospace' }}>
                          {item.key}
                        </kbd>
                        <span style={{ fontWeight:600, color:headerSubtext }}>{item.desc}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowShortcutsModal(false)}
                    style={{ width:'100%', marginTop:18, background:'#3b82f6', color:'#ffffff', border:'none', borderRadius:12, padding:'11px', fontSize:14, fontWeight:900, cursor:'pointer' }}
                  >
                    Got It (Band Karo)
                  </button>
                </div>
              </div>
            )}

            {/* Draggable NSTA Logo Floating Button — moves anywhere on screen, toggles focus mode (hides/shows top bar & bottom bar) */}
            <DraggableNstaLogoFab
              isActive={projectorFocused}
              onToggle={() => setProjectorFocused(f => !f)}
              appLogo={settings?.appLogo}
              appName={settings?.appShortName || settings?.appName || 'NSTA'}
              title={projectorFocused ? 'बॉटम व टॉप बार दिखाएं • Screen pe move kar sakte hain' : 'बॉटम व टॉप बार छुपाएं • Screen pe move kar sakte hain'}
              defaultPosition={{ bottom: 84, right: 16 }}
              zIndex={100001}
            />
          </div>,
          document.body
        );
      })()}

      {/* ── Projector Review Screen ── shown after Submit */}
      {projectorShowReview && isProjectorMode && reviewSnapshot && createPortal(
        (() => {
          if (user) {
            const analysisAnswers = { ...reviewSnapshot.selections };
            const analysisSubmitted = reviewSnapshot.answered.reduce((acc, qIndex) => {
              acc[qIndex] = true;
              return acc;
            }, {} as Record<number, boolean>);
            return (
              // MarksheetCard has its own z-index, so keep the review in a
              // higher stacking context than the projector overlay (z-index 99999).
              <div style={{ position: 'fixed', inset: 0, zIndex: 100000 }}>
                <McqAnalysisOverlay
                  questions={reviewSnapshot.questions}
                  answers={analysisAnswers}
                  submitted={analysisSubmitted}
                  title={title || 'MCQ Practice'}
                  subtitle={subtitle}
                  subject={subject || 'MCQ Practice'}
                  user={user}
                  settings={settings}
                  onClose={() => setProjectorShowReview(false)}
                  onUpdateUser={onUpdateUser}
                  onRestart={() => {
                    setProjectorQIndex(0);
                    setProjectorReveal(false);
                    setProjectorAnswered(new Set());
                    setProjectorCorrect(0);
                    setProjectorWrong(0);
                    setProjectorSkipped(new Set());
                    setProjectorNavigatorOpen(false);
                    setProjectorSelections({});
                    setProjectorShowReview(false);
                    setIsProjectorMode(true);
                  }}
                />
              </div>
            );
          }
          const _total   = reviewSnapshot.answered.length;
          const _pct     = _total > 0 ? Math.round((projectorCorrect / _total) * 100) : 0;
          const _grade   = _pct >= 80
            ? { label: '🏆 Excellent!',   emoji: '🏆', from:'#10b981', to:'#059669' }
            : _pct >= 60
            ? { label: '👍 Good Job!',    emoji: '⭐', from:'#6366f1', to:'#4f46e5' }
            : _pct >= 40
            ? { label: '💪 Keep Trying!', emoji: '💪', from:'#f59e0b', to:'#d97706' }
            : { label: '📚 Study More',   emoji: '📚', from:'#f43f5e', to:'#e11d48' };
          const _doRestart = () => {
            setProjectorQIndex(0);
            setProjectorReveal(false);
            setProjectorAnswered(new Set());
            setProjectorCorrect(0);
            setProjectorWrong(0);
            setProjectorSkipped(new Set());
            setProjectorNavigatorOpen(false);
            setProjectorSelections({});
            setProjectorShowReview(false);
            setIsProjectorMode(true);
          };
          return (
            <div style={{ position:'fixed', inset:0, zIndex:999999, background:'#f1f5f9', display:'flex', flexDirection:'column', overflow:'hidden' }}>
              {/* ── Header bar ── */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#1e293b', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setProjectorShowReview(false)}
                  style={{ background:'rgba(255,255,255,0.08)', color:'#e2e8f0', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'7px 12px', fontWeight:900, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                  <ChevronLeft size={14} /> Wapas
                </button>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#fbbf24', fontWeight:900, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>📋 Review — {title || 'MCQ'}</div>
                  <div style={{ color:'#94a3b8', fontSize:10, fontWeight:700, marginTop:1 }}>
                    Score: <span style={{ color:'#4ade80' }}>{projectorCorrect} सही</span> · <span style={{ color:'#f87171' }}>{projectorWrong} गलत</span> · कुल {_total} Questions
                  </div>
                </div>
                <div style={{ background: _pct >= 70 ? '#15803d' : _pct >= 40 ? '#b45309' : '#9f1239', color:'#fff', borderRadius:10, padding:'7px 13px', fontWeight:900, fontSize:15, flexShrink:0 }}>
                  {_pct}%
                </div>
                <button onClick={() => { setProjectorShowReview(false); setIsProjectorMode(false); setProjectorRotated(false); }}
                  style={{ background:'#ef4444', color:'#fff', border:'none', borderRadius:10, padding:'7px 12px', fontWeight:900, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                  <X size={13} /> Done
                </button>
              </div>

              {/* ── Scrollable body ── */}
              <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'12px 12px 32px', WebkitOverflowScrolling:'touch' } as React.CSSProperties}>

                {/* Result summary card */}
                <div style={{ background:'#fff', borderRadius:18, padding:'20px 16px', marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.08)', textAlign:'center' }}>
                  <div style={{ width:56, height:56, borderRadius:999, background:`linear-gradient(135deg, ${_grade.from}, ${_grade.to})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 10px', boxShadow:`0 4px 14px ${_grade.from}55` }}>{_grade.emoji}</div>
                  <p style={{ fontSize:16, fontWeight:900, color:'#1e293b', marginBottom:2 }}>{_grade.label}</p>
                  <p style={{ fontSize:36, fontWeight:900, color:'#0f172a', marginBottom:2, lineHeight:1 }}>{_pct}%</p>
                  <p style={{ fontSize:11, color:'#64748b', marginBottom:14 }}>You got {projectorCorrect} correct out of {_total}</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                    <div style={{ background:'#f8fafc', borderRadius:12, padding:'8px 4px' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>Tried</div>
                      <div style={{ fontSize:20, fontWeight:900, color:'#1e293b' }}>{_total}</div>
                    </div>
                    <div style={{ background:'#f0fdf4', borderRadius:12, padding:'8px 4px' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#16a34a', textTransform:'uppercase', marginBottom:2 }}>✅ Correct</div>
                      <div style={{ fontSize:20, fontWeight:900, color:'#15803d' }}>{projectorCorrect}</div>
                    </div>
                    <div style={{ background:'#fff1f2', borderRadius:12, padding:'8px 4px' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#e11d48', textTransform:'uppercase', marginBottom:2 }}>❌ Wrong</div>
                      <div style={{ fontSize:20, fontWeight:900, color:'#be123c' }}>{projectorWrong}</div>
                    </div>
                  </div>
                  {projectorWrong > 0 && (
                    <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:10, padding:'8px 12px', marginBottom:14, fontSize:11, color:'#be123c', fontWeight:700 }}>
                      ⚠️ {projectorWrong} wrong answers saved to "My Mistake"!
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setProjectorShowReview(false)}
                      style={{ flex:1, padding:'11px', borderRadius:14, background:'#f1f5f9', color:'#475569', fontWeight:900, fontSize:13, border:'none', cursor:'pointer' }}>
                      ▶ Continue
                    </button>
                    <button onClick={_doRestart}
                      style={{ flex:1, padding:'11px', borderRadius:14, background:'linear-gradient(135deg, #6366f1, #8b5cf6)', color:'#fff', fontWeight:900, fontSize:13, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow:'0 3px 10px rgba(99,102,241,0.4)' }}>
                      <RefreshCw size={13} /> Restart
                    </button>
                  </div>
                </div>

                {/* Section header */}
                <p style={{ fontSize:11, fontWeight:900, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>📋 Answer Review ({_total} Questions)</p>

                {/* Question cards */}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {reviewSnapshot.answered.map((qIdx, listIdx) => {
                    const rq = reviewSnapshot.questions[qIdx];
                    if (!rq) return null;
                    const selectedOpt = reviewSnapshot.selections[qIdx];
                    const wasCorrect  = selectedOpt === rq.correctAnswer;
                    const OPT_LETTERS = ['A','B','C','D','E'];
                    return (
                      <div key={qIdx} style={{ background:'#fff', border: wasCorrect ? '2px solid #bbf7d0' : '2px solid #fecaca', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                        {/* Q badge + question + TTS */}
                        <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px 10px' }}>
                          <span style={{
                            fontSize:10, fontWeight:900, padding:'3px 8px', borderRadius:999, flexShrink:0, marginTop:2,
                            background: wasCorrect ? '#dcfce7' : '#fee2e2',
                            color: wasCorrect ? '#15803d' : '#b91c1c',
                          }}>Q{listIdx + 1} {wasCorrect ? '✅' : '❌'}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <McqQuestionDisplay
                              q={rq}
                              questionClassName="text-[13px] font-bold text-slate-800 leading-snug"
                              variant="default"
                              stmtClassName="bg-indigo-50 border-l-4 border-indigo-400 px-3 py-2 rounded-lg text-slate-800 font-semibold leading-snug text-[12px] mt-1"
                              showOptions={false}
                            />
                          </div>
                          {/* TTS button */}
                          <button
                            onClick={() => {
                              if (speaking) { stopSpeech(); setSpeaking(false); return; }
                              const _stmts = (rq.statements || []).join(' ');
                              const _opts  = (rq.options || []).map((o: string, oi: number) => `Option ${OPT_LETTERS[oi]}: ${o}`).join('. ');
                              const _exp   = rq.explanation ? `Explanation: ${rq.explanation.replace(/<[^>]+>/g, '')}` : '';
                              speakText([rq.question, _stmts, _opts, _exp].filter(Boolean).join(' '), null, 1.0, 'hi-IN', () => setSpeaking(true), () => setSpeaking(false))
                                .catch(() => setSpeaking(false));
                            }}
                            style={{ flexShrink:0, width:28, height:28, borderRadius:999, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background: speaking ? '#fee2e2' : '#f1f5f9', color: speaking ? '#ef4444' : '#94a3b8', marginTop:1 }}
                          >
                            {speaking ? <Square size={10} style={{ fill:'currentColor' } as React.CSSProperties} /> : <Volume2 size={12} />}
                          </button>
                        </div>
                        {/* Options */}
                        <div style={{ padding:'4px 12px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                          {(rq.options || []).map((opt: string, oi: number) => {
                            const isCorrectOpt  = oi === rq.correctAnswer;
                            const isSelectedOpt = oi === selectedOpt;
                            let bg = '#f8fafc', border = '1.5px solid #e2e8f0', textColor = '#64748b', dotBg = '#e2e8f0', dotColor = '#64748b', strike = false;
                            if (isCorrectOpt)                  { bg = '#f0fdf4'; border = '1.5px solid #86efac'; textColor = '#15803d'; dotBg = '#16a34a'; dotColor = '#fff'; }
                            if (isSelectedOpt && !isCorrectOpt){ bg = '#fff1f2'; border = '1.5px solid #fca5a5'; textColor = '#991b1b'; dotBg = '#ef4444'; dotColor = '#fff'; strike = true; }
                            return (
                              <div key={oi} style={{ display:'flex', alignItems:'center', gap:8, background:bg, border, borderRadius:10, padding:'9px 12px' }}>
                                <span style={{ background:dotBg, color:dotColor, borderRadius:999, minWidth:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, flexShrink:0 }}>{OPT_LETTERS[oi]}</span>
                                <div style={{ fontSize:12, fontWeight: isCorrectOpt || isSelectedOpt ? 700 : 500, color:textColor, lineHeight:1.4, flex:1, textDecoration: strike ? 'line-through' : 'none' }}
                                  dangerouslySetInnerHTML={{ __html: renderMathInHtml(typeof opt === 'string' ? opt : String(opt || '')) }} />
                                {isCorrectOpt  && <CheckCircle size={16} color="#16a34a" style={{ flexShrink:0 }} />}
                                {isSelectedOpt && !isCorrectOpt && <span style={{ fontSize:15, flexShrink:0, color:'#ef4444' }}>✗</span>}
                              </div>
                            );
                          })}
                        </div>
                        {/* Explanation */}
                        {rq.explanation && (
                          <div style={{ margin:'0 12px 12px', background:'#fefce8', border:'1.5px solid #fef08a', borderRadius:10, padding:'9px 12px', fontSize:12, color:'#713f12', lineHeight:1.5 }}>
                            💡 <strong>Explanation:</strong>{' '}
                            <span dangerouslySetInnerHTML={{ __html: formatExplanationHtml(rq.explanation) }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </>
  );
};
