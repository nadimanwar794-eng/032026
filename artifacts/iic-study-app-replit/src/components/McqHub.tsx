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
  RotateCcw
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
import { loadRoutineData } from '../utils/routineStorage';

export interface McqHubProps {
  user: User;
  settings?: SystemSettings | null;
  onBack?: () => void;
  isDarkMode?: boolean;
  initialMcqDraft?: { question: string; options: [string, string, string, string] | string[]; correctAnswer: number; explanation?: string };
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
  { id: '5', label: 'Class 5' },
  { id: '4', label: 'Class 4' },
  { id: '3', label: 'Class 3' },
  { id: '2', label: 'Class 2' },
  { id: '1', label: 'Class 1' },
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
      return match ? match.id : routineData.selectedClass;
    }
    if (user.classLevel) {
      const uc = String(user.classLevel).trim().toLowerCase();
      if (uc === 'competition' || uc === 'comp') return 'Competition';
      const match = AVAILABLE_CLASSES.find((c) => c.id.toLowerCase() === uc);
      return match ? match.id : user.classLevel;
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

  // Official MCQ Question Scroll Option (for big/lengthy questions)
  const [officialExpanded, setOfficialExpanded] = useState<boolean>(false);
  const currentQIsBig = useMemo(() => {
    return currentQ ? isBigQuestion(currentQ.question) : false;
  }, [currentQ]);

  // Reset scroll expansion whenever question index changes so new big questions default to the neat scroll box
  useEffect(() => {
    setOfficialExpanded(false);
  }, [currentQIndex]);

  // Auto-advance toggle
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const autoAdvanceTimerRef = useRef<any>(null);

  // Show question navigation drawer
  const [showQuestionGrid, setShowQuestionGrid] = useState<boolean>(false);
  // Toggle per-question explanation visibility to prevent screen clutter
  const [showExplanationMap, setShowExplanationMap] = useState<Record<number, boolean>>({});

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

    // Auto advance if enabled and not at the end
    if (autoAdvance && currentQIndex < maxIndex) {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = setTimeout(() => {
        setProgress((prev) => {
          const up = { ...prev, currentIndex: Math.min(maxIndex, prev.currentIndex + 1) };
          saveOfficialDailyProgress(user.id, up);
          return up;
        });
      }, 1400);
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
    if (window.confirm('Kya aap aaj ke 100 MCQs dobara shuru se attempt karna chahte hain?')) {
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

  // Battle MCQ Scroll Option (allows scroll container for big/long questions)
  const [battleScrollOptionEnabled, setBattleScrollOptionEnabled] = useState<boolean>(true);
  const [expandedBattleIds, setExpandedBattleIds] = useState<Record<string, boolean>>({});

  const toggleBattleExpand = (battleId: string) => {
    setExpandedBattleIds((prev) => ({
      ...prev,
      [battleId]: !prev[battleId],
    }));
  };

  // Modal to submit a new MCQ to Battle Arena
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newQuestion, setNewQuestion] = useState<string>('');
  const [newOptA, setNewOptA] = useState<string>('');
  const [newOptB, setNewOptB] = useState<string>('');
  const [newOptC, setNewOptC] = useState<string>('');
  const [newOptD, setNewOptD] = useState<string>('');
  const [newCorrectIdx, setNewCorrectIdx] = useState<number>(0);
  const [newExplanation, setNewExplanation] = useState<string>('');
  const [newTargetClass, setNewTargetClass] = useState<string>(officialClass);
  const [submittingBattle, setSubmittingBattle] = useState<boolean>(false);

  // Pre-fill if initialMcqDraft passed
  useEffect(() => {
    if (initialMcqDraft && initialMcqDraft.question) {
      setActiveSubMode('BATTLES');
      setNewQuestion(initialMcqDraft.question);
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
    } catch {}
    if (localCache.length > 0) {
      setBattleList(localCache);
    }

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

                  items.push({
                    id: msgId,
                    userId: msgData.userId || 'anon',
                    userName: msgData.userName || 'Student',
                    userRole: msgData.userRole || msgData.subscriptionLevel || 'Student',
                    userPhoto: msgData.userPhoto || '',
                    classLevel: msgData.classLevel || md.classLevel || 'General',
                    timestamp: msgData.timestamp || Date.now(),
                    question: qText,
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
                      items.push({
                        id: bId,
                        userId: bData.userId || 'anon',
                        userName: bData.userName || 'Challenger',
                        userRole: bData.userRole || 'Student',
                        userPhoto: bData.userPhoto || '',
                        classLevel: bData.classLevel || 'General',
                        timestamp: bData.timestamp || Date.now(),
                        question: bData.question,
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

              // Fallback seed questions if database is brand new so users always have rich battles
              if (items.length === 0) {
                const seedBattles: BattleMcqItem[] = [
                  {
                    id: 'seed-b1',
                    userId: 'admin_1',
                    userName: 'Rakesh Sir (Science Faculty)',
                    userRole: 'ADMIN',
                    classLevel: '10',
                    timestamp: Date.now() - 1000 * 60 * 45,
                    question: 'पौधों में पत्तियों से जलवाष्प के रूप में जल का निष्कासन क्या कहलाता है?',
                    options: ['प्रकाश संश्लेषण', 'वाष्पोत्सर्जन (Transpiration)', 'श्वसन', 'बिंदुस्राव'],
                    correctAnswer: 1,
                    explanation: 'पौधों के वायवीय भागों (पत्तियों के रंध्रों) द्वारा जलवाष्प के रूप में जल हानि को वाष्पोत्सर्जन कहते हैं।',
                    upvotes: 14,
                  },
                  {
                    id: 'seed-b2',
                    userId: 'student_99',
                    userName: 'Aman Sharma',
                    userRole: 'ULTRA',
                    classLevel: '10',
                    timestamp: Date.now() - 1000 * 60 * 120,
                    question: 'यदि किसी परिपथ में 2 Ω और 3 Ω के दो प्रतिरोध श्रेणीक्रम (Series) में जुड़े हैं, तो तुल्य प्रतिरोध क्या होगा?',
                    options: ['5 Ω', '6 Ω', '1.2 Ω', '0.5 Ω'],
                    correctAnswer: 0,
                    explanation: 'श्रेणीक्रम में तुल्य प्रतिरोध R = R₁ + R₂ = 2 + 3 = 5 Ω होता है।',
                    upvotes: 9,
                  },
                  {
                    id: 'seed-b3',
                    userId: 'teacher_geo',
                    userName: 'Priya Verma',
                    userRole: 'MOD',
                    classLevel: 'Competition',
                    timestamp: Date.now() - 1000 * 60 * 200,
                    question: 'भारतीय संविधान में मौलिक कर्तव्यों (Fundamental Duties) को किस संविधान संशोधन द्वारा जोड़ा गया था?',
                    options: ['42वाँ संविधान संशोधन (1976)', '44वाँ संविधान संशोधन (1978)', '86वाँ संशोधन', '52वाँ संशोधन'],
                    correctAnswer: 0,
                    explanation: 'स्वर्ण सिंह समिति की सिफारिश पर 42वें संविधान संशोधन 1976 द्वारा संविधान के भाग IV-A में अनुच्छेद 51-A जोड़ा गया था।',
                    upvotes: 21,
                  },
                ];
                items.push(...seedBattles);
              }

              // Sort newest first
              items.sort((a, b) => b.timestamp - a.timestamp);
              setBattleList(items);
              setBattleLoading(false);

              try {
                localStorage.setItem('nst_cached_battle_mcqs', JSON.stringify(items.slice(0, 80)));
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
    const newBattleItem: BattleMcqItem = {
      id: newId,
      userId: user.id,
      userName: user.name || 'Student Challenger',
      userRole: user.role || user.subscriptionLevel || 'Student',
      userPhoto: user.photoUrl || '',
      classLevel: newTargetClass,
      timestamp: Date.now(),
      question: newQuestion.trim(),
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
          text: newQuestion.trim(),
          mcqData: {
            question: newQuestion.trim(),
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
      className={`flex-1 flex flex-col min-h-screen ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* ── Top Header: Sleek Professional Arena Header ── */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between px-3 sm:px-4 py-2 border-b backdrop-blur-md ${
          isDarkMode
            ? 'bg-slate-900/95 border-slate-800 text-white'
            : 'bg-white/95 border-slate-200 text-slate-900 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className={`p-1.5 rounded-xl border active:scale-95 transition-all shrink-0 cursor-pointer ${
                isDarkMode
                  ? 'border-slate-800 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="Wapas Jayein"
            >
              <ArrowLeft size={16} />
            </button>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-black tracking-tight leading-none truncate">
              MCQ Arena
            </h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                isRoutineOn
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              }`}
            >
              {isRoutineOn && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
              <span>
                {activeSubMode === 'OFFICIAL'
                  ? officialClass === 'Competition'
                    ? 'Competition'
                    : `Class ${officialClass}`
                  : battleClassFilter === 'ALL'
                  ? 'All Classes'
                  : `Class ${battleClassFilter}`}
              </span>
            </span>
          </div>
        </div>

        {/* Right Actions: Restart Test, Question Navigator, Sound Toggle */}
        <div className="flex items-center gap-1 shrink-0">
          {activeSubMode === 'OFFICIAL' && totalOfficialCount > 0 && (
            <>
              <button
                type="button"
                onClick={handleResetOfficialSet}
                className={`h-8 px-2 rounded-xl border flex items-center gap-1 text-[11px] font-bold active:scale-95 transition-all cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:text-rose-400'
                    : 'border-slate-200 bg-slate-100/90 text-slate-600 hover:text-rose-600'
                }`}
                title="Restart Test (प्रगति रीसेट करें)"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Restart</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQuestionGrid(true)}
                className="h-8 px-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center gap-1 text-xs font-black active:scale-95 transition-all cursor-pointer"
                title="Question Navigator"
              >
                <LayoutGrid size={13} />
                <span>
                  {currentQIndex + 1}/{totalOfficialCount}
                </span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={toggleSound}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              soundOn
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-400'
                : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
            }`}
            title={soundOn ? 'Sound Mute' : 'Sound On'}
          >
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>
      </header>

      {/* ── Segmented Mode Switcher (Sleek, Compact) ── */}
      <div
        className={`px-3 py-1.5 border-b sticky top-[49px] z-20 ${
          isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-2xs'
        }`}
      >
        <div className="max-w-xl mx-auto flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setActiveSubMode('OFFICIAL');
              if (soundOn) playSoundClick();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-black text-xs transition-all duration-150 cursor-pointer ${
              activeSubMode === 'OFFICIAL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles size={13} className={activeSubMode === 'OFFICIAL' ? 'text-amber-300' : 'text-blue-500'} />
            <span>Official MCQs ({totalOfficialCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubMode('BATTLES');
              if (soundOn) playSoundClick();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-black text-xs transition-all duration-150 cursor-pointer ${
              activeSubMode === 'BATTLES'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Swords size={13} className={activeSubMode === 'BATTLES' ? 'text-amber-300' : 'text-purple-500'} />
            <span>MCQ Battles</span>
            {battleList.length > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
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
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 1. OFFICIAL MODE VIEW */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSubMode === 'OFFICIAL' && (
        <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-2.5 gap-2.5 animate-in fade-in duration-150">
          {/* Class Selection Strip: Only visible when routine is OFF */}
          {!isRoutineOn && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
                <GraduationCap size={13} /> Class:
              </span>
              {AVAILABLE_CLASSES.map((cls) => {
                const isSelected = officialClass === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      setOfficialClass(cls.id);
                      if (soundOn) playSoundClick();
                    }}
                    className={`shrink-0 h-7 px-2.5 rounded-lg font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {cls.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Examination Action & Status Strip (One Single Sleek Bar) ── */}
          <div
            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl border transition-all ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
            }`}
          >
            {/* Question Counter Button */}
            <button
              type="button"
              onClick={() => setShowQuestionGrid(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-all font-black text-xs cursor-pointer active:scale-95"
              title="Sabhi prashna dekhein"
            >
              <LayoutGrid size={13} className="text-blue-600 dark:text-blue-400" />
              <span>
                Q {currentQIndex + 1} / {totalOfficialCount}
              </span>
            </button>

            {/* Compact Live Score Counters */}
            <div className="flex items-center gap-1.5">
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-black text-xs border border-emerald-200/80 dark:border-emerald-800/80"
                title="Sahi Uttar"
              >
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>{progress.correctCount}</span>
              </span>
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-black text-xs border border-rose-200/80 dark:border-rose-800/80"
                title="Galat Uttar"
              >
                <XCircle size={12} className="text-rose-600" />
                <span>{progress.wrongCount}</span>
              </span>
              <span
                className="hidden sm:inline-block text-[11px] font-bold text-slate-500 dark:text-slate-400"
                title="Total Kiye"
              >
                ({progress.attemptedCount}/{totalOfficialCount} solved)
              </span>
            </div>

            {/* Quick Prev / Next Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevOfficialQ}
                disabled={currentQIndex === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
                title="Pichhla Prashna"
              >
                <ChevronLeft size={14} />
                <span className="hidden sm:inline">Pichhla</span>
              </button>
              <button
                type="button"
                onClick={handleNextOfficialQ}
                disabled={currentQIndex >= maxIndex}
                className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all shadow-2xs cursor-pointer"
                title="Agla Prashna"
              >
                <span className="hidden sm:inline">Agla</span>
                <ChevronRight size={14} />
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
                      {/* Scroll Option Button for Big Questions */}
                      {currentQIsBig && (
                        <button
                          type="button"
                          onClick={() => setOfficialExpanded((prev) => !prev)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 active:scale-95"
                          title={officialExpanded ? 'Scroll box me badlein' : 'Pura question failayein'}
                        >
                          {officialExpanded ? (
                            <>
                              <Minimize2 size={11} />
                              <span>Scroll Box</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 size={11} />
                              <span>📜 Scroll View</span>
                            </>
                          )}
                        </button>
                      )}

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

                  {/* Scroll guide banner for big question */}
                  {currentQIsBig && !officialExpanded && (
                    <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/50 text-[10px] text-blue-800 dark:text-blue-200 font-bold mb-2">
                      <span>📜 <strong>Bada Question:</strong> Scroll karke pura padhein</span>
                      <button
                        type="button"
                        onClick={() => setOfficialExpanded(true)}
                        className="text-[9px] font-black underline uppercase text-blue-600 dark:text-blue-400 hover:opacity-80 cursor-pointer"
                      >
                        Pura Kholein
                      </button>
                    </div>
                  )}

                  {/* Question Text with Math rendering and Scroll Container */}
                  <div
                    className={`transition-all duration-150 ${
                      currentQIsBig && !officialExpanded
                        ? 'max-h-40 sm:max-h-52 overflow-y-auto overscroll-contain pr-2 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 mcq-official-scroll mb-3 shadow-inner'
                        : 'mb-3'
                    }`}
                  >
                    <div
                      className="text-sm sm:text-base font-bold leading-relaxed text-slate-900 dark:text-slate-100"
                      dangerouslySetInnerHTML={{
                        __html: renderMathInHtml(currentQ.question || ''),
                      }}
                    />
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

                          {currentQIndex < maxIndex && (
                            <button
                              type="button"
                              onClick={handleNextOfficialQ}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-black shadow-xs hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
                            >
                              <span>अगला (Next)</span>
                              <ChevronRight size={13} />
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

                  {/* Bottom Quick Controls */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoAdvance}
                        onChange={(e) => setAutoAdvance(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-[11px]">Auto-next (1.4s)</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowQuestionGrid(true)}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <LayoutGrid size={12} />
                      <span>Question Palette</span>
                    </button>
                  </div>
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
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setShowQuestionGrid(true)}
                      className="px-4 py-2 bg-white text-orange-700 font-black rounded-xl text-xs shadow-md active:scale-95"
                    >
                      Review All {totalOfficialCount} Questions
                    </button>
                    <button
                      onClick={handleResetOfficialSet}
                      className="px-4 py-2 bg-orange-700/60 hover:bg-orange-700 text-white font-bold rounded-xl text-xs active:scale-95"
                    >
                      Reattempt
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
        <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-2.5 gap-2.5 animate-in fade-in duration-150">
          {/* Class Selection Strip: Only visible when routine is OFF */}
          {!isRoutineOn ? (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
                <GraduationCap size={13} /> Class:
              </span>
              <button
                type="button"
                onClick={() => setBattleClassFilter('ALL')}
                className={`shrink-0 h-7 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center border ${
                  battleClassFilter === 'ALL'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                    : isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                🌟 All Classes
              </button>
              {AVAILABLE_CLASSES.map((cls) => {
                const isSelected = battleClassFilter === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setBattleClassFilter(cls.id)}
                    className={`shrink-0 h-7 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center border ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {cls.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs font-bold ${
                isDarkMode
                  ? 'bg-purple-950/40 border-purple-800/60 text-purple-300'
                  : 'bg-purple-50 border-purple-200 text-purple-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-purple-500 shrink-0 animate-pulse" />
                <span>Routine: {routineLinkedClass === 'Competition' ? 'Competition' : `Class ${routineLinkedClass}`}</span>
              </div>
              <span className="text-[11px] font-semibold opacity-85">Linked with Routine</span>
            </div>
          )}

          {/* ── Battles Action & Status Bar (Single Unified Row) ── */}
          <div
            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl border transition-all ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
            }`}
          >
            {/* Total count badge */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Swords size={13} className="text-purple-600" />
                <span>{visibleBattles.length} Battles</span>
              </span>
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-black text-[11px] border border-emerald-200/80 dark:border-emerald-800/80"
                title="Sahi"
              >
                <CheckCircle2 size={11} className="text-emerald-600" />
                <span>{battleCorrectCount}</span>
              </span>
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-black text-[11px] border border-rose-200/80 dark:border-rose-800/80"
                title="Galat"
              >
                <XCircle size={11} className="text-rose-600" />
                <span>{battleWrongCount}</span>
              </span>
            </div>

            {/* Right: Scroll Option & Post MCQ Button */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next = !battleScrollOptionEnabled;
                  setBattleScrollOptionEnabled(next);
                  if (!next) {
                    const allExpanded: Record<string, boolean> = {};
                    visibleBattles.forEach((b) => {
                      allExpanded[b.id] = true;
                    });
                    setExpandedBattleIds(allExpanded);
                  } else {
                    setExpandedBattleIds({});
                  }
                }}
                className={`flex items-center gap-1 h-7 px-2 rounded-lg border text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                  battleScrollOptionEnabled
                    ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
                title="Scroll mode toggle"
              >
                <span>📜 Scroll</span>
                <span
                  className={`text-[9px] font-black px-1 rounded-sm ${
                    battleScrollOptionEnabled ? 'bg-purple-200 text-purple-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {battleScrollOptionEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 h-7 px-2.5 rounded-lg font-black text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={13} strokeWidth={3} />
                <span>MCQ Bhejo</span>
              </button>
            </div>
          </div>

          {/* Stream of user-submitted MCQs: "ishme user jitna bhejenge utna dikhega" */}
          <div className="flex flex-col gap-3.5">
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
                    Is class ke liye abhi koi user MCQ nahi mila!
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
              visibleBattles.map((battle, bIndex) => {
                const userAns = userBattleAnswers[battle.id];
                const hasAnswered = userAns !== undefined;
                const isLiked = !!userBattleLikes[battle.id];
                const isBigBattleQ = isBigQuestion(battle.question);
                const isBattleExpanded = Boolean(expandedBattleIds[battle.id]) || !battleScrollOptionEnabled;

                return (
                  <div
                    key={battle.id}
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
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          #{bIndex + 1}
                        </span>
                      </div>
                    </div>

                    {/* Scroll Option Indicator if Big Question */}
                    {isBigBattleQ && (
                      <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900/50 text-[10px] text-purple-700 dark:text-purple-300 font-bold mb-2">
                        <span className="flex items-center gap-1">
                          <span>📜 <strong>Bada Question:</strong> {!isBattleExpanded ? 'Scroll karke pura padhein' : 'Pura prashna open hai'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleBattleExpand(battle.id)}
                          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer shadow-2xs"
                        >
                          {isBattleExpanded ? (
                            <>
                              <Minimize2 size={10} />
                              <span>Scroll Box</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 size={10} />
                              <span>Pura Kholein</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Question Text with Scroll Container */}
                    <div
                      className={`transition-all duration-150 ${
                        isBigBattleQ && !isBattleExpanded
                          ? 'max-h-40 sm:max-h-52 overflow-y-auto overscroll-contain pr-2 p-2.5 rounded-2xl bg-purple-50/30 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 mcq-question-scroll mb-3 shadow-inner'
                          : 'mb-4'
                      }`}
                    >
                      <div
                        className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug"
                        dangerouslySetInnerHTML={{
                          __html: renderMathInHtml(battle.question),
                        }}
                      />
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

                    {/* Footer: Like button & solve indicator */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <button
                        onClick={() => handleToggleBattleLike(battle.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all active:scale-95 ${
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
              })
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

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowQuestionGrid(false)}
                className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
              >
                Close
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
    </div>
  );
};

export default McqHub;
