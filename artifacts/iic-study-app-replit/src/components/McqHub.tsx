import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, SystemSettings, MCQItem } from '../types';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Plus,
  RefreshCw,
  Flame,
  Volume2,
  VolumeX,
  ArrowLeft,
  BookOpen,
  ThumbsUp,
  Filter,
  Send,
  X,
  Swords,
  GraduationCap,
  Zap,
  Check,
  AlertCircle,
  Maximize2,
  Minimize2,
  LayoutGrid,
  RotateCcw,
  ChevronDown,
  ArrowUp,
  ListFilter
} from 'lucide-react';
import {
  getOfficial100Mcqs,
  getOfficialDailyProgress,
  saveOfficialDailyProgress,
  clearOfficialDailyProgress,
  getTodayDateKey,
  OfficialMcqProgress,
} from '../utils/officialMcqBank';
import { renderMathInHtml } from '../utils/mathUtils';
import {
  playSoundClick,
  playSoundCorrect,
  playSoundWrong,
  playSoundVictory,
  isSoundEnabled,
  setSoundEnabled,
} from '../utils/soundEffects';
import { hapticCorrect, hapticWrong } from '../utils/haptic';
import { rtdb, subscribeMcqLessons } from '../firebase';
import { ref, onValue, set, push, update } from 'firebase/database';
import { loadRoutineData, saveRoutineData } from '../utils/routineStorage';
import McqQuestionDisplay from './McqQuestionDisplay';
import { extractStatements } from '../utils/mcqParser';
import { getMcqStatements } from '../utils/mcqStructure';

export interface McqHubProps {
  user: User;
  settings?: SystemSettings | null;
  onBack?: () => void;
  isDarkMode?: boolean;
  initialMcqDraft?: { question: string; statements?: string[]; options: [string, string, string, string] | string[]; correctAnswer: number; explanation?: string };
  initialMode?: 'OFFICIAL' | 'BATTLES';
}

export interface BattleMcqItem {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  userPhoto?: string;
  classLevel?: string;
  timestamp: number;
  question: string;
  statements?: string[];
  options: string[];
  correctAnswer: number;
  explanation?: string;
  upvotes?: number;
  votes?: Record<string, number>; // userId -> optionIndex
}

const AVAILABLE_CLASSES = [
  { id: '10', label: 'Class 10' },
  { id: '12', label: 'Class 12' },
  { id: '9', label: 'Class 9' },
  { id: '11', label: 'Class 11' },
  { id: '8', label: 'Class 8' },
  { id: '7', label: 'Class 7' },
  { id: '6', label: 'Class 6' },
  { id: 'Competition', label: 'Competition' },
];

/** Helper to detect large/long questions that benefit from a scrollable viewport */
const isBigQuestion = (text?: string): boolean => {
  if (!text) return false;
  return (
    text.length > 110 ||
    text.includes('\n') ||
    text.includes('<br') ||
    text.includes('<p') ||
    text.includes('$$') ||
    text.trim().split(/\s+/).length > 22
  );
};

export const DEFAULT_BATTLE_MCQS: BattleMcqItem[] = [];

export const McqHub: React.FC<McqHubProps> = ({
  user,
  settings,
  onBack,
  isDarkMode = false,
  initialMcqDraft,
  initialMode,
}) => {
  // Top 2 main mode buttons: 'OFFICIAL' vs 'BATTLES'
  const [activeSubMode, setActiveSubMode] = useState<'OFFICIAL' | 'BATTLES'>(
    initialMode || (initialMcqDraft ? 'BATTLES' : 'OFFICIAL')
  );

  // Sound toggle
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playSoundClick();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 1: "OFFICIAL" MODE STATE & LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  const todayKey = useMemo(() => getTodayDateKey(), []);

  // ── Routine Link Integration ──────────────────────────────────────────────
  const [routineVersion, setRoutineVersion] = useState<number>(0);
  useEffect(() => {
    const onRoutineUpdate = () => setRoutineVersion((v) => v + 1);
    window.addEventListener('iic-routine-updated', onRoutineUpdate);
    window.addEventListener('storage', onRoutineUpdate);
    return () => {
      window.removeEventListener('iic-routine-updated', onRoutineUpdate);
      window.removeEventListener('storage', onRoutineUpdate);
    };
  }, []);

  const routineData = useMemo(() => {
    try {
      return loadRoutineData(user.id);
    } catch {
      return null;
    }
  }, [user.id, routineVersion]);

  const isRoutineOn = Boolean(routineData?.enabled);

  // Compute routine-linked class when routine is ON
  const routineLinkedClass = useMemo(() => {
    if (!isRoutineOn || !routineData) return null;
    if (routineData.routineMode === 'COMPETITION') {
      return 'Competition';
    }
    if (routineData.selectedClass) {
      const sc = String(routineData.selectedClass).trim().toLowerCase();
      if (sc === 'competition' || sc === 'comp') return 'Competition';
      const match = AVAILABLE_CLASSES.find((c) => c.id.toLowerCase() === sc);
      return match ? match.id : '10';
    }
    if (user.classLevel) {
      const uc = String(user.classLevel).trim().toLowerCase();
      if (uc === 'competition' || uc === 'comp') return 'Competition';
      const match = AVAILABLE_CLASSES.find((c) => c.id.toLowerCase() === uc);
      return match ? match.id : '10';
    }
    return '10';
  }, [isRoutineOn, routineData, user.classLevel]);

  // Selected Class in Official Mode (linked to Routine's class if Routine is ON; else defaults to user's class)
  const defaultClass = useMemo(() => {
    if (isRoutineOn && routineLinkedClass) {
      return routineLinkedClass;
    }
    const uc = String(user.classLevel || '10').trim().toLowerCase();
    const match = AVAILABLE_CLASSES.find((c) => c.id.toLowerCase() === uc);
    return match ? match.id : '10';
  }, [isRoutineOn, routineLinkedClass, user.classLevel]);

  const [officialClass, setOfficialClass] = useState<string>(defaultClass);

  // Auto-sync officialClass to Routine's class whenever routine is ON
  useEffect(() => {
    if (isRoutineOn && routineLinkedClass && officialClass !== routineLinkedClass) {
      setOfficialClass(routineLinkedClass);
    }
  }, [isRoutineOn, routineLinkedClass, officialClass]);

  // Real-time lessons from Firebase (to load real MCQs published by Admin)
  const [firebaseLessons, setFirebaseLessons] = useState<any[]>([]);
  useEffect(() => {
    try {
      const unsub = subscribeMcqLessons((lessons) => {
        setFirebaseLessons(lessons || []);
      });
      return unsub;
    } catch (err) {
      console.warn('Failed to subscribe to mcq lessons', err);
    }
  }, []);

  // Real Questions for selected class (loads ONLY real MCQs; returns empty [] if none exist)
  const officialQuestions = useMemo(() => {
    return getOfficial100Mcqs(officialClass, todayKey, settings, firebaseLessons);
  }, [officialClass, todayKey, settings, firebaseLessons]);

  const totalOfficialCount = officialQuestions.length;
  const maxIndex = Math.max(0, totalOfficialCount - 1);

  // Current progress state
  const [progress, setProgress] = useState<OfficialMcqProgress>(() => {
    return getOfficialDailyProgress(user.id, officialClass, todayKey);
  });

  // Whenever class changes, load saved progress for that class + date
  useEffect(() => {
    const p = getOfficialDailyProgress(user.id, officialClass, todayKey);
    setProgress(p);
  }, [officialClass, todayKey, user.id]);

  // Clamped question index in Official mode (0 to maxIndex)
  const currentQIndex = totalOfficialCount > 0 ? Math.min(progress.currentIndex, maxIndex) : 0;
  const currentQ: MCQItem | undefined = totalOfficialCount > 0 ? officialQuestions[currentQIndex] : undefined;
  const isCompleted = totalOfficialCount > 0 && (Boolean(progress.isCompleted) || progress.attemptedCount >= totalOfficialCount);

  // Auto-advance toggle
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const autoAdvanceTimerRef = useRef<any>(null);

  // Show question navigation drawer
  const [showQuestionGrid, setShowQuestionGrid] = useState<boolean>(false);
  // Toggle per-question explanation visibility to prevent screen clutter
  const [showExplanationMap, setShowExplanationMap] = useState<Record<number, boolean>>({});

  // Review All Mode (shows all 100 questions line-wise for deep review & reattempt)
  const [showReviewAll, setShowReviewAll] = useState<boolean>(false);
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'CORRECT' | 'WRONG' | 'UNATTEMPTED'>('ALL');
  const reviewContainerRef = useRef<HTMLDivElement>(null);

  // Class Selection Drawer
  const [showClassDrawer, setShowClassDrawer] = useState<boolean>(false);

  // Handle answering an Official question
  const handleSelectOfficialOption = (optionIndex: number) => {
    if (!currentQ || totalOfficialCount === 0) return;
    const existingAnswer = progress.answers[currentQIndex];
    if (existingAnswer) return; // already answered

    const isCorrect = optionIndex === currentQ.correctAnswer;

    if (soundOn) {
      if (isCorrect) playSoundCorrect();
      else playSoundWrong();
    }

    if (isCorrect) hapticCorrect();
    else hapticWrong();

    const newAnswers = {
      ...progress.answers,
      [currentQIndex]: {
        selected: optionIndex,
        isCorrect,
        timestamp: Date.now(),
      },
    };

    const newAttempted = Object.keys(newAnswers).length;
    const newCorrect = Object.values(newAnswers).filter((a) => a.isCorrect).length;
    const newWrong = newAttempted - newCorrect;
    const isCompleted = totalOfficialCount > 0 && newAttempted >= totalOfficialCount;

    const nextIndex = currentQIndex < maxIndex ? currentQIndex + 1 : currentQIndex;

    const updatedProgress: OfficialMcqProgress = {
      date: todayKey,
      classLevel: officialClass,
      currentIndex: nextIndex,
      answers: newAnswers,
      attemptedCount: newAttempted,
      correctCount: newCorrect,
      wrongCount: newWrong,
      isCompleted,
    };

    setProgress(updatedProgress);
    saveOfficialDailyProgress(user.id, updatedProgress);

    if (isCompleted && soundOn) {
      playSoundVictory();
    }

    // Auto advance smoothly to next question without manual Next/Back buttons
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (currentQIndex < maxIndex) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        setProgress((prev) => {
          const up = { ...prev, currentIndex: Math.min(maxIndex, prev.currentIndex + 1) };
          saveOfficialDailyProgress(user.id, up);
          return up;
        });
      }, 850);
    } else {
      // Completed all questions in the set! Reveal score at the end.
      autoAdvanceTimerRef.current = setTimeout(() => {
        setProgress((prev) => {
          const up = { ...prev, isCompleted: true };
          saveOfficialDailyProgress(user.id, up);
          return up;
        });
      }, 850);
    }
  };

  const handleNextOfficialQ = () => {
    if (currentQIndex < maxIndex && totalOfficialCount > 0) {
      if (soundOn) playSoundClick();
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      const next = currentQIndex + 1;
      const up = { ...progress, currentIndex: next };
      setProgress(up);
      saveOfficialDailyProgress(user.id, up);
    }
  };

  const handlePrevOfficialQ = () => {
    if (currentQIndex > 0 && totalOfficialCount > 0) {
      if (soundOn) playSoundClick();
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      const prev = currentQIndex - 1;
      const up = { ...progress, currentIndex: prev };
      setProgress(up);
      saveOfficialDailyProgress(user.id, up);
    }
  };

  const handleJumpToOfficialQ = (idx: number) => {
    if (idx >= 0 && idx < totalOfficialCount) {
      if (soundOn) playSoundClick();
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      const up = { ...progress, currentIndex: idx };
      setProgress(up);
      saveOfficialDailyProgress(user.id, up);
      setShowQuestionGrid(false);
    }
  };

  const handleResetOfficialSet = () => {
    if (window.confirm('Kya aap aaj ke MCQs dobara shuru se attempt karna chahte hain? Sabhi purane uttar clear ho jayenge.')) {
      clearOfficialDailyProgress(user.id, officialClass, todayKey);
      const empty: OfficialMcqProgress = {
        date: todayKey,
        classLevel: officialClass,
        currentIndex: 0,
        answers: {},
        attemptedCount: 0,
        correctCount: 0,
        wrongCount: 0,
        isCompleted: false,
      };
      setProgress(empty);
      setShowReviewAll(false);
      setShowQuestionGrid(false);
      if (soundOn) playSoundClick();
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 2: "MCQ BATTLES" STATE & LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  // Class filter for Battles (Can choose 'ALL' or specific class; linked to Routine if routine is ON)
  const [battleClassFilter, setBattleClassFilter] = useState<string>(() => {
    if (isRoutineOn && routineLinkedClass) return routineLinkedClass;
    return 'ALL';
  });

  useEffect(() => {
    if (isRoutineOn && routineLinkedClass) {
      setBattleClassFilter(routineLinkedClass);
      setNewTargetClass(routineLinkedClass);
    }
  }, [isRoutineOn, routineLinkedClass]);

  // List of all user-submitted battle MCQs
  const [battleList, setBattleList] = useState<BattleMcqItem[]>([]);
  const [battleLoading, setBattleLoading] = useState<boolean>(true);

  // User answered battle states (local memory)
  const [userBattleAnswers, setUserBattleAnswers] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`nst_battle_answers_${user.id}`) || '{}');
    } catch {
      return {};
    }
  });

  // User battle upvotes
  const [userBattleLikes, setUserBattleLikes] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`nst_battle_likes_${user.id}`) || '{}');
    } catch {
      return {};
    }
  });

  // Modal to submit a new MCQ to Battle Arena
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newQuestion, setNewQuestion] = useState<string>('');
  const [newStatements, setNewStatements] = useState<string>('');
  const [newOptA, setNewOptA] = useState<string>('');
  const [newOptB, setNewOptB] = useState<string>('');
  const [newOptC, setNewOptC] = useState<string>('');
  const [newOptD, setNewOptD] = useState<string>('');
  const [newCorrectIdx, setNewCorrectIdx] = useState<number>(0);
  const [newExplanation, setNewExplanation] = useState<string>('');
  const [newTargetClass, setNewTargetClass] = useState<string>(officialClass);
  const [submittingBattle, setSubmittingBattle] = useState<boolean>(false);

  // Sync selected class across MCQ Arena and Routine
  const handleClassChange = (newCls: string) => {
    setOfficialClass(newCls);
    setBattleClassFilter(newCls);
    setNewTargetClass(newCls);
    try {
      const currentRoutine = loadRoutineData(user.id);
      const isComp = newCls === 'Competition';
      const updatedRoutine = {
        ...currentRoutine,
        selectedClass: isComp ? 'Competition' : newCls,
        routineMode: isComp ? ('COMPETITION' as const) : ('SCHOOL' as const),
      };
      saveRoutineData(user.id, updatedRoutine);
      window.dispatchEvent(new CustomEvent('iic-routine-updated'));
    } catch (err) {
      console.warn('Failed to sync class to routine', err);
    }
  };

  // Pre-fill if initialMcqDraft passed
  useEffect(() => {
    if (initialMcqDraft && initialMcqDraft.question) {
      setActiveSubMode('BATTLES');
      let qText = (initialMcqDraft.question || '').replace(/<br\s*\/?>/gi, '\n').trim();
      let stmts = initialMcqDraft.statements || [];
      if (stmts.length === 0) {
        const ext = extractStatements(qText);
        if (ext.statements.length > 0) {
          stmts = ext.statements;
          qText = ext.cleanedQuestion.replace(/<br\s*\/?>/gi, '\n').trim();
        }
      }
      setNewQuestion(qText);
      setNewStatements(stmts.length > 0 ? stmts.join('\n') : '');
      const opts = initialMcqDraft.options || [];
      setNewOptA(opts[0] || '');
      setNewOptB(opts[1] || '');
      setNewOptC(opts[2] || '');
      setNewOptD(opts[3] || '');
      setNewCorrectIdx(typeof initialMcqDraft.correctAnswer === 'number' ? initialMcqDraft.correctAnswer : 0);
      setNewExplanation(initialMcqDraft.explanation || '');
      setShowCreateModal(true);
    }
  }, [initialMcqDraft]);

  // Load Battle MCQs from Firebase RTDB and localStorage
  useEffect(() => {
    setBattleLoading(true);

    // Initial local cache
    let localCache: BattleMcqItem[] = [];
    try {
      localCache = JSON.parse(localStorage.getItem('nst_cached_battle_mcqs') || '[]');
      // Filter out all dummy/seed/curriculum/procedural items
      localCache = localCache.filter(
        (item) =>
          item &&
          item.id &&
          item.question &&
          item.question.trim().length > 3 &&
          !String(item.id).startsWith('seed-') &&
          !String(item.id).startsWith('curriculum_') &&
          !String(item.id).startsWith('procedural_') &&
          !String(item.id).toLowerCase().startsWith('dummy') &&
          !String(item.id).startsWith('mock_') &&
          !String(item.id).startsWith('lucent_') &&
          !String(item.userId || '').startsWith('seed_') &&
          !String(item.userId || '').toLowerCase().startsWith('dummy')
      );
      localCache = localCache.map((item) => {
        if ((!item.statements || item.statements.length === 0) && item.question) {
          const ext = extractStatements(item.question);
          if (ext.statements.length > 0) {
            return { ...item, question: ext.cleanedQuestion, statements: ext.statements };
          }
        }
        return item;
      });
      // Purge dummy seeds from localStorage cache
      localStorage.setItem('nst_cached_battle_mcqs', JSON.stringify(localCache));
    } catch {}
    setBattleList(localCache);

    // RTDB listener on chat/universal & mcqs/battles
    if (rtdb) {
      const universalChatRef = ref(rtdb, 'chat/universal');
      const unsubscribe = onValue(
        universalChatRef,
        (snapshot) => {
          const val = snapshot.val();
          const items: BattleMcqItem[] = [];

          if (val && typeof val === 'object') {
            Object.entries(val).forEach(([msgId, msgData]: [string, any]) => {
              if (msgData && (msgData.type === 'MCQ' || msgData.mcqData)) {
                const md = msgData.mcqData || {};
                const qText = md.question || msgData.text || '';
                const rawOpts = md.options || [];
                if (qText && Array.isArray(rawOpts) && rawOpts.length >= 2) {
                  // Ensure 4 options
                  const fullOpts = [...rawOpts];
                  while (fullOpts.length < 4) fullOpts.push(`Option ${fullOpts.length + 1}`);

                  let itemStmts = md.statements || msgData.statements;
                  let finalQ = qText;
                  if (!itemStmts || itemStmts.length === 0) {
                    const ext = extractStatements(qText);
                    if (ext.statements.length > 0) {
                      itemStmts = ext.statements;
                      finalQ = ext.cleanedQuestion;
                    }
                  }

                  items.push({
                    id: msgId,
                    userId: msgData.userId || 'anon',
                    userName: msgData.userName || 'Student',
                    userRole: msgData.userRole || msgData.subscriptionLevel || 'Student',
                    userPhoto: msgData.userPhoto || '',
                    classLevel: msgData.classLevel || md.classLevel || 'General',
                    timestamp: msgData.timestamp || Date.now(),
                    question: finalQ,
                    statements: itemStmts && itemStmts.length > 0 ? itemStmts : undefined,
                    options: fullOpts.slice(0, 4),
                    correctAnswer: typeof md.correctAnswer === 'number' ? md.correctAnswer : 0,
                    explanation: md.explanation || '',
                    upvotes: msgData.upvotes || 0,
                    votes: msgData.votes || {},
                  });
                }
              }
            });
          }

          // Also check explicit mcqs/battles node
          const battlesRef = ref(rtdb, 'mcqs/battles');
          onValue(
            battlesRef,
            (bSnap) => {
              const bVal = bSnap.val();
              if (bVal && typeof bVal === 'object') {
                Object.entries(bVal).forEach(([bId, bData]: [string, any]) => {
                  if (bData && bData.question && Array.isArray(bData.options)) {
                    if (!items.some((it) => it.id === bId)) {
                      let itemStmts = bData.statements || (bData.mcqData?.statements);
                      let finalQ = bData.question;
                      if (!itemStmts || itemStmts.length === 0) {
                        const ext = extractStatements(bData.question);
                        if (ext.statements.length > 0) {
                          itemStmts = ext.statements;
                          finalQ = ext.cleanedQuestion;
                        }
                      }

                      items.push({
                        id: bId,
                        userId: bData.userId || 'anon',
                        userName: bData.userName || 'Challenger',
                        userRole: bData.userRole || 'Student',
                        userPhoto: bData.userPhoto || '',
                        classLevel: bData.classLevel || 'General',
                        timestamp: bData.timestamp || Date.now(),
                        question: finalQ,
                        statements: itemStmts && itemStmts.length > 0 ? itemStmts : undefined,
                        options: bData.options.slice(0, 4),
                        correctAnswer: typeof bData.correctAnswer === 'number' ? bData.correctAnswer : 0,
                        explanation: bData.explanation || '',
                        upvotes: bData.upvotes || 0,
                        votes: bData.votes || {},
                      });
                    }
                  }
                });
              }

              // Keep strictly real questions from the app (no dummy/seed questions)
              const realItems = items.filter(
                (it) =>
                  it &&
                  it.id &&
                  it.question &&
                  it.question.trim().length > 3 &&
                  !String(it.id).startsWith('seed-') &&
                  !String(it.id).startsWith('curriculum_') &&
                  !String(it.id).startsWith('procedural_') &&
                  !String(it.id).toLowerCase().startsWith('dummy') &&
                  !String(it.id).startsWith('mock_') &&
                  !String(it.id).startsWith('lucent_') &&
                  !String(it.userId || '').startsWith('seed_') &&
                  !String(it.userId || '').toLowerCase().startsWith('dummy')
              );

              // Sort newest first
              realItems.sort((a, b) => b.timestamp - a.timestamp);
              setBattleList(realItems);
              setBattleLoading(false);

              try {
                localStorage.setItem('nst_cached_battle_mcqs', JSON.stringify(realItems.slice(0, 80)));
              } catch {}
            },
            { onlyOnce: true }
          );
        },
        (err) => {
          console.warn('RTDB Universal chat listener error', err);
          setBattleLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      setBattleLoading(false);
    }
  }, []);

  // Filtered battles based on selected class filter
  const visibleBattles = useMemo(() => {
    if (battleClassFilter === 'ALL') return battleList;
    return battleList.filter((b) => {
      const c = String(b.classLevel || '').toLowerCase();
      const f = battleClassFilter.toLowerCase();
      return c === f || c.includes(f) || (f === 'competition' && c.includes('comp'));
    });
  }, [battleList, battleClassFilter]);

  // Battle Question Navigation & View States
  const [battleViewMode, setBattleViewMode] = useState<'CARD' | 'FEED'>('CARD');
  const [currentBattleIdx, setCurrentBattleIdx] = useState<number>(0);
  const [showBattleGrid, setShowBattleGrid] = useState<boolean>(false);

  useEffect(() => {
    setCurrentBattleIdx(0);
  }, [battleClassFilter]);

  const safeBattleIdx = useMemo(() => {
    if (visibleBattles.length === 0) return 0;
    return Math.min(Math.max(0, currentBattleIdx), visibleBattles.length - 1);
  }, [currentBattleIdx, visibleBattles.length]);

  const handlePrevBattleQ = () => {
    if (safeBattleIdx > 0) {
      if (soundOn) playSoundClick();
      setCurrentBattleIdx(safeBattleIdx - 1);
    }
  };

  const handleNextBattleQ = () => {
    if (safeBattleIdx < visibleBattles.length - 1) {
      if (soundOn) playSoundClick();
      setCurrentBattleIdx(safeBattleIdx + 1);
    }
  };

  const handleJumpToBattleQ = (index: number) => {
    if (soundOn) playSoundClick();
    setCurrentBattleIdx(index);
    setShowBattleGrid(false);
    if (battleViewMode === 'FEED') {
      const targetId = visibleBattles[index]?.id;
      if (targetId) {
        setTimeout(() => {
          const el = document.getElementById(`battle-card-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 60);
      }
    }
  };

  const scrollToBattleCard = (targetIndex: number, battleId: string) => {
    if (soundOn) playSoundClick();
    setCurrentBattleIdx(targetIndex);
    const el = document.getElementById(`battle-card-${battleId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Answer a battle MCQ
  const handleAnswerBattle = (battleId: string, optionIndex: number, correctIndex: number) => {
    if (userBattleAnswers[battleId] !== undefined) return; // already answered

    const isCorrect = optionIndex === correctIndex;
    if (soundOn) {
      if (isCorrect) playSoundCorrect();
      else playSoundWrong();
    }
    if (isCorrect) hapticCorrect();
    else hapticWrong();

    const updated = { ...userBattleAnswers, [battleId]: optionIndex };
    setUserBattleAnswers(updated);
    try {
      localStorage.setItem(`nst_battle_answers_${user.id}`, JSON.stringify(updated));
    } catch {}

    // Record vote to RTDB
    if (rtdb) {
      try {
        update(ref(rtdb, `mcqs/battles/${battleId}/votes`), { [user.id]: optionIndex }).catch(() => {});
        update(ref(rtdb, `chat/universal/${battleId}/votes`), { [user.id]: optionIndex }).catch(() => {});
      } catch {}
    }
  };

  // Like / Upvote a Battle MCQ
  const handleToggleBattleLike = (battleId: string) => {
    const isLiked = !!userBattleLikes[battleId];
    const newLiked = !isLiked;
    const updated = { ...userBattleLikes, [battleId]: newLiked };
    setUserBattleLikes(updated);
    try {
      localStorage.setItem(`nst_battle_likes_${user.id}`, JSON.stringify(updated));
    } catch {}

    // Update state locally
    setBattleList((prev) =>
      prev.map((b) => {
        if (b.id === battleId) {
          const delta = newLiked ? 1 : -1;
          return { ...b, upvotes: Math.max(0, (b.upvotes || 0) + delta) };
        }
        return b;
      })
    );

    if (rtdb) {
      try {
        const item = battleList.find((b) => b.id === battleId);
        const curVotes = item?.upvotes || 0;
        const newCount = Math.max(0, curVotes + (newLiked ? 1 : -1));
        update(ref(rtdb, `mcqs/battles/${battleId}`), { upvotes: newCount }).catch(() => {});
        update(ref(rtdb, `chat/universal/${battleId}`), { upvotes: newCount }).catch(() => {});
      } catch {}
    }
  };

  // Submit a new MCQ to Battle Arena
  const handleSubmitNewBattle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newOptA.trim() || !newOptB.trim() || !newOptC.trim() || !newOptD.trim()) {
      alert('Kripya prashna aur charo options (A, B, C, D) ko fill karein.');
      return;
    }

    setSubmittingBattle(true);
    const newId = `battle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let parsedStatements = newStatements.trim()
      ? newStatements
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    let finalQuestion = newQuestion.trim();
    if (!parsedStatements || parsedStatements.length === 0) {
      const extracted = extractStatements(newQuestion);
      if (extracted.statements.length > 0) {
        parsedStatements = extracted.statements;
        finalQuestion = extracted.cleanedQuestion;
      }
    }

    const newBattleItem: BattleMcqItem = {
      id: newId,
      userId: user.id,
      userName: user.name || 'Student Challenger',
      userRole: user.role || user.subscriptionLevel || 'Student',
      userPhoto: user.photoUrl || '',
      classLevel: newTargetClass,
      timestamp: Date.now(),
      question: finalQuestion,
      statements: parsedStatements,
      options: [newOptA.trim(), newOptB.trim(), newOptC.trim(), newOptD.trim()],
      correctAnswer: newCorrectIdx,
      explanation: newExplanation.trim() || undefined,
      upvotes: 0,
      votes: {},
    };

    // Save to RTDB
    if (rtdb) {
      try {
        // Save to mcqs/battles
        await set(ref(rtdb, `mcqs/battles/${newId}`), newBattleItem);
        // Also save to chat/universal so it syncs with universal chat
        await set(ref(rtdb, `chat/universal/${newId}`), {
          id: newId,
          type: 'MCQ',
          userId: user.id,
          userName: user.name,
          userPhoto: user.photoUrl,
          userRole: user.role,
          classLevel: newTargetClass,
          timestamp: Date.now(),
          text: finalQuestion,
          mcqData: {
            question: finalQuestion,
            statements: parsedStatements,
            options: [newOptA.trim(), newOptB.trim(), newOptC.trim(), newOptD.trim()],
            correctAnswer: newCorrectIdx,
            explanation: newExplanation.trim(),
            classLevel: newTargetClass,
          },
        });
      } catch (err) {
        console.warn('Battle RTDB push failed, using local persistence', err);
      }
    }

    // Insert locally at top of list
    setBattleList((prev) => [newBattleItem, ...prev]);

    // Reset modal form
    setNewQuestion('');
    setNewStatements('');
    setNewOptA('');
    setNewOptB('');
    setNewOptC('');
    setNewOptD('');
    setNewExplanation('');
    setNewCorrectIdx(0);
    setSubmittingBattle(false);
    setShowCreateModal(false);

    if (soundOn) playSoundCorrect();
    alert('🎉 Aapka MCQ Battle Arena me post ho gaya hai! Sabhi students ise dekh aur solve kar sakte hain.');
  };

  // Battle user stats
  const battleAttemptedCount = useMemo(() => {
    return Object.keys(userBattleAnswers).length;
  }, [userBattleAnswers]);

  const battleCorrectCount = useMemo(() => {
    let c = 0;
    battleList.forEach((b) => {
      if (userBattleAnswers[b.id] !== undefined && userBattleAnswers[b.id] === b.correctAnswer) {
        c++;
      }
    });
    return c;
  }, [battleList, userBattleAnswers]);

  const battleWrongCount = battleAttemptedCount - battleCorrectCount;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER UI
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      id="mcq-hub-root-container"
      className={`w-full h-full flex-1 flex flex-col overflow-y-auto overscroll-contain ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* ── Top Header: Back button (Left) + Mode Switcher (Fills top bar) + Close button (Right) ── */}
      <header
        className={`sticky top-0 z-30 px-2 sm:px-4 py-1.5 border-b backdrop-blur-md shrink-0 flex items-center justify-between gap-2 w-full ${
          isDarkMode
            ? 'bg-slate-900/95 border-slate-800 text-white'
            : 'bg-white/95 border-slate-200 text-slate-900 shadow-2xs'
        }`}
      >
        {/* Left: Back button */}
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
          }}
          className={`w-8 h-8 rounded-xl border flex items-center justify-center active:scale-95 transition-all shrink-0 cursor-pointer ${
            isDarkMode
              ? 'border-slate-800 bg-slate-800 text-slate-200 hover:bg-slate-700'
              : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title="Wapas Jayein"
        >
          <ArrowLeft size={17} />
        </button>

        {/* Center: Top 2 Main Mode Buttons spanning full top bar */}
        <div className="flex-1 flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 min-w-0">
          <button
            type="button"
            onClick={() => {
              setActiveSubMode('OFFICIAL');
              if (soundOn) playSoundClick();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-black text-xs transition-all cursor-pointer truncate ${
              activeSubMode === 'OFFICIAL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles size={13} className={activeSubMode === 'OFFICIAL' ? 'text-amber-300' : 'text-blue-500'} />
            <span className="truncate">Official 100 MCQs</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubMode('BATTLES');
              if (soundOn) playSoundClick();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-black text-xs transition-all cursor-pointer truncate ${
              activeSubMode === 'BATTLES'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Swords size={13} className={activeSubMode === 'BATTLES' ? 'text-amber-300' : 'text-purple-500'} />
            <span className="truncate">MCQ Battle</span>
            {battleList.length > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full shrink-0 ${
                  activeSubMode === 'BATTLES'
                    ? 'bg-white/20 text-white'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                }`}
              >
                {battleList.length}
              </span>
            )}
          </button>
        </div>

        {/* Right: Cross / Close button */}
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
          }}
          className={`w-8 h-8 rounded-xl border flex items-center justify-center active:scale-95 transition-all shrink-0 cursor-pointer ${
            isDarkMode
              ? 'border-slate-800 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-rose-400'
              : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-rose-600'
          }`}
          title="Band Karein"
        >
          <X size={17} />
        </button>
      </header>

      {/* ── Sub-bar: Compact Controls & Class Selector ── */}
      <div
        className={`sticky top-[44px] z-20 px-3 py-1 border-b shrink-0 flex items-center justify-between gap-2 backdrop-blur-md ${
          isDarkMode
            ? 'bg-slate-900/90 border-slate-800/80 text-white'
            : 'bg-white/90 border-slate-200/80 text-slate-900'
        }`}
      >
        {activeSubMode === 'OFFICIAL' ? (
          <>
            {/* Left: Class Drawer Trigger Button showing selected class */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <button
                id="mcq-class-drawer-trigger-official"
                type="button"
                onClick={() => {
                  setShowClassDrawer(true);
                  if (soundOn) playSoundClick();
                }}
                className={`h-7 px-2.5 rounded-lg border flex items-center gap-1.5 font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-2xs ${
                  isDarkMode
                    ? 'bg-slate-800/90 border-blue-500/40 text-slate-200 hover:bg-slate-800'
                    : 'bg-blue-50/90 border-blue-200 text-blue-900 hover:bg-blue-100'
                }`}
                title="Class Drawer kholen (Class badalne ke liye)"
              >
                <GraduationCap size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Class:</span>
                <span className="font-black text-blue-600 dark:text-blue-400">
                  {AVAILABLE_CLASSES.find((c) => c.id === officialClass)?.label || `Class ${officialClass}`}
                </span>
                <ChevronDown size={12} className="text-slate-400 dark:text-slate-500 shrink-0 ml-0.5" />
              </button>

              <span className="text-[11px] text-slate-400 font-medium hidden xs:inline truncate">
                (Tap to change class)
              </span>
            </div>

            {/* Right: Compact Action Buttons (Review All, Restart, Sound) */}
            <div className="flex items-center gap-1 shrink-0">
              {totalOfficialCount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReviewAll((prev) => !prev);
                      if (soundOn) playSoundClick();
                    }}
                    className={`h-6.5 px-2 rounded-lg border flex items-center gap-1 text-[11px] font-bold active:scale-95 transition-all cursor-pointer ${
                      showReviewAll
                        ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                        : isDarkMode
                        ? 'border-amber-800/80 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'
                        : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                    title="Review All (Sabhi 100 questions scroll karke dekhein)"
                  >
                    <BookOpen size={12} />
                    <span className="hidden sm:inline">Review</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetOfficialSet}
                    className={`h-6.5 px-1.5 rounded-lg border flex items-center justify-center text-[11px] font-bold active:scale-95 transition-all cursor-pointer ${
                      isDarkMode
                        ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-rose-400'
                        : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-rose-600'
                    }`}
                    title="Restart Test"
                  >
                    <RotateCcw size={12} />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={toggleSound}
                className={`w-6.5 h-6.5 rounded-lg border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  soundOn
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-400'
                    : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                }`}
                title={soundOn ? 'Sound Mute' : 'Sound On'}
              >
                {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Left: Class Drawer Trigger Button for Battles */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <button
                id="mcq-class-drawer-trigger-battle"
                type="button"
                onClick={() => {
                  setShowClassDrawer(true);
                  if (soundOn) playSoundClick();
                }}
                className={`h-7 px-2.5 rounded-lg border flex items-center gap-1.5 font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-2xs ${
                  isDarkMode
                    ? 'bg-slate-800/90 border-purple-500/40 text-slate-200 hover:bg-slate-800'
                    : 'bg-purple-50/90 border-purple-200 text-purple-900 hover:bg-purple-100'
                }`}
                title="Class Drawer kholen (Class badalne ke liye)"
              >
                <GraduationCap size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Class:</span>
                <span className="font-black text-purple-600 dark:text-purple-400">
                  {battleClassFilter === 'ALL'
                    ? 'All Classes 🌟'
                    : (AVAILABLE_CLASSES.find((c) => c.id === battleClassFilter)?.label || `Class ${battleClassFilter}`)}
                </span>
                <ChevronDown size={12} className="text-slate-400 dark:text-slate-500 shrink-0 ml-0.5" />
              </button>

              <span className="text-[11px] text-slate-400 font-medium hidden xs:inline truncate">
                (Tap to filter class)
              </span>
            </div>

            {/* Right: + Post MCQ and Sound toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 h-6.5 px-2.5 rounded-lg font-black text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
                title="Naya Battle MCQ post karein"
              >
                <Plus size={13} strokeWidth={3} />
                <span>Post MCQ</span>
              </button>

              <button
                type="button"
                onClick={toggleSound}
                className={`w-6.5 h-6.5 rounded-lg border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  soundOn
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-400'
                    : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                }`}
                title={soundOn ? 'Sound Mute' : 'Sound On'}
              >
                {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 1. OFFICIAL MODE VIEW */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSubMode === 'OFFICIAL' && (
        <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-2 gap-2 animate-in fade-in duration-150">
          {/* ── Examination Action & Status Strip (Compact, Live Score Hidden, Auto-Advance Active) ── */}
          <div
            className={`flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl border transition-all ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
            }`}
          >
            {/* Question Counter Button */}
            <button
              type="button"
              onClick={() => setShowQuestionGrid(true)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-all font-black text-xs cursor-pointer active:scale-95"
              title="Sabhi prashna dekhein"
            >
              <LayoutGrid size={13} className="text-blue-600 dark:text-blue-400" />
              <span>
                Q {currentQIndex + 1} / {totalOfficialCount}
              </span>
            </button>

            {/* Auto-Advance indicator and End Test action */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200/80 dark:border-blue-800/80">
                <Sparkles size={11} className="text-amber-500 shrink-0" />
                <span>Auto-Advance</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setProgress((prev) => {
                    const up = { ...prev, isCompleted: true };
                    saveOfficialDailyProgress(user.id, up);
                    return up;
                  });
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                title="Test samapt karein aur score dekhein"
              >
                End & See Score
              </button>
            </div>
          </div>

          {/* Slim 2px Progress Bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 rounded-full"
              style={{
                width: `${
                  totalOfficialCount > 0
                    ? Math.min(100, (progress.attemptedCount / totalOfficialCount) * 100)
                    : 0
                }%`,
              }}
            />
          </div>

          {/* If No MCQs Exist for this Class */}
          {totalOfficialCount === 0 ? (
            <div
              className={`flex flex-col items-center justify-center text-center p-8 rounded-3xl border transition-all ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-2xl mb-3">
                📭
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">
                {officialClass === 'Competition' ? 'Competition Mode' : `Class ${officialClass}`} me abhi koi Official MCQ uplabdh nahi hai
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
                {officialClass === 'Competition' ? 'Competition' : 'Is class'} ke liye app me abhi koi official MCQ nahi mila. Jab admin questions publish karenge, tab yahan turant aane lagenge. Aap doosri class choose kar sakte hain ya community battles me participate kar sakte hain!
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubMode('BATTLES')}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Swords size={14} /> MCQ Battles Kheleli
                </button>
              </div>
            </div>
          ) : showReviewAll ? (
            /* ── FULL LINE-WISE REVIEW ALL VIEW ── */
            <div ref={reviewContainerRef} className="flex flex-col gap-3 pb-28 animate-in fade-in duration-150">
              {/* Review All Header Card */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReviewAll(false)}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                      title="Wapas Quiz me Jayein"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <h2 className="text-sm sm:text-base font-black flex items-center gap-1.5">
                        <BookOpen size={16} className="text-amber-500" />
                        <span>Review All Questions ({totalOfficialCount})</span>
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Line-wise sabhi questions, aapke chune uttar aur vyakhya scroll karke dekhein
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetOfficialSet}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                    title="Dobara Shuru Se Banayein"
                  >
                    <RotateCcw size={13} />
                    <span>Reattempt</span>
                  </button>
                </div>

                {/* Score Summary Metrics */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Total</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{totalOfficialCount}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Sahi</div>
                    <div className="text-sm sm:text-base font-black text-emerald-600">{progress.correctCount}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/80">
                    <div className="text-[10px] font-bold text-rose-600 uppercase">Galat</div>
                    <div className="text-sm sm:text-base font-black text-rose-600">{progress.wrongCount}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80">
                    <div className="text-[10px] font-bold text-amber-600 uppercase">Bache</div>
                    <div className="text-sm sm:text-base font-black text-amber-600">
                      {Math.max(0, totalOfficialCount - progress.attemptedCount)}
                    </div>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
                    <ListFilter size={13} /> Filter:
                  </span>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('ALL')}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      reviewFilter === 'ALL'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Sabhi ({totalOfficialCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('CORRECT')}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      reviewFilter === 'CORRECT'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80'
                    }`}
                  >
                    ✓ Sahi ({progress.correctCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('WRONG')}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      reviewFilter === 'WRONG'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80'
                    }`}
                  >
                    ✗ Galat ({progress.wrongCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('UNATTEMPTED')}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      reviewFilter === 'UNATTEMPTED'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80'
                    }`}
                  >
                    ⚪ Chhode ({Math.max(0, totalOfficialCount - progress.attemptedCount)})
                  </button>
                </div>
              </div>

              {/* Line-wise Questions List */}
              <div className="flex flex-col gap-3">
                {officialQuestions.map((q, idx) => {
                  const userAns = progress.answers[idx];
                  const isAnswered = userAns !== undefined;
                  const isCorrect = isAnswered && userAns.isCorrect;
                  const isWrong = isAnswered && !userAns.isCorrect;
                  const isUnattempted = !isAnswered;

                  // Apply filter
                  if (reviewFilter === 'CORRECT' && !isCorrect) return null;
                  if (reviewFilter === 'WRONG' && !isWrong) return null;
                  if (reviewFilter === 'UNATTEMPTED' && !isUnattempted) return null;

                  return (
                    <div
                      key={idx}
                      id={`review-q-${idx}`}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        isCorrect
                          ? 'border-emerald-300/80 dark:border-emerald-900/60 bg-emerald-50/25 dark:bg-emerald-950/15'
                          : isWrong
                          ? 'border-rose-300/80 dark:border-rose-900/60 bg-rose-50/25 dark:bg-rose-950/15'
                          : isDarkMode
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                    >
                      {/* Question Item Header */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-xs font-black bg-blue-600 text-white">
                            Q {idx + 1}
                          </span>
                          {q.subject && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {q.subject}
                            </span>
                          )}
                          {isCorrect && (
                            <span className="flex items-center gap-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 size={12} /> Sahi Uttar (+1)
                            </span>
                          )}
                          {isWrong && (
                            <span className="flex items-center gap-1 text-[11px] font-black text-rose-700 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                              <XCircle size={12} /> Galat Uttar (0)
                            </span>
                          )}
                          {isUnattempted && (
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                              Chhoda Gaya
                            </span>
                          )}
                        </div>

                        {/* Action to Jump to Question in Quiz */}
                        <button
                          type="button"
                          onClick={() => {
                            handleJumpToOfficialQ(idx);
                            setShowReviewAll(false);
                          }}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                          title="Is prashna par quiz me jayein"
                        >
                          <span>Quiz me Kholein</span>
                          <ChevronRight size={12} />
                        </button>
                      </div>

                      {/* Question Text & Statements with McqQuestionDisplay */}
                      <div className="mb-3">
                        <McqQuestionDisplay q={q} isDarkMode={isDarkMode} />
                      </div>

                      {/* Options with clear highlighting */}
                      <div className="flex flex-col gap-2 mb-3">
                        {q.options.map((optText, optIdx) => {
                          const isCorrectOpt = optIdx === q.correctAnswer;
                          const isUserPicked = isAnswered && userAns.selected === optIdx;

                          let optBorder = isDarkMode ? 'border-slate-700/80 bg-slate-800/40 text-slate-300' : 'border-slate-200 bg-slate-50/80 text-slate-700';
                          let badgeBg = isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700';
                          let statusLabel: React.ReactNode = null;

                          if (isCorrectOpt) {
                            optBorder = 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500/30 font-semibold';
                            badgeBg = 'bg-emerald-600 text-white';
                            statusLabel = (
                              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                                <Check size={10} strokeWidth={3} /> Sahi Uttar
                              </span>
                            );
                          }

                          if (isUserPicked && !isCorrectOpt) {
                            optBorder = 'border-rose-400 bg-rose-50/90 dark:bg-rose-950/70 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500/30';
                            badgeBg = 'bg-rose-600 text-white';
                            statusLabel = (
                              <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                                <X size={10} strokeWidth={3} /> Aapka Uttar (Galat)
                              </span>
                            );
                          } else if (isUserPicked && isCorrectOpt) {
                            statusLabel = (
                              <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-200 bg-emerald-200 dark:bg-emerald-900 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                                <Check size={10} strokeWidth={3} /> Aapka Uttar (Sahi)
                              </span>
                            );
                          }

                          const optLabels = ['A', 'B', 'C', 'D'];

                          return (
                            <div
                              key={optIdx}
                              className={`flex items-start sm:items-center justify-between gap-2.5 p-2.5 rounded-xl border text-left text-xs sm:text-sm ${optBorder}`}
                            >
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[11px] shrink-0 ${badgeBg}`}>
                                  {optLabels[optIdx]}
                                </span>
                                <div
                                  className="flex-1"
                                  dangerouslySetInnerHTML={{
                                    __html: renderMathInHtml(optText || ''),
                                  }}
                                />
                              </div>
                              {statusLabel}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
                          <strong className="font-bold flex items-center gap-1 text-blue-700 dark:text-blue-400 mb-1">
                            <Sparkles size={12} /> व्याख्या (Explanation):
                          </strong>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: renderMathInHtml(q.explanation),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Floating Bottom Sticky Bar */}
              <div
                className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-2xl border shadow-2xl backdrop-blur-md max-w-sm w-[92%] justify-between ${
                  isDarkMode ? 'bg-slate-900/95 border-slate-700 text-white' : 'bg-white/95 border-slate-300 text-slate-900'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowUp size={13} />
                  <span>Top</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetOfficialSet}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Reattempt (दोबारा बनाएं)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReviewAll(false)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  <span>Quiz me</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Active Question Card ── */}
              {currentQ && (
                <div
                  className={`flex flex-col p-3.5 sm:p-4 rounded-2xl border transition-all shadow-2xs ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Question metadata header */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-600 text-white">
                        Q{currentQIndex + 1}
                      </span>
                      {currentQ.topic && (
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[140px] sm:max-w-[200px]">
                          {currentQ.topic}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Answered status badge */}
                      {progress.answers[currentQIndex] && (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            progress.answers[currentQIndex].isCorrect
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {progress.answers[currentQIndex].isCorrect ? (
                            <>
                              <CheckCircle2 size={11} /> Sahi
                            </>
                          ) : (
                            <>
                              <XCircle size={11} /> Galat
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text with Math rendering */}
                  <div className="mb-3">
                    <McqQuestionDisplay q={currentQ} isDarkMode={isDarkMode} />
                  </div>

                  {/* 4 Options */}
                  <div className="flex flex-col gap-2 mb-3">
                    {currentQ.options.map((optText, optIdx) => {
                      const isAnswered = progress.answers[currentQIndex] !== undefined;
                      const selectedIdx = progress.answers[currentQIndex]?.selected;
                      const isUserSelected = selectedIdx === optIdx;
                      const isCorrectAnswer = optIdx === currentQ.correctAnswer;

                      let optStyles = isDarkMode
                        ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800';

                      let badgeStyles = isDarkMode
                        ? 'bg-slate-700 text-slate-300'
                        : 'bg-slate-200 text-slate-700';

                      if (isAnswered) {
                        if (isCorrectAnswer) {
                          optStyles =
                            'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-100 font-bold ring-2 ring-emerald-500/20';
                          badgeStyles = 'bg-emerald-600 text-white';
                        } else if (isUserSelected && !isCorrectAnswer) {
                          optStyles =
                            'bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-600 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20';
                          badgeStyles = 'bg-rose-600 text-white';
                        } else {
                          optStyles = isDarkMode
                            ? 'bg-slate-800/40 border-slate-800 text-slate-400'
                            : 'bg-slate-50/70 border-slate-200/80 text-slate-600';
                          badgeStyles = isDarkMode
                            ? 'bg-slate-800 text-slate-500'
                            : 'bg-slate-200/80 text-slate-500';
                        }
                      }

                      const optLabels = ['A', 'B', 'C', 'D'];

                      return (
                        <button
                          key={optIdx}
                          disabled={isAnswered}
                          onClick={() => handleSelectOfficialOption(optIdx)}
                          className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border text-left transition-all active:scale-[0.99] cursor-pointer ${optStyles}`}
                        >
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 transition-colors ${badgeStyles}`}
                          >
                            {isAnswered && isCorrectAnswer ? (
                              <Check size={13} strokeWidth={3} />
                            ) : isAnswered && isUserSelected && !isCorrectAnswer ? (
                              <X size={13} strokeWidth={3} />
                            ) : (
                              optLabels[optIdx]
                            )}
                          </span>

                          <div
                            className="flex-1 text-xs sm:text-sm font-semibold leading-snug"
                            dangerouslySetInnerHTML={{
                              __html: renderMathInHtml(optText),
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback & Explanation Box if Answered */}
                  {progress.answers[currentQIndex] && (
                    <div
                      className={`p-3 rounded-xl border flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150 ${
                        progress.answers[currentQIndex].isCorrect
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                          : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-black text-xs flex items-center gap-1.5 uppercase tracking-wide">
                          {progress.answers[currentQIndex].isCorrect ? (
                            <>
                              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                              <span>सही उत्तर! (+1 Marks)</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={14} className="text-rose-600 shrink-0" />
                              <span>गलत उत्तर! सही उत्तर था: Option {['A', 'B', 'C', 'D'][currentQ.correctAnswer]}</span>
                            </>
                          )}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {currentQ.explanation && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowExplanationMap((prev) => ({
                                  ...prev,
                                  [currentQIndex]: !prev[currentQIndex],
                                }))
                              }
                              className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/80 hover:bg-white active:scale-95 transition-all cursor-pointer"
                            >
                              {showExplanationMap[currentQIndex] ? 'व्याख्या छुपाएं' : '📖 व्याख्या'}
                            </button>
                          )}

                        </div>
                      </div>

                      {currentQ.explanation && showExplanationMap[currentQIndex] && (
                        <div className="text-xs font-medium leading-relaxed opacity-95 border-t pt-2 border-black/10 dark:border-white/10 animate-in fade-in">
                          <strong className="font-bold">व्याख्या (Explanation): </strong>
                          <span
                            dangerouslySetInnerHTML={{
                              __html: renderMathInHtml(currentQ.explanation),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Completion Milestone Card */}
              {isCompleted && (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl flex flex-col items-center text-center gap-3">
                  <Trophy size={48} className="text-amber-200 animate-bounce" />
                  <div>
                    <h3 className="text-xl font-black">बधाई हो! आज के MCQs पूरे हुए!</h3>
                    <p className="text-xs text-amber-100 mt-1">
                      Aapka Score: {progress.correctCount} / {totalOfficialCount} ({totalOfficialCount > 0 ? Math.round((progress.correctCount / totalOfficialCount) * 100) : 0}% Accuracy)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReviewAll(true);
                        if (soundOn) playSoundClick();
                      }}
                      className="px-4 py-2 bg-white text-orange-700 font-black rounded-xl text-xs shadow-md active:scale-95 hover:bg-amber-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <BookOpen size={14} />
                      <span>Review All ({totalOfficialCount} Questions)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetOfficialSet}
                      className="px-4 py-2 bg-orange-700/70 hover:bg-orange-700 text-white font-bold rounded-xl text-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw size={14} />
                      <span>Reattempt (दोबारा बनाएं)</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 2. MCQ BATTLES VIEW */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSubMode === 'BATTLES' && (
        <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-2 pb-28 sm:pb-36 gap-2 animate-in fade-in duration-150">
          {/* ── Battles Count Bar (Compact) ── */}
          <div className="flex items-center justify-between px-1 py-0.5 text-xs">
            <div className="flex items-center gap-1.5">
              <Swords size={13} className="text-purple-600" />
              <span className="font-black text-slate-800 dark:text-slate-200">
                {visibleBattles.length} Battle MCQs
              </span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-200/60 dark:border-purple-800/60">
                📜 Scrollable Feed
              </span>
            </div>
            {isRoutineOn && (
              <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                Routine: {routineLinkedClass === 'Competition' ? 'Competition' : `Class ${routineLinkedClass}`}
              </span>
            )}
          </div>

          {/* ── Main Content: Full Feed List ── */}
          <div className="flex flex-col gap-3.5 flex-1 min-h-0">
            {battleLoading && battleList.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center gap-2">
                <RefreshCw size={24} className="animate-spin text-purple-600" />
                <p className="text-xs font-bold text-slate-500">Live Battles Load Ho Rahe Hain...</p>
              </div>
            ) : visibleBattles.length === 0 ? (
              <div
                className={`p-8 text-center rounded-3xl border flex flex-col items-center gap-3 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <span className="text-4xl">⚔️</span>
                <div>
                  <p className="font-black text-sm text-slate-800 dark:text-slate-200">
                    Is class ke liye abhi koi battle MCQ nahi mila!
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Sabse pehle aap hi is class ke liye naya MCQ bhejiye aur dosto ko challenge kijiye!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-md active:scale-95"
                >
                  + Pehla MCQ Post Karein
                </button>
              </div>
            ) : (
              <>
                {/* ── FULL FEED LIST MODE ── */}
                {visibleBattles.map((battle, bIndex) => {
                const userAns = userBattleAnswers[battle.id];
                const hasAnswered = userAns !== undefined;
                const isLiked = !!userBattleLikes[battle.id];

                return (
                  <div
                    key={battle.id}
                    id={`battle-card-${battle.id}`}
                    className={`flex flex-col p-4 sm:p-5 rounded-3xl border transition-all ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    {/* Header: Author info, time, class badge */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
                          {battle.userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                              {battle.userName}
                            </span>
                            {battle.userRole && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 uppercase">
                                {battle.userRole}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(battle.timestamp).toLocaleDateString([], {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {battle.classLevel && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Class {battle.classLevel}
                          </span>
                        )}
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                          #{bIndex + 1}
                        </span>
                      </div>
                    </div>

                    {/* Question Text & Statements */}
                    <div className="mb-4">
                      <McqQuestionDisplay q={battle} isDarkMode={isDarkMode} />
                    </div>

                    {/* Options list */}
                    <div className="flex flex-col gap-2 mb-3">
                      {battle.options.map((optText, optIdx) => {
                        const isUserPicked = userAns === optIdx;
                        const isCorrectOption = optIdx === battle.correctAnswer;

                        let optClass = isDarkMode
                          ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800';

                        let badgeClass = isDarkMode
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-slate-200 text-slate-700';

                        if (hasAnswered) {
                          if (isCorrectOption) {
                            optClass =
                              'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-100 font-bold';
                            badgeClass = 'bg-emerald-600 text-white';
                          } else if (isUserPicked && !isCorrectOption) {
                            optClass =
                              'bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-900 dark:text-rose-100';
                            badgeClass = 'bg-rose-600 text-white';
                          } else {
                            optClass = 'opacity-50 border-transparent bg-slate-100/40 text-slate-400';
                          }
                        }

                        const labels = ['A', 'B', 'C', 'D'];

                        return (
                          <button
                            key={optIdx}
                            disabled={hasAnswered}
                            onClick={() => handleAnswerBattle(battle.id, optIdx, battle.correctAnswer)}
                            className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl border text-left transition-all active:scale-[0.99] cursor-pointer ${optClass}`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${badgeClass}`}
                            >
                              {hasAnswered && isCorrectOption ? (
                                <Check size={13} strokeWidth={3} />
                              ) : hasAnswered && isUserPicked && !isCorrectOption ? (
                                <X size={13} strokeWidth={3} />
                              ) : (
                                labels[optIdx]
                              )}
                            </span>
                            <div
                              className="flex-1 text-xs sm:text-sm font-semibold"
                              dangerouslySetInnerHTML={{
                                __html: renderMathInHtml(optText),
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanation box if answered */}
                    {hasAnswered && (
                      <div
                        className={`p-3 rounded-xl border text-xs leading-relaxed mb-2 ${
                          userAns === battle.correctAnswer
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                        }`}
                      >
                        <div className="font-black mb-1 flex items-center gap-1">
                          {userAns === battle.correctAnswer ? '✓ Sahi Jawab!' : '✗ Galat Jawab!'} (Sahi Tha:{' '}
                          {['A', 'B', 'C', 'D'][battle.correctAnswer]})
                        </div>
                        {battle.explanation ? (
                          <div>
                            <strong>Explanation: </strong> {battle.explanation}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* If answered and not last, quick button to jump to next */}
                    {hasAnswered && bIndex < visibleBattles.length - 1 && (
                      <button
                        type="button"
                        onClick={() => scrollToBattleCard(bIndex + 1, visibleBattles[bIndex + 1].id)}
                        className="w-full py-2 px-3 mb-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/60 active:scale-98 transition-all cursor-pointer"
                      >
                        <span>Agla Battle MCQ (#{bIndex + 2}) Par Jayein</span>
                        <ChevronDown size={14} />
                      </button>
                    )}

                    {/* Footer: Like button & solve indicator */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <button
                        onClick={() => handleToggleBattleLike(battle.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all active:scale-95 cursor-pointer ${
                          isLiked
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <ThumbsUp size={14} className={isLiked ? 'fill-pink-600' : ''} />
                        <span>{battle.upvotes || 0} Likes</span>
                      </button>

                      <span className="text-[11px] font-bold text-slate-400">
                        {hasAnswered ? '✅ Solved' : '⚡ Unattempted'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* ── Battle End Score Card (Antim Parinam / Summary) ── */}
              {battleAttemptedCount > 0 && (
                <div
                  className={`p-5 rounded-3xl border text-center transition-all ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <Trophy size={22} className="text-amber-500" />
                    <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      Aapka Battle Scoreboard
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    Antim score aur parinam summary:
                  </p>

                  <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto mb-3">
                    <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Kiye Gaye</div>
                      <div className="text-base font-black text-slate-900 dark:text-white">
                        {battleAttemptedCount} / {visibleBattles.length}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase">Sahi</div>
                      <div className="text-base font-black text-emerald-600">{battleCorrectCount}</div>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800">
                      <div className="text-[10px] font-bold text-rose-600 uppercase">Galat</div>
                      <div className="text-base font-black text-rose-600">{battleWrongCount}</div>
                    </div>
                  </div>

                  <div className="text-xs font-black text-purple-600 dark:text-purple-400">
                    Accuracy: {battleAttemptedCount > 0 ? Math.round((battleCorrectCount / battleAttemptedCount) * 100) : 0}%
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* QUESTION GRID SHEET (FOR OFFICIAL 100 QUESTIONS) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showQuestionGrid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className={`max-w-md w-full rounded-3xl p-5 border flex flex-col max-h-[85vh] shadow-2xl ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base">Question Navigator ({totalOfficialCount} MCQs)</h3>
                <p className="text-xs text-slate-500">Kisi bhi prashna par direct jump karein</p>
              </div>
              <button
                onClick={() => setShowQuestionGrid(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 py-2.5 text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> Sahi
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-rose-500" /> Galat
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-600" /> Current
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700" /> Bacha Hai
              </span>
            </div>

            {/* 10x10 Grid */}
            <div className="grid grid-cols-10 gap-1.5 overflow-y-auto py-2 pr-1 flex-1">
              {officialQuestions.map((_, idx) => {
                const ans = progress.answers[idx];
                const isCurrent = idx === currentQIndex;

                let btnBg = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
                if (ans) {
                  if (ans.isCorrect) btnBg = 'bg-emerald-500 text-white font-bold';
                  else btnBg = 'bg-rose-500 text-white font-bold';
                }
                if (isCurrent) {
                  btnBg += ' ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleJumpToOfficialQ(idx)}
                    className={`h-8 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center justify-center cursor-pointer ${btnBg}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowQuestionGrid(false);
                  setShowReviewAll(true);
                  if (soundOn) playSoundClick();
                }}
                className="px-3 py-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-amber-100 active:scale-95 cursor-pointer"
              >
                <BookOpen size={13} />
                <span>Review All ({totalOfficialCount})</span>
              </button>

              <button
                onClick={() => setShowQuestionGrid(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BATTLE QUESTION GRID MODAL (FOR DIRECT JUMP TO ANY BATTLE MCQ) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showBattleGrid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className={`max-w-md w-full rounded-3xl p-5 border flex flex-col max-h-[85vh] shadow-2xl ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base flex items-center gap-1.5">
                  <Swords size={18} className="text-purple-600" />
                  <span>Battle MCQs Navigator ({visibleBattles.length})</span>
                </h3>
                <p className="text-xs text-slate-500">Kisi bhi Battle MCQ par click karke direct solve karein</p>
              </div>
              <button
                onClick={() => setShowBattleGrid(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 py-2.5 text-[11px] font-bold border-b border-slate-100 dark:border-slate-800 flex-wrap">
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sahi
              </span>
              <span className="flex items-center gap-1 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Galat
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" /> Baaki
              </span>
              <span className="flex items-center gap-1 text-purple-600">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-purple-600" /> Current
              </span>
            </div>

            {/* Grid of buttons */}
            <div className="flex-1 overflow-y-auto overscroll-contain py-4 grid grid-cols-5 sm:grid-cols-6 gap-2">
              {visibleBattles.map((b, idx) => {
                const userAns = userBattleAnswers[b.id];
                const isAnswered = userAns !== undefined;
                const isCorrect = isAnswered && userAns === b.correctAnswer;
                const isCurrent = idx === safeBattleIdx;

                let btnStyles = isDarkMode
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-purple-500'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-purple-300';

                if (isAnswered) {
                  if (isCorrect) {
                    btnStyles = 'bg-emerald-500 border-emerald-600 text-white font-black';
                  } else {
                    btnStyles = 'bg-rose-500 border-rose-600 text-white font-black';
                  }
                }

                if (isCurrent) {
                  btnStyles += ' ring-2 ring-purple-600 ring-offset-2 dark:ring-offset-slate-900 font-black';
                }

                return (
                  <button
                    key={b.id}
                    onClick={() => handleJumpToBattleQ(idx)}
                    className={`h-11 rounded-xl text-xs font-black border flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer ${btnStyles}`}
                  >
                    <span>#{idx + 1}</span>
                    <span className="text-[9px] opacity-75 font-normal">
                      {isAnswered ? (isCorrect ? '✓' : '✗') : 'Q'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowBattleGrid(false)}
                className="px-4 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREATE & POST NEW MCQ TO BATTLE ARENA */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className={`max-w-lg w-full rounded-3xl p-5 border flex flex-col max-h-[90vh] shadow-2xl overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Swords size={20} className="text-purple-600" />
                <div>
                  <h3 className="font-black text-base">Naya Battle MCQ Bhejo</h3>
                  <p className="text-xs text-slate-500">Aapka question sabhi students solve karenge!</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitNewBattle} className="flex flex-col gap-3.5 overflow-y-auto py-3 pr-1">
              {/* Target Class */}
              {!isRoutineOn ? (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Kis Class Ke Liye Hai? (Target Class):
                  </label>
                  <select
                    value={newTargetClass}
                    onChange={(e) => setNewTargetClass(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="General">General / All Classes</option>
                    {AVAILABLE_CLASSES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                  isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <span>Target Class (Routine Linked):</span>
                  <span className="text-purple-600 dark:text-purple-400 font-black">
                    {routineLinkedClass === 'Competition' ? 'Competition' : `Class ${routineLinkedClass}`}
                  </span>
                </div>
              )}

              {/* Question */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Prashna (Question Text) *:
                </label>
                <textarea
                  required
                  rows={3}
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Yahan apna question likhein..."
                  className={`w-full p-3 rounded-xl border text-xs leading-relaxed resize-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {/* Statements (Optional, for Statement-based Questions) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    कथन (Statements) - यदि प्रश्न कथन वाला है:
                  </label>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                    (हर लाइन = 1 कथन)
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={newStatements}
                  onChange={(e) => setNewStatements(e.target.value)}
                  placeholder={`उदा:&#10;1. भारत एक संप्रभु लोकतांत्रिक गणराज्य है।&#10;2. भारतीय संविधान 26 जनवरी 1950 को लागू हुआ था।`}
                  className={`w-full p-2.5 rounded-xl border text-xs leading-relaxed resize-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 <strong>Tip:</strong> अगर आप प्रश्न में ही &quot;कथन 1&quot;, &quot;कथन 2&quot; लिखते हैं तो सिस्टम अपने आप कथन पहचान कर अलग कर लेगा।
                </p>
              </div>

              {/* 4 Options */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                  Charo Vikalp (Options A, B, C, D) *:
                </label>

                {[
                  { label: 'A', val: newOptA, set: setNewOptA, idx: 0 },
                  { label: 'B', val: newOptB, set: setNewOptB, idx: 1 },
                  { label: 'C', val: newOptC, set: setNewOptC, idx: 2 },
                  { label: 'D', val: newOptD, set: setNewOptD, idx: 3 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCorrectIdx(item.idx)}
                      className={`w-8 h-8 rounded-xl font-black text-xs shrink-0 flex items-center justify-center border transition-all ${
                        newCorrectIdx === item.idx
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                      title={newCorrectIdx === item.idx ? 'Correct Answer' : 'Click to set as Correct Answer'}
                    >
                      {item.label}
                    </button>
                    <input
                      type="text"
                      required
                      value={item.val}
                      onChange={(e) => item.set(e.target.value)}
                      placeholder={`Option ${item.label}`}
                      className={`flex-1 p-2 rounded-xl border text-xs ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                    {newCorrectIdx === item.idx && (
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 shrink-0">
                        ✓ Correct
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Explanation (Optional) */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Vyakhya / Explanation (Optional):
                </label>
                <input
                  type="text"
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  placeholder="Kyu ye sahi jawab hai? (Tips / Details)"
                  className={`w-full p-2.5 rounded-xl border text-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBattle}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <Send size={14} />
                  <span>{submittingBattle ? 'Bheja Ja Raha Hai...' : 'Battle Me Bhejo 🚀'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Class Selection Drawer (Bottom Sheet / Modal Drawer) ── */}
      {showClassDrawer && (
        <div
          id="mcq-class-drawer-overlay"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowClassDrawer(false)}
        >
          <div
            id="mcq-class-drawer-container"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-6 duration-200 ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Top Pull Notch for mobile */}
            <div className="w-full flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Drawer Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    activeSubMode === 'OFFICIAL'
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                      : 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400'
                  }`}
                >
                  <GraduationCap size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm sm:text-base leading-tight truncate">
                    Class Chunen (Select Class)
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Selected Class:
                    </span>
                    <span
                      className={`text-[11px] font-black px-2 py-0.2 rounded-md truncate ${
                        activeSubMode === 'OFFICIAL'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                      }`}
                    >
                      {activeSubMode === 'OFFICIAL'
                        ? (AVAILABLE_CLASSES.find((c) => c.id === officialClass)?.label || `Class ${officialClass}`)
                        : battleClassFilter === 'ALL'
                        ? 'All Classes 🌟'
                        : (AVAILABLE_CLASSES.find((c) => c.id === battleClassFilter)?.label || `Class ${battleClassFilter}`)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                id="mcq-class-drawer-close"
                type="button"
                onClick={() => setShowClassDrawer(false)}
                className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-800/80 text-slate-400 hover:text-white'
                    : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-900'
                }`}
                title="Drawer Band Karein"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Classes List */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 scrollbar-none">
              {/* Battles "All Classes" option */}
              {activeSubMode === 'BATTLES' && (
                <button
                  type="button"
                  onClick={() => {
                    setBattleClassFilter('ALL');
                    setShowClassDrawer(false);
                    if (soundOn) playSoundClick();
                  }}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                    battleClassFilter === 'ALL'
                      ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500/50'
                      : isDarkMode
                      ? 'bg-slate-800/50 border-slate-800 text-slate-200 hover:bg-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base bg-purple-100 dark:bg-purple-950 text-purple-600">
                      🌟
                    </div>
                    <div>
                      <div className="font-black text-sm">All Classes</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Sabhi classes ke battle questions ek sath dekhein
                      </div>
                    </div>
                  </div>
                  {battleClassFilter === 'ALL' ? (
                    <div className="flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-lg bg-purple-600 text-white shadow-xs">
                      <Check size={14} strokeWidth={3} />
                      <span>Selected</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">Chunen →</span>
                  )}
                </button>
              )}

              {AVAILABLE_CLASSES.map((cls) => {
                const isSelected =
                  activeSubMode === 'OFFICIAL'
                    ? officialClass === cls.id
                    : battleClassFilter === cls.id;

                const isRoutineLinked = isRoutineOn && routineLinkedClass === cls.id;

                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      if (activeSubMode === 'OFFICIAL') {
                        handleClassChange(cls.id);
                      } else {
                        setBattleClassFilter(cls.id);
                      }
                      setShowClassDrawer(false);
                      if (soundOn) playSoundClick();
                    }}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                      isSelected
                        ? activeSubMode === 'OFFICIAL'
                          ? 'bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/50'
                          : 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500/50'
                        : isDarkMode
                        ? 'bg-slate-800/50 border-slate-800 text-slate-200 hover:bg-slate-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                          isSelected
                            ? activeSubMode === 'OFFICIAL'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-purple-600 text-white shadow-xs'
                            : isDarkMode
                            ? 'bg-slate-800 text-slate-300 border border-slate-700'
                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {cls.id === 'Competition' ? 'Comp' : cls.id}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm">{cls.label}</span>
                          {isRoutineLinked && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Routine
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {cls.id === '10'
                            ? 'Matric / Board Special & Daily 100'
                            : cls.id === '12'
                            ? 'Intermediate / Board Special'
                            : cls.id === 'Competition'
                            ? 'All India / General Competition'
                            : `${cls.label} NCERT & State Board`}
                        </div>
                      </div>
                    </div>

                    {isSelected ? (
                      <div
                        className={`flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-lg ${
                          activeSubMode === 'OFFICIAL'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-purple-600 text-white shadow-xs'
                        }`}
                      >
                        <Check size={14} strokeWidth={3} />
                        <span>Selected</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold">Chunen →</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isRoutineOn ? (
                  <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    <Sparkles size={12} /> Routine Linked
                  </span>
                ) : (
                  <span>Selected class turant apply ho jayegi</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowClassDrawer(false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubMode === 'OFFICIAL'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                }`}
              >
                Ho Gaya (Done)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default McqHub;
